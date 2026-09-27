"""Richer-feature benchmark: selection, calibration, and model-fit checks.

A strong score on simulated fraud is easy to misread, so this module is built
around the checks that make it believable or expose it. Model selection sees
only the first chronological half of the calibration partition; probability
calibration uses only the second half; the test partition is scored once, after
both. The fit checks then ask whether the result is genuine learning
(train-versus-held-out gaps, a learning curve, a shuffled-label control) and
where it comes from (feature-group ablations, importance, month-by-month
stability).

Results are Sparkov synthetic benchmark mechanics. Nothing here selects an
operating threshold, promotes a model, or scores a payment, and the served API
must not import this module.
"""

from __future__ import annotations

import fnmatch
import hashlib
import json
import math
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from sklearn.isotonic import IsotonicRegression
from sklearn.metrics import (
    average_precision_score,
    brier_score_loss,
    log_loss,
    roc_auc_score,
    roc_curve,
)
from xgboost import XGBClassifier

from modelling.richer_features import build_features

CONFIG_RELATIVE_PATH = (
    Path("config") / "fast-path-model-richer-features.v2.candidate.json"
)
REPORT_RELATIVE_PATH = (
    Path("docs") / "proposals" / "fast-path-model-richer-features.proposed.json"
)
REFERENCE_RELATIVE_PATH = (
    Path("docs") / "proposals" / "fast-path-model-release.candidate.json"
)

LIMITATIONS = (
    "Results are Sparkov synthetic benchmark mechanics and are not a production fraud-performance claim.",
    "Sparkov fraud is produced by a simulator: a high score shows the model learned that generator's patterns, not how it would perform on real fraud.",
    "The card and merchant history features have no established online equivalent, so none is approved for runtime.",
    "No operating threshold is selected and no model is promoted; this report is proposed evidence only.",
)
RECOMMENDATION = (
    "proposed — review the fit checks and feature availability before any decision"
)


@dataclass(frozen=True)
class RicherConfig:
    """The versioned, offline-only parameters of the richer-feature experiment."""

    config_version: str
    config_sha256: str
    random_seed: int
    cutpoint: pd.Timestamp
    expected_partition_counts: dict[str, int] | None
    tuning_fraction: float
    windows_seconds: tuple[int, ...]
    minimum_history: int
    mechanics_v1_columns: tuple[str, ...]
    groups: dict[str, tuple[str, ...]]
    search: dict[str, Any]
    calibration_method: str
    fit_checks: dict[str, Any]


def richer_report_path(repository_root: Path) -> Path:
    """Return where the proposed richer-feature report is written.

    Args:
        repository_root: Located monorepo root.

    Returns:
        A path that is deliberately not the reviewed release-candidate report,
        which only an approved-mode run of the accepted contract may write.
    """
    return repository_root / REPORT_RELATIVE_PATH


def load_richer_config(repository_root: Path) -> RicherConfig:
    """Load and validate the proposed richer-feature configuration.

    Args:
        repository_root: Located monorepo root.

    Returns:
        The parsed configuration, including a digest of the file's bytes.

    Raises:
        RuntimeError: If the file is missing, malformed, not marked `proposed`,
            or asks for a calibration method other than isotonic.

    Side effects:
        Reads one committed JSON file.
    """
    path = repository_root / CONFIG_RELATIVE_PATH
    try:
        raw = path.read_bytes()
        document = json.loads(raw)
        if document["status"] != "proposed":
            raise ValueError("the richer-feature config must stay proposed")
        if document["calibration"]["method"] != "isotonic":
            raise ValueError("only isotonic calibration is implemented")
        partitioning = document["partitioning"]
        features = document["features"]
        return RicherConfig(
            config_version=str(document["config_version"]),
            config_sha256=hashlib.sha256(raw).hexdigest(),
            random_seed=int(document["random_seed"]),
            cutpoint=pd.Timestamp(partitioning["chronological_train_cutpoint"]),
            expected_partition_counts={
                key: int(value)
                for key, value in partitioning["expected_partition_counts"].items()
            },
            tuning_fraction=float(partitioning["tuning_fraction_of_calibration"]),
            windows_seconds=tuple(int(w) for w in features["windows_seconds"]),
            minimum_history=int(features["minimum_history_transactions"]),
            mechanics_v1_columns=tuple(features["mechanics_v1_columns"]),
            groups={k: tuple(v) for k, v in features["groups"].items()},
            search=dict(document["search"]),
            calibration_method=str(document["calibration"]["method"]),
            fit_checks=dict(document["fit_checks"]),
        )
    except (OSError, KeyError, TypeError, ValueError) as error:
        raise RuntimeError(
            f"The richer-feature configuration at {CONFIG_RELATIVE_PATH} is unusable."
        ) from error


