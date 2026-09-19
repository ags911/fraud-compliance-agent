"""Tests for the Sparkov mechanics dataset build and its quality gates.

All inputs are seeded synthetic files from `sparkov_fixtures`; the real corpus is
never read here.
"""

import hashlib
import json
import sys

import pandas as pd
import pytest
from sparkov_fixtures import (
    DEFECTS,
    EXTRA_SOURCE_COLUMNS,
    make_source_frames,
    write_source_files,
)


def _build(sparkov_build, tmp_path, **kwargs):
    """Write synthetic sources and run the build, returning the manifest and output path."""
    train, test = write_source_files(tmp_path, **kwargs)
    output = tmp_path / "out" / "mechanics.csv"
    return sparkov_build.build_dataset(train, test, output, 0.8), output


def test_file_checksum_matches_hashlib(sparkov_build, tmp_path) -> None:
    """The checksum helper is a plain SHA-256 of the file bytes."""
    path = tmp_path / "data.bin"
    path.write_bytes(b"synthetic" * 500_000)

    assert (
        sparkov_build.file_checksum(path)
        == hashlib.sha256(path.read_bytes()).hexdigest()
    )


def test_amount_band_uses_fixed_edges(sparkov_build) -> None:
    """Bands are fixed source-unit intervals, closed on the right, fitted to nothing."""
    values = pd.Series([5, 10, 10.01, 50, 100, 500, 500.01])

    assert list(sparkov_build.amount_band(values)) == [
        "up_to_10",
        "up_to_10",
        "10_to_50",
        "10_to_50",
        "50_to_100",
        "100_to_500",
        "over_500",
    ]


def test_cutpoint_is_the_chronological_eighty_percent_mark(
    sparkov_build, tmp_path
) -> None:
    """The cutpoint is a real timestamp taken at the requested fraction of sorted time."""
    train_path, _ = write_source_files(tmp_path)
    train, _ = make_source_frames()

    cutpoint = sparkov_build.train_cutpoint(train_path, 0.8)

    assert cutpoint == pd.Timestamp(train["trans_date_trans_time"].iloc[479], tz="UTC")


def test_cutpoint_rejects_an_empty_source(sparkov_build, tmp_path) -> None:
    """A header-only file cannot define a partition boundary."""
    empty = tmp_path / "empty.csv"
    empty.write_text("trans_date_trans_time\n", encoding="utf-8")

    with pytest.raises(ValueError, match="no timestamps"):
        sparkov_build.train_cutpoint(empty, 0.8)


def test_transform_chunk_derives_features_and_partitions(sparkov_build) -> None:
    """Time features come from UTC timestamps; partitions follow the cutpoint."""
    chunk = pd.DataFrame(
        {
            "trans_date_trans_time": ["2019-01-05 13:00:00", "2019-01-07 09:30:00"],
            "amt": [42.5, 700.0],
            "category": ["grocery_pos", "misc_pos"],
            "is_fraud": [0, 1],
        }
    )
    cutpoint = pd.Timestamp("2019-01-06", tz="UTC")

    train_side = sparkov_build.transform_chunk(chunk, "source_train", cutpoint)
    test_side = sparkov_build.transform_chunk(chunk, "source_test", None)

    # 2019-01-05 was a Saturday and 2019-01-07 a Monday.
    assert list(train_side["event_hour_utc"]) == [13, 9]
    assert list(train_side["event_day_of_week_utc"]) == [5, 0]
    assert list(train_side["is_weekend"]) == [1, 0]
    assert list(train_side["partition"]) == ["train", "calibration"]
    assert list(train_side["amount_band"]) == ["10_to_50", "over_500"]
    assert set(test_side["partition"]) == {"test"}
    assert list(train_side.columns) == sparkov_build.OUTPUT_COLUMNS


def test_transform_chunk_requires_a_cutpoint_for_training_data(sparkov_build) -> None:
    """Source training rows cannot be partitioned without an explicit boundary."""
    chunk = pd.DataFrame(
        {
            "trans_date_trans_time": ["2019-01-05 13:00:00"],
            "amt": [1.0],
            "category": ["misc_pos"],
            "is_fraud": [0],
        }
    )

    with pytest.raises(ValueError, match="cutpoint is required"):
        sparkov_build.transform_chunk(chunk, "source_train", None)


