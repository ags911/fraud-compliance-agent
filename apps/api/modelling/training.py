"""Build and fit the baseline and candidate models.

Two fixed pipelines are compared: an interpretable class-balanced logistic
regression and an XGBoost candidate. Both are constructed from the versioned
configuration so a recorded result can be traced to reviewable parameters.
Fitting a model here grants it no authority: it produces held-out scores for
review and nothing else.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from xgboost import XGBClassifier

from modelling.config import BASELINE_MODEL_ID, CANDIDATE_MODEL_ID, TrainingConfig
from modelling.features import Partitions


def scale_pos_weight(y_train: pd.Series) -> float:
    """Return the candidate's class-imbalance weight for this train partition.

    Args:
        y_train: Binary target of the train partition.

    Returns:
        Negative-to-positive ratio, used for a fixed comparison only. It is
        derived rather than configured so it cannot drift from its data.

    Raises:
        RuntimeError: If the partition has no positive or no negative rows, in
            which case the ratio is undefined and the comparison is meaningless.
    """
    positive_count = int(y_train.sum())
    negative_count = len(y_train) - positive_count
    if positive_count == 0 or negative_count == 0:
        raise RuntimeError("The train partition must contain both target classes.")
    return negative_count / positive_count


def build_models(y_train: pd.Series, config: TrainingConfig) -> dict[str, Pipeline]:
    """Construct the baseline and candidate pipelines.

    Args:
        y_train: Train-partition target, used only for the imbalance weight.
        config: Versioned hyperparameters and seed.

    Returns:
        Unfitted pipelines keyed by the report's model ids.

    Raises:
        RuntimeError: If the train partition has only one target class.
    """
    baseline = config.baseline
    candidate = config.candidate
    return {
        BASELINE_MODEL_ID: Pipeline(
            [
                ("impute", SimpleImputer(strategy=baseline.imputation_strategy)),
                ("scale", StandardScaler()),
                (
                    "model",
                    LogisticRegression(
                        class_weight=baseline.class_weight,
                        max_iter=baseline.max_iter,
                        random_state=config.random_seed,
                    ),
                ),
            ]
        ),
        # Trees need no scaling, so the candidate pipeline imputes only. Its
        # hyperparameters are a fixed comparison, not a tuned or approved model.
        CANDIDATE_MODEL_ID: Pipeline(
            [
                ("impute", SimpleImputer(strategy=candidate.imputation_strategy)),
                (
                    "model",
                    XGBClassifier(
                        objective=candidate.objective,
                        eval_metric=candidate.eval_metric,
                        n_estimators=candidate.n_estimators,
                        max_depth=candidate.max_depth,
                        learning_rate=candidate.learning_rate,
                        subsample=candidate.subsample,
                        colsample_bytree=candidate.colsample_bytree,
                        scale_pos_weight=scale_pos_weight(y_train),
                        n_jobs=candidate.n_jobs,
                        random_state=config.random_seed,
                        tree_method=candidate.tree_method,
                    ),
                ),
            ]
        ),
    }


def fit_and_score(model: Pipeline, partitions: Partitions) -> np.ndarray:
    """Fit on the train partition and score the held-out test partition.

    Args:
        model: Unfitted pipeline from `build_models`.
        partitions: Split dataset; only train is fitted on and only test scored.

    Returns:
        Positive-class probabilities for the test partition, in its row order.

    Side effects:
        Fits `model` in place. The fitted estimator stays in memory: no model
        weight is written to disk, and none is a runtime artifact.
    """
    model.fit(
        partitions.features(partitions.train), partitions.target(partitions.train)
    )
    return model.predict_proba(partitions.features(partitions.test))[:, 1]


def train_models(
    partitions: Partitions, config: TrainingConfig
) -> dict[str, np.ndarray]:
    """Fit every configured model and return its held-out scores.

    Args:
        partitions: Split dataset produced by `split_partitions`.
        config: Versioned hyperparameters and seed.

    Returns:
        Test-partition scores keyed by model id.

    Raises:
        RuntimeError: If the train partition has only one target class.

    Side effects:
        Fits the models in memory. The calibration partition is untouched: no
        probability calibration is applied or selected.
    """
    return {
        name: fit_and_score(model, partitions)
        for name, model in build_models(
            partitions.target(partitions.train), config
        ).items()
    }
