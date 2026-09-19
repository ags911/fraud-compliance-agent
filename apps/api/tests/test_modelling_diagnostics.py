"""Every figure is built, labelled with its mode, and marked non-authoritative.

A chart can be screenshotted out of a notebook, so the safety labelling is part
of the figure itself rather than the surrounding narrative.
"""

import numpy as np
import pytest
from modelling_fixtures import TINY_CONTRACT, tiny_dataset

from modelling.config import (
    BASELINE_MODEL_ID,
    CANDIDATE_MODEL_ID,
    load_training_config,
)
from modelling.diagnostics import (
    FIGURE_KEYS,
    SAFETY_ANNOTATION,
    build_diagnostics,
    evaluation_subtitle,
)
from modelling.evaluation import evaluate_models
from modelling.features import split_partitions
from modelling.report import APPROVED_MODE, SYNTHETIC_MODE


@pytest.fixture(scope="module")
def config(repository_root):
    """Return the committed evaluation configuration."""
    return load_training_config(repository_root)


@pytest.fixture
def run(config):
    """Return partitions, scores, and an evaluation for both model ids."""
    partitions = split_partitions(tiny_dataset(), TINY_CONTRACT)
    rows = len(partitions.test)
    scores = {
        BASELINE_MODEL_ID: np.linspace(0.05, 0.95, rows),
        CANDIDATE_MODEL_ID: np.linspace(0.95, 0.05, rows),
    }
    return partitions, scores, evaluate_models(partitions, scores, config.evaluation)


def test_every_declared_figure_is_built(run, config) -> None:
    """The notebook displays exactly what this function returns."""
    partitions, scores, models = run

    figures = build_diagnostics(
        partitions, scores, models, config.evaluation, SYNTHETIC_MODE
    )

    assert tuple(figures) == FIGURE_KEYS
    assert all(figure.data for figure in figures.values())


def test_each_model_appears_in_the_curve_figures(run, config) -> None:
    """A missing series would silently drop a model from the comparison."""
    partitions, scores, models = run

    figures = build_diagnostics(
        partitions, scores, models, config.evaluation, SYNTHETIC_MODE
    )

    for key in ("precision_recall", "roc", "reliability"):
        names = {trace.name for trace in figures[key].data}
        assert BASELINE_MODEL_ID.replace("_", " ") in names
        assert CANDIDATE_MODEL_ID.replace("_", " ") in names


def test_every_figure_carries_the_no_threshold_notice(run, config) -> None:
    """No diagnostic may be read as selecting an operating threshold."""
    partitions, scores, models = run

    figures = build_diagnostics(
        partitions, scores, models, config.evaluation, SYNTHETIC_MODE
    )

    for figure in figures.values():
        assert any(
            annotation.text == SAFETY_ANNOTATION
            for annotation in figure.layout.annotations
        )


def test_synthetic_figures_are_labelled_mechanics_only(run, config) -> None:
    """A synthetic chart states that it is not fraud-model performance evidence."""
    partitions, scores, models = run

    figures = build_diagnostics(
        partitions, scores, models, config.evaluation, SYNTHETIC_MODE
    )

    for figure in figures.values():
        assert "not fraud-model performance evidence" in figure.layout.title.text


def test_approved_figures_are_labelled_review_only(run, config) -> None:
    """An approved-mode chart is candidate evidence, not a release decision."""
    partitions, scores, models = run

    figures = build_diagnostics(
        partitions, scores, models, config.evaluation, APPROVED_MODE
    )

    for figure in figures.values():
        assert "no threshold or release decision" in figure.layout.title.text


def test_the_subtitle_keeps_the_detail_and_the_notice() -> None:
    """The caption explains the figure and its standing limit together."""
    subtitle = evaluation_subtitle("Held-out test partition.", SYNTHETIC_MODE)

    assert subtitle.startswith("Held-out test partition.")
    assert "Synthetic mechanics-only" in subtitle


def test_the_threshold_figure_plots_every_reported_measure(run, config) -> None:
    """Four measures for each of two models makes the trade-off legible."""
    partitions, scores, models = run

    figure = build_diagnostics(
        partitions, scores, models, config.evaluation, SYNTHETIC_MODE
    )["threshold_tradeoffs"]

    assert len(figure.data) == 8
    assert "not selected" in figure.layout.xaxis.title.text
