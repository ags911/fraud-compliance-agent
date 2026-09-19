"""Evaluation reports trade-offs on hand-checkable inputs and selects nothing.

The metric tests use small arrays whose expected values can be derived by hand,
so a change in behaviour is visible rather than absorbed into a model's noise.
"""

import numpy as np
import pandas as pd
import pytest
from modelling_fixtures import TINY_CONTRACT, tiny_dataset

from modelling.config import EvaluationConfig, ThresholdSweepConfig
from modelling.evaluation import (
    aggregate_metrics,
    evaluate_models,
    held_out_target,
    reliability_curve,
    slice_metrics,
    threshold_grid,
    threshold_sweep,
)
from modelling.features import split_partitions

SWEEP = EvaluationConfig(
    threshold_sweep=ThresholdSweepConfig(start=0.05, stop=1.0, step=0.05),
    reliability_bins=10,
)


def test_a_perfect_ranking_scores_as_expected() -> None:
    """A separable example gives areas of one and a small Brier score."""
    y_true = pd.Series([0, 0, 1, 1])
    scores = np.array([0.1, 0.2, 0.8, 0.9])

    metrics = aggregate_metrics(y_true, scores)

    assert metrics["pr_auc"] == pytest.approx(1.0)
    assert metrics["roc_auc"] == pytest.approx(1.0)
    assert metrics["brier_score"] == pytest.approx(
        np.mean((scores - y_true.to_numpy()) ** 2)
    )


def test_a_reversed_ranking_is_reported_as_such() -> None:
    """The metrics are not silently corrected when a model ranks backwards."""
    y_true = pd.Series([0, 0, 1, 1])
    scores = np.array([0.9, 0.8, 0.2, 0.1])

    assert aggregate_metrics(y_true, scores)["roc_auc"] == pytest.approx(0.0)


def test_the_threshold_grid_comes_from_the_configuration() -> None:
    """The reported thresholds are the configured candidates, nothing more."""
    grid = threshold_grid(SWEEP.threshold_sweep)

    assert len(grid) == 19
    assert grid[0] == pytest.approx(0.05)
    assert grid[-1] == pytest.approx(0.95)


def test_the_sweep_reports_one_row_per_threshold_and_selects_none() -> None:
    """Each row is a trade-off, and no row is marked as chosen."""
    y_true = pd.Series([0, 0, 1, 1])
    scores = np.array([0.1, 0.6, 0.7, 0.9])

    rows = threshold_sweep(y_true, scores, SWEEP)

    assert len(rows) == len(threshold_grid(SWEEP.threshold_sweep))
    assert set(rows[0]) == {
        "threshold",
        "precision",
        "recall",
        "false_positive_rate",
        "block_rate",
    }
    # At 0.65 the two highest scores are at or above the threshold: one is a
    # true positive and one is a false positive out of two negatives.
    row = next(entry for entry in rows if entry["threshold"] == 0.65)
    assert row["precision"] == pytest.approx(1.0)
    assert row["recall"] == pytest.approx(1.0)
    assert row["false_positive_rate"] == pytest.approx(0.0)
    assert row["block_rate"] == pytest.approx(0.5)


def test_recall_and_block_rate_fall_as_the_threshold_rises() -> None:
    """The sweep is monotonic in the direction a reviewer expects."""
    y_true = pd.Series([0, 1, 0, 1, 0, 1])
    scores = np.array([0.05, 0.35, 0.45, 0.65, 0.75, 0.95])

    rows = threshold_sweep(y_true, scores, SWEEP)
    recalls = [row["recall"] for row in rows]
    block_rates = [row["block_rate"] for row in rows]

    assert recalls == sorted(recalls, reverse=True)
    assert block_rates == sorted(block_rates, reverse=True)


def test_a_partition_without_negatives_reports_no_false_positive_rate() -> None:
    """An undefined rate is NaN rather than a misleading zero."""
    y_true = pd.Series([1, 1, 1])
    scores = np.array([0.2, 0.6, 0.9])

    rows = threshold_sweep(y_true, scores, SWEEP)

    assert all(np.isnan(row["false_positive_rate"]) for row in rows)


def test_slice_metrics_skip_a_single_class_slice() -> None:
    """A slice with one outcome is omitted, not reported with an undefined area."""
    frame = pd.DataFrame({"band": ["low", "low", "high", "high"]})
    y_true = pd.Series([0, 1, 1, 1])
    scores = np.array([0.1, 0.9, 0.7, 0.8])

    rows = slice_metrics(frame, "band", y_true, scores)

    assert [row["value"] for row in rows] == ["low"]
    assert rows[0]["count"] == 2
    assert rows[0]["prevalence"] == pytest.approx(0.5)


def test_the_reliability_curve_bins_scores_without_calibrating_them() -> None:
    """Empty bins are dropped and the observed rate is the bin's own mean."""
    y_true = pd.Series([0, 0, 1, 1])
    scores = np.array([0.05, 0.05, 0.95, 0.95])

    mean_prediction, observed_rate = reliability_curve(y_true, scores, bins=10)

    assert len(mean_prediction) == 2
    assert mean_prediction[0] == pytest.approx(0.05)
    assert observed_rate.tolist() == [0.0, 1.0]


def test_the_evaluation_shape_matches_the_report(repository_root) -> None:
    """Each model reports metrics, a sweep, and slices for every declared slice."""
    partitions = split_partitions(tiny_dataset(), TINY_CONTRACT)
    target = held_out_target(partitions)
    scores = {"stand_in_model": np.linspace(0.1, 0.9, len(target))}

    evaluation = evaluate_models(partitions, scores, SWEEP)

    assert set(evaluation) == {"stand_in_model"}
    result = evaluation["stand_in_model"]
    assert set(result) == {"metrics", "threshold_sweep", "slice_metrics"}
    assert set(result["metrics"]) == {"pr_auc", "roc_auc", "brier_score"}
    assert {row["slice"] for row in result["slice_metrics"]} == set(
        TINY_CONTRACT.slice_columns
    )


def test_the_held_out_target_aligns_with_model_scores() -> None:
    """Scores are positional, so the target must be reindexed to match."""
    partitions = split_partitions(tiny_dataset(), TINY_CONTRACT)

    target = held_out_target(partitions)

    assert list(target.index) == list(range(len(partitions.test)))
    assert target.tolist() == partitions.test[TINY_CONTRACT.target_column].tolist()
