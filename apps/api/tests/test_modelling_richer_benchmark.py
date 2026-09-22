"""The richer-feature benchmark keeps the test partition untouched until the end.

Data-path tests use a seeded synthetic frame, never the real Sparkov corpus.
They pin the safeguards a strong-looking score most needs: the partitions match
the accepted benchmark, selection never sees the test rows, calibration uses
rows selection did not, and the report carries no identifier or threshold.
"""

import dataclasses
import json

import numpy as np
import pandas as pd
import pytest

from modelling.report import digest_report
from modelling.richer_benchmark import (
    richer_report_path,
    assign_partitions,
    expand_group_columns,
    load_richer_config,
    precision_at_top_share,
    recall_at_false_positive_rate,
    run_experiment,
    split_tuning_halves,
)


def _synthetic_frame(rows: int = 20000, seed: int = 7) -> pd.DataFrame:
    """Return a time-ordered raw-like frame whose fraud is partly learnable."""
    rng = np.random.default_rng(seed)
    start = pd.Timestamp("2020-01-01", tz="UTC")
    seconds = np.sort(rng.integers(0, 60 * 60 * 24 * 240, rows))
    event_time = start + pd.to_timedelta(seconds, unit="s")
    category = rng.choice(["food", "shopping_net", "travel"], rows)
    amount = np.round(rng.lognormal(3.5, 1.0, rows), 2)
    night = event_time.hour.isin([0, 1, 2, 3, 22, 23])
    # Fraud is likelier for large, late, online purchases, plus a little noise.
    logit = -5 + 1.6 * (category == "shopping_net") + 1.5 * night + 0.006 * amount
    fraud = rng.random(rows) < 1 / (1 + np.exp(-logit))
    frame = pd.DataFrame(
        {
            "event_time": event_time,
            "card": rng.integers(0, 60, rows),
            "merchant": rng.integers(0, 40, rows),
            "category": category,
            "amount": amount,
            "is_fraud": fraud.astype("int8"),
        }
    )
    # The last quarter of rows plays the separate, later test file.
    frame["source"] = np.where(np.arange(rows) >= int(rows * 0.75), "test", "train")
    return frame


def _small_config(repository_root):
    """Return the committed config shrunk so the whole run takes seconds."""
    config = load_richer_config(repository_root)
    search = dict(config.search)
    search.update(
        maximum_trees=40,
        early_stopping_rounds=10,
        n_jobs=1,
        grid=[
            {"max_depth": 3, "min_child_weight": 1, "scale_pos_weight_mode": "none"},
            {
                "max_depth": 4,
                "min_child_weight": 1,
                "scale_pos_weight_mode": "sqrt_ratio",
            },
        ],
    )
    fit_checks = dict(config.fit_checks, train_curve_sample_rows=2000)
    return dataclasses.replace(
        config,
        cutpoint=pd.Timestamp("2020-04-20", tz="UTC"),
        expected_partition_counts=None,
        search=search,
        fit_checks=fit_checks,
    )


def test_the_committed_candidate_config_is_proposed_and_offline(
    repository_root,
) -> None:
    """The config cannot be mistaken for an accepted or runtime one."""
    config = load_richer_config(repository_root)
    document = json.loads(
        (
            repository_root
            / "config"
            / "fast-path-model-richer-features.v2.candidate.json"
        ).read_text(encoding="utf-8")
    )

    assert document["status"] == "proposed"
    assert "never read by the served API" in document["effective_scope"]
    assert config.expected_partition_counts == {
        "train": 1037340,
        "calibration": 259335,
        "test": 555719,
    }
    assert "threshold" not in json.dumps(document["search"]).lower()


def test_partitions_follow_the_accepted_chronological_rule() -> None:
    """The test file is the test partition; the train file splits at the cutpoint."""
    cutpoint = pd.Timestamp("2020-03-06T07:15:17+00:00")
    source = pd.Series(["train", "train", "train", "test"])
    times = pd.Series(
        pd.to_datetime(
            [
                "2020-03-06T07:15:16",
                "2020-03-06T07:15:17",  # equal to the cutpoint stays in train
                "2020-03-06T07:15:18",
                "2020-01-01T00:00:00",  # the test file wins over its timestamp
            ],
            utc=True,
        )
    )

    assert assign_partitions(source, times, cutpoint).tolist() == [
        "train",
        "train",
        "calibration",
        "test",
    ]


