"""The full synthetic run, in the order Notebook 08 calls it.

This exercises setup, loading, partitioning, training, evaluation, diagnostics,
and the report as one path, so a change that breaks the notebook fails here
first. It uses synthetic mode only and writes nothing into the repository.
"""

import json

import pytest

from modelling.diagnostics import FIGURE_KEYS, build_diagnostics
from modelling.evaluation import evaluate_models
from modelling.features import split_partitions
from modelling.pipeline import load_dataset, prepare_run
from modelling.report import (
    GATE_MODE,
    GATED_STATUS,
    MODE_ENVIRONMENT_VARIABLE,
    REPORT_PATH_ENVIRONMENT_VARIABLE,
    SYNTHETIC_MODE,
    SYNTHETIC_STATUS,
    digest_report,
    evaluation_report,
    gated_report,
    write_report,
)
from modelling.training import train_models


@pytest.fixture(scope="module")
def synthetic_run(repository_root, tmp_path_factory) -> dict:
    """Run the synthetic pipeline once and return its written report."""
    destination = tmp_path_factory.mktemp("report") / "synthetic.json"
    setup = prepare_run(
        repository_root,
        {
            MODE_ENVIRONMENT_VARIABLE: SYNTHETIC_MODE,
            REPORT_PATH_ENVIRONMENT_VARIABLE: str(destination),
        },
    )
    dataset = load_dataset(setup)
    partitions = split_partitions(dataset.frame, dataset.contract)
    scores = train_models(partitions, setup.config)
    models = evaluate_models(partitions, scores, setup.config.evaluation)
    figures = build_diagnostics(
        partitions, scores, models, setup.config.evaluation, setup.mode
    )
    report = write_report(
        evaluation_report(
            setup.mode, setup.context, dataset.contract, partitions, models
        ),
        setup.report_path,
    )
    return {
        "setup": setup,
        "partitions": partitions,
        "models": models,
        "figures": figures,
        "report": report,
        "path": destination,
    }


def test_the_run_writes_only_where_it_was_told(synthetic_run, repository_root) -> None:
    """A synthetic run never touches the reviewed evidence in the repository."""
    assert synthetic_run["path"].is_file()
    assert not synthetic_run["path"].is_relative_to(repository_root)


def test_the_report_is_labelled_mechanics_only(synthetic_run) -> None:
    """Synthetic output can never be mistaken for candidate evidence."""
    report = synthetic_run["report"]

    assert report["status"] == SYNTHETIC_STATUS
    assert report["run_context"]["mode"] == SYNTHETIC_MODE
    assert any(
        "not fraud-model performance evidence" in limitation
        for limitation in report["limitations"]
    )


def test_the_report_reconciles_with_the_data_it_describes(synthetic_run) -> None:
    """Counts, prevalence, and models in the report come from this run."""
    report = synthetic_run["report"]
    partitions = synthetic_run["partitions"]

    assert report["partition_counts"] == partitions.counts
    assert report["prevalence"] == partitions.prevalence
    assert set(report["models"]) == set(synthetic_run["models"])
    assert report["report_sha256"] == digest_report(report)


def test_the_written_file_is_canonical_json(synthetic_run) -> None:
    """Sorted keys and a trailing newline keep reruns diff-friendly."""
    text = synthetic_run["path"].read_text(encoding="utf-8")

    assert text.endswith("\n")
    assert json.loads(text) == synthetic_run["report"]


def test_every_diagnostic_is_produced(synthetic_run) -> None:
    """The notebook displays the five figures this run built."""
    assert tuple(synthetic_run["figures"]) == FIGURE_KEYS


def test_a_gated_run_produces_a_report_without_touching_data(
    repository_root, tmp_path
) -> None:
    """The gated path is runnable end to end and records why it stopped."""
    destination = tmp_path / "gated.json"
    setup = prepare_run(
        repository_root,
        {
            MODE_ENVIRONMENT_VARIABLE: GATE_MODE,
            REPORT_PATH_ENVIRONMENT_VARIABLE: str(destination),
        },
    )

    assert load_dataset(setup) is None

    report = write_report(gated_report(setup.context), setup.report_path)

    assert report["status"] == GATED_STATUS
    assert "models" not in report
    assert json.loads(destination.read_text(encoding="utf-8")) == report
