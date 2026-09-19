"""Held-out evaluation: aggregate metrics, threshold trade-offs, and slices.

Model quality and business policy are kept apart on purpose. PR-AUC, ROC-AUC,
and the Brier score describe score quality; the threshold sweep describes what a
policy would trade at each cut-off. No operating threshold is selected here, and
no function in this module may be read as choosing one.
"""

from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd
from sklearn.metrics import (
    average_precision_score,
    brier_score_loss,
    precision_score,
    recall_score,
    roc_auc_score,
)

from modelling.config import EvaluationConfig, ThresholdSweepConfig
from modelling.features import Partitions


def aggregate_metrics(y_true: pd.Series, scores: np.ndarray) -> dict[str, float]:
    """Return held-out score-quality metrics.

    Args:
        y_true: Binary outcomes of the scored partition.
        scores: Positive-class probabilities in the same row order.

    Returns:
        PR-AUC (the headline under class imbalance), ROC-AUC, and the Brier
        score, which reports probability quality rather than ranking.

    Raises:
        ValueError: If `y_true` has one class, which leaves the areas undefined.
    """
    return {
        "pr_auc": float(average_precision_score(y_true, scores)),
        "roc_auc": float(roc_auc_score(y_true, scores)),
        "brier_score": float(brier_score_loss(y_true, scores)),
    }


def threshold_grid(sweep: ThresholdSweepConfig) -> np.ndarray:
    """Return the configured candidate thresholds.

    Args:
        sweep: Inclusive-start, exclusive-stop grid parameters.

    Returns:
        The thresholds to report. They are candidates for a later, independent
        policy decision; none of them is selected here.
    """
    return np.arange(sweep.start, sweep.stop, sweep.step)


def threshold_sweep(
    y_true: pd.Series, scores: np.ndarray, config: EvaluationConfig
) -> list[dict[str, float]]:
    """Describe score-policy trade-offs without selecting an operating threshold.

    Args:
        y_true: Binary outcomes of the scored partition.
        scores: Positive-class probabilities in the same row order.
        config: Supplies the candidate threshold grid.

    Returns:
        One row per threshold with precision, recall, false-positive rate, and
        the share of rows at or above the threshold. `false_positive_rate` is
        NaN when the partition has no negative rows.
    """
    rows: list[dict[str, float]] = []
    negatives = y_true == 0
    negative_count = int(negatives.sum())
    for threshold in threshold_grid(config.threshold_sweep):
        prediction = scores >= threshold
        false_positive_rate = (
            float((prediction & negatives.to_numpy()).sum() / negative_count)
            if negative_count
            else float("nan")
        )
        rows.append(
            {
                "threshold": round(float(threshold), 2),
                "precision": float(
                    precision_score(y_true, prediction, zero_division=0)
                ),
                "recall": float(recall_score(y_true, prediction, zero_division=0)),
                "false_positive_rate": false_positive_rate,
                # Not a block rate in the product sense: nothing is blocked. It
                # is the share of rows a policy at this threshold would touch.
                "block_rate": float(prediction.mean()),
            }
        )
    return rows


def slice_metrics(
    frame: pd.DataFrame, slice_column: str, y_true: pd.Series, scores: np.ndarray
) -> list[dict[str, Any]]:
    """Compute aggregate diagnostics per declared slice.

    Args:
        frame: Scored partition with a positional index matching `scores`.
        slice_column: Declared reporting slice.
        y_true: Binary outcomes with the same positional index.
        scores: Positive-class probabilities in the same row order.

    Returns:
        One row per slice value, with its size, prevalence, and areas. A slice
        holding a single class is skipped rather than reported with an
        undefined area; a skipped slice is absent from the result.
    """
    result: list[dict[str, Any]] = []
    for value, indices in frame.groupby(slice_column, dropna=False).groups.items():
        y_slice = y_true.loc[indices]
        score_slice = scores[list(indices)]
        if y_slice.nunique() != 2:
            continue
        result.append(
            {
                "slice": slice_column,
                "value": str(value),
                "count": len(indices),
                "prevalence": float(y_slice.mean()),
                "pr_auc": float(average_precision_score(y_slice, score_slice)),
                "roc_auc": float(roc_auc_score(y_slice, score_slice)),
            }
        )
    return result


def reliability_curve(
    y_true: pd.Series, scores: np.ndarray, bins: int
) -> tuple[np.ndarray, np.ndarray]:
    """Return populated equal-width score bins for a reliability diagnostic.

    Args:
        y_true: Binary outcomes of the scored partition.
        scores: Positive-class probabilities in the same row order.
        bins: Number of equal-width bins across the unit interval.

    Returns:
        The mean predicted score and the observed outcome rate of each populated
        bin. Empty bins are dropped, so the arrays can be shorter than `bins`.
        This describes calibration; it does not calibrate the model.
    """
    table = pd.DataFrame({"outcome": y_true.to_numpy(), "score": scores})
    table["bin"] = pd.cut(
        table["score"], bins=np.linspace(0, 1, bins + 1), include_lowest=True
    )
    grouped = table.groupby("bin", observed=True).agg(
        mean_prediction=("score", "mean"),
        observed_rate=("outcome", "mean"),
    )
    return grouped["mean_prediction"].to_numpy(), grouped["observed_rate"].to_numpy()


def held_out_target(partitions: Partitions) -> pd.Series:
    """Return the test target with a positional index matching model scores."""
    return partitions.target(partitions.test).reset_index(drop=True)


def evaluate_models(
    partitions: Partitions,
    model_scores: dict[str, np.ndarray],
    config: EvaluationConfig,
) -> dict[str, dict[str, Any]]:
    """Evaluate every scored model on the held-out partition.

    Args:
        partitions: Split dataset; only the test partition is evaluated.
        model_scores: Test-partition scores keyed by model id.
        config: Threshold grid and reliability-bin count.

    Returns:
        Per model, its aggregate metrics, threshold sweep, and slice metrics in
        the shape the release report records. No threshold, calibration, or
        release decision is part of the result.
    """
    target = held_out_target(partitions)
    test_frame = partitions.test.reset_index(drop=True)
    return {
        name: {
            "metrics": aggregate_metrics(target, scores),
            "threshold_sweep": threshold_sweep(target, scores, config),
            "slice_metrics": [
                metric
                for slice_column in partitions.contract.slice_columns
                for metric in slice_metrics(test_frame, slice_column, target, scores)
            ],
        }
        for name, scores in model_scores.items()
    }
