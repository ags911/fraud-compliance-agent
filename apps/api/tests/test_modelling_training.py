"""Model construction follows the versioned configuration, and fitting is reproducible.

These tests fit the real pipelines on the tiny fixed dataset: they check shapes,
determinism, and the train-only boundary rather than any performance level.
"""

import numpy as np
import pandas as pd
import pytest
from modelling_fixtures import TEST_ROWS, TINY_CONTRACT, tiny_dataset

from modelling.config import BASELINE_MODEL_ID, CANDIDATE_MODEL_ID, load_training_config
from modelling.features import split_partitions
from modelling.training import (
    build_models,
    fit_and_score,
    scale_pos_weight,
    train_models,
)


@pytest.fixture(scope="module")
def config(repository_root):
    """Return the committed evaluation configuration."""
    return load_training_config(repository_root)


@pytest.fixture
def partitions():
    """Return the tiny dataset split into its partitions."""
    return split_partitions(tiny_dataset(), TINY_CONTRACT)


def test_both_models_are_built_with_configured_hyperparameters(
    partitions, config
) -> None:
    """A hyperparameter change must come from the configuration file."""
    models = build_models(partitions.target(partitions.train), config)

    assert set(models) == {BASELINE_MODEL_ID, CANDIDATE_MODEL_ID}
    baseline = models[BASELINE_MODEL_ID].named_steps["model"]
    candidate = models[CANDIDATE_MODEL_ID].named_steps["model"]
    assert baseline.max_iter == config.baseline.max_iter
    assert baseline.class_weight == config.baseline.class_weight
    assert candidate.n_estimators == config.candidate.n_estimators
    assert candidate.max_depth == config.candidate.max_depth
    assert candidate.learning_rate == pytest.approx(config.candidate.learning_rate)


def test_both_models_use_the_configured_seed(partitions, config) -> None:
    """One seed governs the run, so a recorded result can be reproduced."""
    models = build_models(partitions.target(partitions.train), config)

    for model in models.values():
        assert model.named_steps["model"].random_state == config.random_seed


def test_the_imbalance_weight_comes_from_the_train_partition(partitions) -> None:
    """The weight describes the data it was derived from, not a fixed guess."""
    target = partitions.target(partitions.train)
    positives = int(target.sum())
    negatives = len(target) - positives

    assert scale_pos_weight(target) == pytest.approx(negatives / positives)


def test_a_single_class_train_partition_is_refused() -> None:
    """Without both classes the comparison is meaningless, so it stops."""
    with pytest.raises(RuntimeError, match="both target classes"):
        scale_pos_weight(pd.Series([0, 0, 0]))


def test_scores_have_the_shape_of_the_test_partition(partitions, config) -> None:
    """Every held-out row gets exactly one probability in [0, 1]."""
    scores = train_models(partitions, config)

    assert set(scores) == {BASELINE_MODEL_ID, CANDIDATE_MODEL_ID}
    for model_scores in scores.values():
        assert isinstance(model_scores, np.ndarray)
        assert model_scores.shape == (TEST_ROWS,)
        assert np.all((model_scores >= 0) & (model_scores <= 1))


def test_training_is_deterministic(partitions, config) -> None:
    """The same data, seed, and configuration produce identical scores."""
    first = train_models(partitions, config)
    second = train_models(
        split_partitions(tiny_dataset(), TINY_CONTRACT),
        config,
    )

    for name, model_scores in first.items():
        np.testing.assert_array_equal(model_scores, second[name])


def test_fitting_touches_only_the_train_partition(partitions, config) -> None:
    """Held-out and calibration rows are never fitted on.

    The baseline's median imputer is the visible witness: it stores the medians
    of the rows it was fitted on, which must be the train partition's.
    """
    model = build_models(partitions.target(partitions.train), config)[BASELINE_MODEL_ID]

    fit_and_score(model, partitions)

    expected = partitions.features(partitions.train).median().to_numpy()
    np.testing.assert_allclose(
        model.named_steps["impute"].statistics_, expected, rtol=1e-12
    )


def test_the_calibration_partition_is_left_untouched(partitions, config) -> None:
    """No calibration method is fitted or selected by this library."""
    before = partitions.calibration.copy()

    train_models(partitions, config)

    pd.testing.assert_frame_equal(before, partitions.calibration)
