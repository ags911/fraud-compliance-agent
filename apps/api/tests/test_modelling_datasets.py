"""Dataset loading refuses anything the accepted contract does not describe.

Approved mode is the only path that reads real data, so its contract check,
checksum check, and schema validation are the boundary these tests hold.
"""

import hashlib
import json

import pandas as pd
import pytest

from modelling.config import load_training_config
from modelling.datasets import (
    REQUIRED_ACCEPTED_FIELDS,
    SYNTHETIC_DATASET_DIGEST,
    contract_from_manifest,
    contract_path,
    load_accepted_manifest,
    load_approved_dataset,
    synthetic_contract,
    synthetic_mechanics_dataset,
    validate_dataset,
)


@pytest.fixture
def accepted_manifest(repository_root) -> dict:
    """Return the committed accepted training contract."""
    return json.loads(contract_path(repository_root).read_text(encoding="utf-8"))


def write_manifest(root, manifest: dict) -> None:
    """Write a training contract into a temporary repository root."""
    destination = contract_path(root)
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(manifest), encoding="utf-8")


def pinned_dataset(root, manifest: dict, frame: pd.DataFrame) -> dict:
    """Write `frame` at the manifest's declared path and pin its real digest."""
    dataset_path = root / manifest["dataset_path"]
    dataset_path.parent.mkdir(parents=True, exist_ok=True)
    frame.to_csv(dataset_path, index=False)
    digest = hashlib.sha256(dataset_path.read_bytes()).hexdigest()
    return {**manifest, "dataset_sha256": digest}


def test_the_committed_contract_is_accepted(repository_root) -> None:
    """The real contract loads through the same guard an approved run uses."""
    manifest = load_accepted_manifest(repository_root)

    assert manifest["approval_status"] == "accepted"
    assert REQUIRED_ACCEPTED_FIELDS <= set(manifest)


def test_a_missing_contract_stops_an_approved_run(tmp_path) -> None:
    """Approved mode cannot infer a contract that does not exist."""
    with pytest.raises(RuntimeError, match="Missing accepted model-training contract"):
        load_accepted_manifest(tmp_path)


def test_an_unaccepted_contract_is_refused(tmp_path, accepted_manifest) -> None:
    """A drafted contract is not an approval."""
    write_manifest(tmp_path, {**accepted_manifest, "approval_status": "proposed"})

    with pytest.raises(RuntimeError, match="not accepted or is incomplete"):
        load_accepted_manifest(tmp_path)


def test_an_incomplete_contract_names_what_is_missing(
    tmp_path, accepted_manifest
) -> None:
    """A partial contract fails with the absent field named, not a default."""
    incomplete = {
        key: value for key, value in accepted_manifest.items() if key != "slice_columns"
    }
    write_manifest(tmp_path, incomplete)

    with pytest.raises(RuntimeError, match="slice_columns"):
        load_accepted_manifest(tmp_path)


def test_the_contract_becomes_a_dataset_contract(accepted_manifest) -> None:
    """Every declared column and partition survives the conversion unchanged."""
    contract = contract_from_manifest(accepted_manifest)

    assert contract.target_column == accepted_manifest["target_column"]
    assert list(contract.feature_columns) == accepted_manifest["feature_columns"]
    assert list(contract.slice_columns) == accepted_manifest["slice_columns"]
    assert contract.dataset_sha256 == accepted_manifest["dataset_sha256"]
    assert contract.partitions == (
        accepted_manifest["train_partition"],
        accepted_manifest["calibration_partition"],
        accepted_manifest["test_partition"],
    )


def test_an_approved_dataset_must_match_its_checksum(
    tmp_path, accepted_manifest
) -> None:
    """A dataset that is not the accepted one cannot be substituted silently."""
    frame = pd.DataFrame({"a": [1, 2, 3]})
    manifest = pinned_dataset(tmp_path, accepted_manifest, frame)

    loaded = load_approved_dataset(manifest, tmp_path)
    assert list(loaded["a"]) == [1, 2, 3]

    with pytest.raises(RuntimeError, match="checksum does not match"):
        load_approved_dataset({**manifest, "dataset_sha256": "0" * 64}, tmp_path)


def test_an_absent_approved_dataset_stops_the_run(tmp_path, accepted_manifest) -> None:
    """A missing local corpus is not replaced with anything else."""
    with pytest.raises(RuntimeError, match="unavailable locally"):
        load_approved_dataset(accepted_manifest, tmp_path)


def test_only_csv_input_is_accepted(tmp_path, accepted_manifest) -> None:
    """Another format needs an extended contract, not a code change here."""
    manifest = {**accepted_manifest, "dataset_path": "data/processed/corpus.parquet"}
    dataset_path = tmp_path / manifest["dataset_path"]
    dataset_path.parent.mkdir(parents=True, exist_ok=True)
    dataset_path.write_bytes(b"not a csv")

    with pytest.raises(RuntimeError, match="CSV input only"):
        load_approved_dataset(manifest, tmp_path)


def test_the_synthetic_fixture_is_reproducible(repository_root) -> None:
    """The same configuration and seed produce the same frame every run."""
    config = load_training_config(repository_root)
    fixture = config.synthetic_fixture

    first = synthetic_mechanics_dataset(fixture, config.random_seed)
    second = synthetic_mechanics_dataset(fixture, config.random_seed)

    pd.testing.assert_frame_equal(first, second)
    assert len(first) == fixture.rows
    assert first["partition"].value_counts().to_dict() == {
        "train": fixture.train_rows,
        "calibration": fixture.calibration_rows,
        "test": fixture.rows - fixture.train_rows - fixture.calibration_rows,
    }
    # Both classes must be present, or the mechanics run cannot evaluate.
    assert set(first["target"].unique()) == {0, 1}


def test_the_synthetic_fixture_matches_its_contract(repository_root) -> None:
    """The fixture satisfies the schema the synthetic contract declares."""
    config = load_training_config(repository_root)
    frame = synthetic_mechanics_dataset(config.synthetic_fixture, config.random_seed)

    validate_dataset(frame, synthetic_contract())

    assert synthetic_contract().dataset_sha256 == SYNTHETIC_DATASET_DIGEST


def test_a_fixture_without_a_test_partition_is_refused(repository_root) -> None:
    """A misconfigured split fails rather than evaluating on training rows."""
    config = load_training_config(repository_root)
    fixture = config.synthetic_fixture
    broken = type(fixture)(
        **{
            **fixture.__dict__,
            "train_rows": fixture.rows,
            "calibration_rows": 0,
        }
    )

    with pytest.raises(ValueError, match="no test partition"):
        synthetic_mechanics_dataset(broken, config.random_seed)


def test_validation_names_a_missing_column(repository_root) -> None:
    """A dataset missing a declared feature stops the run with that name."""
    config = load_training_config(repository_root)
    frame = synthetic_mechanics_dataset(
        config.synthetic_fixture, config.random_seed
    ).drop(columns=["velocity_6h"])

    with pytest.raises(RuntimeError, match="velocity_6h"):
        validate_dataset(frame, synthetic_contract())


def test_validation_names_a_missing_partition(repository_root) -> None:
    """An incomplete split is refused instead of being merged or resampled."""
    config = load_training_config(repository_root)
    frame = synthetic_mechanics_dataset(config.synthetic_fixture, config.random_seed)
    frame = frame.loc[frame["partition"] != "calibration"]

    with pytest.raises(RuntimeError, match="calibration"):
        validate_dataset(frame, synthetic_contract())