def test_build_writes_only_approved_columns_and_reconciles_rows(
    sparkov_build, tmp_path
) -> None:
    """A clean build drops identifiers, keeps every row, and reports passing checks."""
    manifest, output = _build(sparkov_build, tmp_path)
    frame = pd.read_csv(output)

    assert list(frame.columns) == sparkov_build.OUTPUT_COLUMNS
    assert not set(EXTRA_SOURCE_COLUMNS) & set(frame.columns)
    assert len(frame) == 800
    assert sum(manifest["partition_counts"].values()) == 800
    assert manifest["partition_counts"] == frame["partition"].value_counts().to_dict()
    assert all(count > 0 for count in manifest["partition_positive_counts"].values())
    assert manifest["quality_checks"]["passed"] is True
    assert manifest["quality_checks"]["checks"] == list(sparkov_build.QUALITY_CHECKS)
    assert manifest["quality_checks"]["source_row_counts"] == {
        "train_file": 600,
        "test_file": 200,
    }
    assert manifest["dataset_sha256"] == hashlib.sha256(output.read_bytes()).hexdigest()


def test_build_partitions_are_chronological_and_disjoint(
    sparkov_build, tmp_path
) -> None:
    """Train ends at the cutpoint, calibration follows it, and test comes last."""
    manifest, _ = _build(sparkov_build, tmp_path)
    bounds = {
        name: [pd.Timestamp(value) for value in span]
        for name, span in manifest["quality_checks"][
            "partition_time_bounds_utc"
        ].items()
    }
    cutpoint = pd.Timestamp(manifest["chronological_train_cutpoint"])

    assert bounds["train"][1] == cutpoint
    assert bounds["calibration"][0] > cutpoint
    assert (
        bounds["train"][1]
        < bounds["calibration"][0]
        <= bounds["calibration"][1]
        < bounds["test"][0]
    )


def test_build_is_deterministic(sparkov_build, tmp_path) -> None:
    """The same sources always produce byte-identical output and the same manifest."""
    for name in ("a", "b"):
        (tmp_path / name).mkdir()
    first, _ = _build(sparkov_build, tmp_path / "a")
    second, _ = _build(sparkov_build, tmp_path / "b")

    assert first == second


@pytest.mark.parametrize(
    ("partitions", "message"),
    [
        ({"train": 480, "calibration": 120, "test": 200}, None),
        ({"train": 479, "calibration": 120, "test": 200}, "do not reconcile"),
        ({"train": 480, "calibration": 121, "test": 200}, "do not reconcile"),
        ({"train": 480, "calibration": 120, "test": 199}, "do not reconcile"),
    ],
)
def test_row_count_gate_flags_dropped_or_duplicated_rows(
    sparkov_build, partitions, message
) -> None:
    """Train plus calibration must equal the train file, and test must equal the test file."""
    source = {"source_train": 600, "source_test": 200}

    if message is None:
        sparkov_build.check_row_counts(partitions, source)
    else:
        with pytest.raises(ValueError, match=message):
            sparkov_build.check_row_counts(partitions, source)


def test_build_runs_the_row_count_gate_with_real_counts(
    sparkov_build, tmp_path, monkeypatch
) -> None:
    """The gate is wired into the build and receives the counts actually observed."""
    calls = []
    original = sparkov_build.check_row_counts
    monkeypatch.setattr(
        sparkov_build,
        "check_row_counts",
        lambda *args: (calls.append(args), original(*args))[1],
    )

    _build(sparkov_build, tmp_path)

    assert calls == [
        (
            {"train": 480, "calibration": 120, "test": 200},
            {"source_train": 600, "source_test": 200},
        )
    ]


@pytest.mark.parametrize("fraction", [0, 1, -0.5, 1.5])
def test_build_rejects_an_invalid_train_fraction(
    sparkov_build, tmp_path, fraction
) -> None:
    """The train fraction must lie strictly between zero and one."""
    train, test = write_source_files(tmp_path)

    with pytest.raises(ValueError, match="strictly between zero and one"):
        sparkov_build.build_dataset(train, test, tmp_path / "out.csv", fraction)