def assign_partitions(
    source: pd.Series, event_time: pd.Series, cutpoint: pd.Timestamp
) -> pd.Series:
    """Assign each row to the accepted benchmark's train, calibration or test.

    Args:
        source: Which file each row came from, `train` or `test`.
        event_time: UTC timestamp of each row.
        cutpoint: The accepted chronological train/calibration boundary.

    Returns:
        `test` for every row of the test file, and for the train file `train`
        up to and including the cutpoint and `calibration` after it.
    """
    is_test = source == "test"
    early = event_time <= cutpoint
    partition = np.where(is_test, "test", np.where(early, "train", "calibration"))
    return pd.Series(partition, index=source.index)


def split_tuning_halves(
    event_time: pd.Series, fraction: float
) -> tuple[np.ndarray, np.ndarray]:
    """Split time-ordered calibration rows into selection and calibration-fit sets.

    Args:
        event_time: Timestamps of the calibration partition, in time order.
        fraction: Share of the earliest rows used for model selection.

    Returns:
        Two disjoint boolean arrays over the input rows. The earlier rows are
        for selection and the later rows for fitting the probability
        calibration, so neither reuses the other's rows.
    """
    count = len(event_time)
    boundary = round(count * fraction)
    selection = np.zeros(count, dtype=bool)
    selection[:boundary] = True
    return selection, ~selection


def expand_group_columns(
    groups: dict[str, tuple[str, ...]], columns: list[str]
) -> dict[str, list[str]]:
    """Resolve feature-group patterns into concrete column lists.

    Args:
        groups: Group name to exact column names or `prefix*` patterns.
        columns: Every feature column that exists.

    Returns:
        Group name to its columns, in the order of `columns`.

    Raises:
        ValueError: If a column belongs to no group or to more than one, since
            an ablation over incomplete or overlapping groups would mislead.
    """
    resolved: dict[str, list[str]] = {name: [] for name in groups}
    for column in columns:
        owners = [
            name
            for name, patterns in groups.items()
            if any(fnmatch.fnmatchcase(column, pattern) for pattern in patterns)
        ]
        if not owners:
            raise ValueError(f"Feature {column!r} belongs to no group.")
        if len(owners) > 1:
            raise ValueError(f"Feature {column!r} belongs to more than one group.")
        resolved[owners[0]].append(column)
    return resolved


def recall_at_false_positive_rate(
    y_true: np.ndarray, scores: np.ndarray, rate: float
) -> float:
    """Return the best recall reachable without exceeding a false-positive rate.

    Args:
        y_true: Binary outcomes.
        scores: Positive-class scores in the same order.
        rate: The false-positive-rate budget, for example 0.01.

    Returns:
        Highest true-positive rate on the ROC curve at or under the budget. This
        summarises ranking quality; it is not a chosen operating point.
    """
    false_positive_rate, true_positive_rate, _ = roc_curve(y_true, scores)
    return float(true_positive_rate[false_positive_rate <= rate].max())