def test_tuning_halves_are_chronological_and_disjoint() -> None:
    """Selection uses the earlier half and calibration only the later half."""
    times = pd.Series(pd.date_range("2020-01-01", periods=10, freq="D", tz="UTC"))
    selection, calibration = split_tuning_halves(times, 0.5)

    assert selection.sum() == 5 and calibration.sum() == 5
    assert not (selection & calibration).any()
    assert times[selection].max() < times[calibration].min()


def test_every_feature_belongs_to_exactly_one_group() -> None:
    """A feature outside every group, or in two, would corrupt the ablation."""
    groups = {"a": ("x", "y_*"), "b": ("z",)}
    assert expand_group_columns(groups, ["x", "y_1", "y_2", "z"]) == {
        "a": ["x", "y_1", "y_2"],
        "b": ["z"],
    }
    with pytest.raises(ValueError, match="belongs to no group"):
        expand_group_columns(groups, ["x", "orphan"])
    with pytest.raises(ValueError, match="more than one group"):
        expand_group_columns({"a": ("x",), "b": ("x",)}, ["x"])


def test_rank_metrics_match_hand_computed_values() -> None:
    """Recall at a false-positive budget and top-share precision are exact."""
    y = np.array([1, 0, 1, 0, 0, 0, 0, 0, 0, 0])
    scores = np.array([0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1, 0.0])

    # Eight negatives: one false positive (12.5%) is allowed at 20%, none at 10%.
    assert recall_at_false_positive_rate(y, scores, 0.2) == pytest.approx(1.0)
    assert recall_at_false_positive_rate(y, scores, 0.1) == pytest.approx(0.5)
    # The top 20% is two rows: one fraud and one non-fraud.
    assert precision_at_top_share(y, scores, 0.2) == pytest.approx(0.5)


def test_experiment_report_is_complete_honest_and_sanitised(repository_root) -> None:
    """One small end-to-end run produces every fit check without leaking."""
    config = _small_config(repository_root)
    report = run_experiment(_synthetic_frame(), config, reference=None)

    checks = report["fit_checks"]
    for key in (
        "partition_metrics",
        "learning_curve",
        "shuffled_label_control",
        "monthly_stability",
        "ablation",
        "calibration",
        "importance_by_group",
    ):
        assert key in checks
    assert report["status"] == "proposed"
    assert "not a production fraud-performance claim" in " ".join(report["limitations"])

    # The learnable synthetic fraud is found, and a shuffled label is not.
    test_metrics = checks["partition_metrics"]["test"]
    assert test_metrics["pr_auc"] > 2 * test_metrics["prevalence"]
    control = checks["shuffled_label_control"]
    assert control["pr_auc"] < 3 * control["prevalence"]

    # Selection and calibration used different, earlier rows than the test.
    partition_counts = report["partition_counts"]
    assert partition_counts["test"] > 0 and partition_counts["selection"] > 0
    assert partition_counts["calibration_fit"] > 0

    # Nothing identifying or policy-like reaches the report.
    text = json.dumps(report).lower()
    for forbidden in (
        "cc_num",
        "merchant_name",
        "selected_threshold",
        "operating_threshold",
    ):
        assert forbidden not in text


def test_the_test_partition_cannot_influence_selection(repository_root) -> None:
    """Changing only test labels leaves the selected configuration unchanged."""
    config = _small_config(repository_root)
    frame = _synthetic_frame()
    flipped = frame.copy()
    test_rows = flipped["source"] == "test"
    flipped.loc[test_rows, "is_fraud"] = 1 - flipped.loc[test_rows, "is_fraud"]

    original = run_experiment(frame, config, reference=None)
    changed = run_experiment(flipped, config, reference=None)

    assert original["selection"]["chosen_index"] == changed["selection"]["chosen_index"]
    assert original["selection"]["trials"] == changed["selection"]["trials"]


def test_the_committed_richer_report_matches_its_config_and_stays_proposed(
    repository_root,
) -> None:
    """A changed config or a hand-edited report is caught, as for the v1 report."""
    report = json.loads(richer_report_path(repository_root).read_text(encoding="utf-8"))
    config = load_richer_config(repository_root)

    assert report["status"] == "proposed"
    assert report["config_sha256"] == config.config_sha256, (
        "The candidate config changed: regenerate and re-review the report."
    )
    assert report["report_sha256"] == digest_report(report)
    assert (
        report["partition_counts"]["test"] == config.expected_partition_counts["test"]
    )
    # The report may claim only what its own controls support.
    control = report["fit_checks"]["shuffled_label_control"]
    assert control["pr_auc"] < 2 * control["prevalence"]
    assert "not a production fraud-performance claim" in " ".join(report["limitations"])
    assert not {"threshold", "selected_threshold"} & set(report)