# Each defect must be rejected, and for the reason the gate exists.
DEFECT_MESSAGES = {
    "missing_amount": "missing values",
    "missing_category": "missing values",
    "negative_amount": "out of range",
    "non_binary_label": "not binary",
    "unparseable_timestamp": None,
    "test_before_train": "not ordered",
    "no_calibration_fraud": "both target classes",
}


def test_every_defect_has_an_expected_failure() -> None:
    """A new defect cannot be added to the generator without a matching assertion."""
    assert set(DEFECT_MESSAGES) == set(DEFECTS)


@pytest.mark.parametrize("defect", DEFECTS)
def test_build_rejects_each_defective_source(sparkov_build, tmp_path, defect) -> None:
    """Broken inputs stop the build instead of producing a quietly wrong dataset."""
    train, test = write_source_files(tmp_path, defect=defect)

    with pytest.raises(ValueError, match=DEFECT_MESSAGES[defect]):
        sparkov_build.build_dataset(train, test, tmp_path / "out.csv", 0.8)


def test_quality_gate_rejects_unapproved_columns(sparkov_build) -> None:
    """An identifier column can never slip into the output schema."""
    chunk = pd.DataFrame(columns=[*sparkov_build.OUTPUT_COLUMNS, "cc_num"])

    with pytest.raises(ValueError, match="approved schema"):
        sparkov_build.check_chunk_quality(chunk)


@pytest.mark.parametrize(
    ("bounds", "message"),
    [
        ({"train": ("2020-01-02", "2020-01-05")}, "empty"),
        (
            {
                "train": ("2020-01-01", "2020-01-08"),
                "calibration": ("2020-01-06", "2020-01-09"),
                "test": ("2020-01-10", "2020-01-11"),
            },
            "cutpoint",
        ),
        (
            {
                "train": ("2020-01-01", "2020-01-05"),
                "calibration": ("2020-01-06", "2020-01-12"),
                "test": ("2020-01-10", "2020-01-13"),
            },
            "not ordered",
        ),
    ],
)
def test_time_order_gate_rejects_bad_partitions(sparkov_build, bounds, message) -> None:
    """Empty, mis-cut, and overlapping partitions are each rejected."""
    parsed = {
        name: (pd.Timestamp(low, tz="UTC"), pd.Timestamp(high, tz="UTC"))
        for name, (low, high) in bounds.items()
    }

    with pytest.raises(ValueError, match=message):
        sparkov_build.check_partition_time_order(
            parsed, pd.Timestamp("2020-01-05", tz="UTC")
        )


def test_command_line_reports_success_and_writes_the_manifest(
    sparkov_build, tmp_path, monkeypatch, capsys
) -> None:
    """The CLI exits zero and writes a manifest that records the passed checks."""
    train, test = write_source_files(tmp_path)
    manifest_path = tmp_path / "manifest.json"
    monkeypatch.setattr(
        sys,
        "argv",
        [
            "build",
            "--train",
            str(train),
            "--test",
            str(test),
            "--output",
            str(tmp_path / "o.csv"),
            "--manifest-output",
            str(manifest_path),
        ],
    )

    assert sparkov_build.main() == 0
    assert (
        json.loads(manifest_path.read_text(encoding="utf-8"))["quality_checks"][
            "passed"
        ]
        is True
    )
    assert "Wrote sanitised manifest" in capsys.readouterr().out


def test_command_line_reports_missing_files_and_bad_data(
    sparkov_build, tmp_path, monkeypatch, capsys
) -> None:
    """A missing input exits 2 and a failed quality gate exits 1, both with a clear message."""
    train, test = write_source_files(tmp_path, defect="negative_amount")
    base = ["build", "--output", str(tmp_path / "o.csv")]

    monkeypatch.setattr(
        sys, "argv", [*base, "--train", str(tmp_path / "nope.csv"), "--test", str(test)]
    )
    assert sparkov_build.main() == 2

    monkeypatch.setattr(
        sys, "argv", [*base, "--train", str(train), "--test", str(test)]
    )
    assert sparkov_build.main() == 1
    assert "Quality check failed" in capsys.readouterr().out