def precision_at_top_share(
    y_true: np.ndarray, scores: np.ndarray, share: float
) -> float:
    """Return the fraud rate among the highest-scored share of rows.

    Args:
        y_true: Binary outcomes.
        scores: Positive-class scores in the same order.
        share: Fraction of rows to inspect, for example 0.005.

    Returns:
        Share of the top-scored rows that are positive. Rank-based only; no
        score threshold is implied.
    """
    count = max(1, math.ceil(len(scores) * share))
    top = np.argsort(-scores, kind="stable")[:count]
    return float(np.asarray(y_true)[top].mean())


def _iteration_range(model: XGBClassifier) -> tuple[int, int] | None:
    """Return the early-stopped tree range, or None when all trees are used."""
    try:
        return (0, int(model.best_iteration) + 1)
    except AttributeError:
        return None


def _score(model: XGBClassifier, features: pd.DataFrame) -> np.ndarray:
    """Return positive-class probabilities from a fitted model's best trees."""
    return model.predict_proba(features, iteration_range=_iteration_range(model))[:, 1]


def _quality(y_true: np.ndarray, scores: np.ndarray) -> dict[str, float]:
    """Return score-quality metrics for one partition."""
    return {
        "rows": len(y_true),
        "positives": int(np.sum(y_true)),
        "prevalence": float(np.mean(y_true)),
        "pr_auc": float(average_precision_score(y_true, scores)),
        "roc_auc": float(roc_auc_score(y_true, scores)),
        "log_loss": float(log_loss(y_true, scores, labels=[0, 1])),
    }


def _params(
    entry: dict[str, Any], search: dict[str, Any], y_fit: np.ndarray, seed: int
) -> dict[str, Any]:
    """Return XGBoost keyword arguments for one grid entry."""
    positives = int(np.sum(y_fit))
    ratio = (len(y_fit) - positives) / positives
    weight = math.sqrt(ratio) if entry["scale_pos_weight_mode"] == "sqrt_ratio" else 1.0
    return {
        "objective": "binary:logistic",
        "eval_metric": "aucpr",
        "max_depth": int(entry["max_depth"]),
        "min_child_weight": float(entry["min_child_weight"]),
        "learning_rate": float(search["learning_rate"]),
        "subsample": float(search["subsample"]),
        "colsample_bytree": float(search["colsample_bytree"]),
        "scale_pos_weight": float(weight),
        "tree_method": str(search["tree_method"]),
        "n_jobs": int(search["n_jobs"]),
        "random_state": seed,
    }


def _fit(
    params: dict[str, Any],
    search: dict[str, Any],
    fit: tuple[pd.DataFrame, np.ndarray],
    evaluate: list[tuple[pd.DataFrame, np.ndarray]],
) -> XGBClassifier:
    """Fit with early stopping on the last evaluation set (the selection rows)."""
    model = XGBClassifier(
        n_estimators=int(search["maximum_trees"]),
        early_stopping_rounds=int(search["early_stopping_rounds"]),
        **params,
    )
    model.fit(fit[0], fit[1], eval_set=evaluate, verbose=False)
    return model


def _monthly(frame: pd.DataFrame, scores: np.ndarray) -> list[dict[str, Any]]:
    """Return held-out quality per calendar month, where both classes exist."""
    months = frame["event_time"].dt.strftime("%Y-%m").to_numpy()
    y_true = frame["is_fraud"].to_numpy()
    rows = []
    for month in sorted(set(months)):
        selected = months == month
        if len(set(y_true[selected])) < 2:
            continue
        rows.append({"month": month, **_quality(y_true[selected], scores[selected])})
    return rows


def _calibration_bins(
    y_true: np.ndarray, scores: np.ndarray, edges: list[float]
) -> list[dict[str, float]]:
    """Compare mean predicted and observed fraud rate across score quantiles."""
    cuts = np.quantile(scores, edges)
    rows = []
    for low_edge, high_edge, low, high in zip(
        edges[:-1], edges[1:], cuts[:-1], cuts[1:], strict=True
    ):
        inside = (scores >= low) & (
            scores <= high if high_edge == edges[-1] else scores < high
        )
        if inside.sum() == 0:
            continue
        rows.append(
            {
                "score_quantile_from": float(low_edge),
                "score_quantile_to": float(high_edge),
                "rows": int(inside.sum()),
                "mean_predicted": float(scores[inside].mean()),
                "observed_rate": float(np.asarray(y_true)[inside].mean()),
            }
        )
    return rows


def _learning_curve(model: XGBClassifier, points: int) -> list[dict[str, float | int]]:
    """Return sampled train and selection curves from the fitted model."""
    history = model.evals_result()
    train = history["validation_0"]["aucpr"]
    tuning = history["validation_1"]["aucpr"]
    indices = sorted(
        {int(i) for i in np.linspace(0, len(tuning) - 1, min(points, len(tuning)))}
    )
    return [
        {
            "tree": i + 1,
            "train_sample_pr_auc": float(train[i]),
            "selection_pr_auc": float(tuning[i]),
        }
        for i in indices
    ]


def _importance_by_group(
    model: XGBClassifier, groups: dict[str, list[str]]
) -> dict[str, Any]:
    """Return each group's share of total split gain, and the top features."""
    gain = model.get_booster().get_score(importance_type="gain")
    total = sum(gain.values()) or 1.0
    by_group = {
        name: float(sum(gain.get(column, 0.0) for column in columns) / total)
        for name, columns in groups.items()
    }
    top = sorted(gain.items(), key=lambda item: -item[1])[:8]
    return {
        "group_gain_share": by_group,
        "top_features": [
            {"feature": name, "gain_share": float(value / total)} for name, value in top
        ],
    }


def load_reference_metrics(repository_root: Path) -> dict[str, Any] | None:
    """Return the accepted four-feature benchmark's held-out metrics, if present.

    Args:
        repository_root: Located monorepo root.

    Returns:
        Model id to PR-AUC, ROC-AUC and Brier score from the committed release
        candidate, or `None` when the file is absent or has an unknown shape.

    Side effects:
        Reads one committed JSON file.
    """
    path = repository_root / REFERENCE_RELATIVE_PATH
    try:
        document = json.loads(path.read_text(encoding="utf-8"))
        return {
            name: {
                key: float(values["metrics"][key])
                for key in ("pr_auc", "roc_auc", "brier_score")
            }
            for name, values in document["models"].items()
        }
    except (OSError, KeyError, TypeError, ValueError):
        return None


def run_experiment(
    frame: pd.DataFrame,
    config: RicherConfig,
    reference: dict[str, Any] | None,
    git_revision: str = "unknown",
) -> dict[str, Any]:
    """Run selection, calibration, and every fit check; return a sanitised report.

    Args:
        frame: Time-ordered output of `load_raw_sparkov` (or an equivalent
            synthetic frame) with `source` and `is_fraud`.
        config: Proposed richer-feature configuration.
        reference: Accepted four-feature metrics to compare against, or `None`.
        git_revision: Revision recorded in the report.

    Returns:
        An aggregate-only report. It contains no row, identifier, model weight,
        or threshold.

    Raises:
        RuntimeError: If partition sizes differ from the accepted benchmark's
            (when the config declares them) or a partition lacks a class.

    Side effects:
        Fits several XGBoost models in memory. Nothing is written.
    """
    seed = config.random_seed
    search = config.search
    checks = config.fit_checks
    partition = assign_partitions(frame["source"], frame["event_time"], config.cutpoint)
    counts = partition.value_counts().to_dict()
    if config.expected_partition_counts is not None and counts != {
        **config.expected_partition_counts
    }:
        raise RuntimeError(
            "Partition sizes differ from the accepted benchmark; results would not be comparable."
        )

    categories = sorted(frame.loc[partition == "train", "category"].unique())
    features = build_features(
        frame, categories, config.windows_seconds, config.minimum_history
    )
    columns = list(features.columns)
    groups = expand_group_columns(config.groups, columns)
    y = frame["is_fraud"].to_numpy()

    train_index = np.flatnonzero((partition == "train").to_numpy())
    calibration_index = np.flatnonzero((partition == "calibration").to_numpy())
    test_index = np.flatnonzero((partition == "test").to_numpy())
    selection_flag, fit_flag = split_tuning_halves(
        frame["event_time"].iloc[calibration_index], config.tuning_fraction
    )
    selection_index = calibration_index[selection_flag]
    calibration_fit_index = calibration_index[fit_flag]
    for name, index in (
        ("train", train_index),
        ("selection", selection_index),
        ("calibration_fit", calibration_fit_index),
        ("test", test_index),
    ):
        if len(set(y[index])) < 2:
            raise RuntimeError(f"The {name} partition must contain both classes.")

    rng = np.random.default_rng(seed)
    sample_size = min(int(checks["train_curve_sample_rows"]), len(train_index))
    curve_index = np.sort(rng.choice(train_index, sample_size, replace=False))

    def take(index: np.ndarray, subset: list[str]) -> pd.DataFrame:
        return features.iloc[index][subset]

    def fit_on(
        subset: list[str], entry: dict[str, Any]
    ) -> tuple[XGBClassifier, dict[str, Any]]:
        params = _params(entry, search, y[train_index], seed)
        model = _fit(
            params,
            search,
            (take(train_index, subset), y[train_index]),
            [
                (take(curve_index, subset), y[curve_index]),
                (take(selection_index, subset), y[selection_index]),
            ],
        )
        return model, params

    # Selection uses the selection half only. The test rows are not read here.
    trials = []
    fitted = []
    for entry in search["grid"]:
        model, params = fit_on(columns, entry)
        selection_scores = _score(model, take(selection_index, columns))
        trials.append(
            {
                "max_depth": int(entry["max_depth"]),
                "min_child_weight": float(entry["min_child_weight"]),
                "scale_pos_weight_mode": entry["scale_pos_weight_mode"],
                "trees_kept": int(model.best_iteration) + 1,
                "selection_pr_auc": float(
                    average_precision_score(y[selection_index], selection_scores)
                ),
            }
        )
        fitted.append((model, params))
    chosen = int(np.argmax([trial["selection_pr_auc"] for trial in trials]))
    model, chosen_params = fitted[chosen]

    # Uncalibrated quality on every partition, for the train-versus-held-out gap.
    scores = {
        name: _score(model, take(index, columns))
        for name, index in (
            ("train", train_index),
            ("selection", selection_index),
            ("calibration_fit", calibration_fit_index),
            ("test", test_index),
        )
    }
    indexes = {
        "train": train_index,
        "selection": selection_index,
        "calibration_fit": calibration_fit_index,
        "test": test_index,
    }
    partition_metrics = {
        name: _quality(y[indexes[name]], scores[name]) for name in scores
    }

    # Calibration is fitted on rows selection never used, then applied to test.
    isotonic = IsotonicRegression(out_of_bounds="clip", y_min=0.0, y_max=1.0)
    isotonic.fit(scores["calibration_fit"], y[calibration_fit_index])
    calibrated = isotonic.predict(scores["test"])
    y_test = y[test_index]
    edges = list(checks["score_quantile_bins"])
    calibration = {
        "method": config.calibration_method,
        "test_brier_before": float(brier_score_loss(y_test, scores["test"])),
        "test_brier_after": float(brier_score_loss(y_test, calibrated)),
        "test_log_loss_before": float(log_loss(y_test, scores["test"], labels=[0, 1])),
        "test_log_loss_after": float(log_loss(y_test, calibrated, labels=[0, 1])),
        "bins_before": _calibration_bins(y_test, scores["test"], edges),
        "bins_after": _calibration_bins(y_test, calibrated, edges),
    }

    # Rank-based summaries only: no score cut-off is chosen.
    rank_summary = {
        "recall_at_false_positive_rate": {
            str(rate): recall_at_false_positive_rate(y_test, scores["test"], rate)
            for rate in checks["recall_at_false_positive_rate"]
        },
        "precision_in_top_share": {
            str(share): precision_at_top_share(y_test, scores["test"], share)
            for share in checks["top_share_precision"]
        },
    }

    # Ablation at the chosen settings: where does the gain come from?
    def ablate(subset: list[str]) -> dict[str, Any]:
        model_a, _ = fit_on(subset, _entry_of(trials[chosen]))
        test_scores = _score(model_a, take(test_index, subset))
        return {
            "features": len(subset),
            "trees_kept": int(model_a.best_iteration) + 1,
            "test_pr_auc": float(average_precision_score(y_test, test_scores)),
            "test_roc_auc": float(roc_auc_score(y_test, test_scores)),
        }

    cumulative: dict[str, Any] = {
        "mechanics_v1_four_features": ablate(list(config.mechanics_v1_columns))
    }
    running: list[str] = []
    for name, group_columns in groups.items():
        running = running + group_columns
        cumulative[f"cumulative_through_{name}"] = ablate(list(running))
    without = {
        name: ablate([c for c in columns if c not in set(group_columns)])
        for name, group_columns in groups.items()
    }

    # Shuffled-label control: the same pipeline on labels with no signal must
    # score at about the base rate, or something other than learning is at work.
    shuffled = np.random.default_rng(seed + 1).permutation(y[train_index])
    control_model = XGBClassifier(
        n_estimators=int(model.best_iteration) + 1, **chosen_params
    )
    control_model.fit(take(train_index, columns), shuffled, verbose=False)
    control_scores = control_model.predict_proba(take(test_index, columns))[:, 1]
    control = {
        "prevalence": float(np.mean(y_test)),
        "pr_auc": float(average_precision_score(y_test, control_scores)),
        "roc_auc": float(roc_auc_score(y_test, control_scores)),
    }

    return {
        "artifact": "fast-path-model-richer-features",
        "version": "0.1",
        "status": "proposed",
        "data_source": "Sparkov simulated credit-card transactions",
        "training_scope": "synthetic benchmark mechanics only; never production training, runtime scoring, or a fraud-performance claim",
        "config_version": config.config_version,
        "config_sha256": config.config_sha256,
        "git_revision": git_revision,
        "random_seed": seed,
        "partition_counts": {
            "train": len(train_index),
            "selection": len(selection_index),
            "calibration_fit": len(calibration_fit_index),
            "calibration": len(calibration_index),
            "test": len(test_index),
        },
        "features": {"count": len(columns), "groups": groups},
        "reference_mechanics_v1": reference,
        "selection": {
            "trials": trials,
            "chosen_index": chosen,
            "selection_data": "first chronological half of the calibration partition",
            "calibration_data": "second chronological half of the calibration partition",
        },
        "test_summary": {
            **partition_metrics["test"],
            **rank_summary,
        },
        "fit_checks": {
            "partition_metrics": partition_metrics,
            "learning_curve": _learning_curve(
                model, int(checks["learning_curve_points"])
            ),
            "shuffled_label_control": control,
            "monthly_stability": _monthly(
                frame.iloc[test_index].reset_index(drop=True), scores["test"]
            ),
            "ablation": {
                "cumulative": cumulative,
                "leave_one_group_out": without,
            },
            "calibration": calibration,
            "importance_by_group": _importance_by_group(model, groups),
        },
        "limitations": list(LIMITATIONS),
        "decision_recommendation": RECOMMENDATION,
    }


def _entry_of(trial: dict[str, Any]) -> dict[str, Any]:
    """Recover the grid entry that produced a recorded trial."""
    return {
        "max_depth": trial["max_depth"],
        "min_child_weight": trial["min_child_weight"],
        "scale_pos_weight_mode": trial["scale_pos_weight_mode"],
    }
