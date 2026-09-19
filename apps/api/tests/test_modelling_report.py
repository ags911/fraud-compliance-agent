"""Run modes, the write guard, and the sanitised report's contents.

A direct default-mode run once overwrote the reviewed Sparkov report with
synthetic output, so the mode defaults and the destination guard are pinned here
alongside the report's shape and digest.
"""

import json
import tempfile
from pathlib import Path

import numpy as np
import pytest
from modelling_fixtures import TINY_CONTRACT, tiny_dataset

from modelling.config import load_training_config
from modelling.evaluation import evaluate_models
from modelling.features import split_partitions
from modelling.report import (
    APPROVED_MODE,
    APPROVED_STATUS,
    GATE_MODE,
    GATED_STATUS,
    MODE_ENVIRONMENT_VARIABLE,
    REPORT_PATH_ENVIRONMENT_VARIABLE,
    SYNTHETIC_MODE,
    SYNTHETIC_STATUS,
    digest_report,
    evaluation_report,
    gated_report,
    report_location,
    resolve_mode,
    resolve_report_path,
    reviewed_report_path,
    run_context,
    write_report,
)

REVIEWED_REPORT = "docs/proposals/fast-path-model-release.candidate.json"


@pytest.fixture(scope="module")
def config(repository_root):
    """Return the committed evaluation configuration."""
    return load_training_config(repository_root)


@pytest.fixture
def evaluated(config):
    """Return partitions and an evaluation built from the tiny dataset."""
    partitions = split_partitions(tiny_dataset(), TINY_CONTRACT)
    scores = {
        "stand_in_model": np.linspace(0.1, 0.9, len(partitions.test)),
    }
    return partitions, evaluate_models(partitions, scores, config.evaluation)


def test_the_default_mode_is_synthetic() -> None:
    """An unset mode is the safe synthetic mode, never approved."""
    assert resolve_mode({}) == SYNTHETIC_MODE


@pytest.mark.parametrize("mode", [GATE_MODE, SYNTHETIC_MODE, APPROVED_MODE])
def test_each_known_mode_resolves(mode) -> None:
    """Surrounding whitespace and casing do not change the resolved mode."""
    assert resolve_mode({MODE_ENVIRONMENT_VARIABLE: f"  {mode.upper()} "}) == mode


def test_an_unknown_mode_is_rejected() -> None:
    """A typo cannot fall through to a mode that writes reviewed evidence."""
    with pytest.raises(RuntimeError, match="gate, synthetic, or approved"):
        resolve_mode({MODE_ENVIRONMENT_VARIABLE: "aproved"})


def test_the_mode_is_read_from_the_process_environment(monkeypatch) -> None:
    """The notebook passes no environment, so the default source must work."""
    monkeypatch.setenv(MODE_ENVIRONMENT_VARIABLE, GATE_MODE)

    assert resolve_mode() == GATE_MODE


@pytest.mark.parametrize("mode", [SYNTHETIC_MODE, GATE_MODE])
def test_non_approved_modes_never_default_to_the_reviewed_report(
    repository_root, mode
) -> None:
    """A gate or synthetic run writes to a temporary file, not the repository."""
    destination = resolve_report_path(mode, repository_root, {})

    assert destination != (repository_root / REVIEWED_REPORT).resolve()
    assert destination.is_relative_to(Path(tempfile.gettempdir()).resolve())
    assert not destination.is_relative_to(repository_root)


def test_approved_mode_targets_the_reviewed_report(repository_root) -> None:
    """Approved mode is the only mode that writes the reviewed artifact."""
    destination = resolve_report_path(APPROVED_MODE, repository_root, {})

    assert destination == (repository_root / REVIEWED_REPORT).resolve()
    assert destination == reviewed_report_path(repository_root).resolve()


@pytest.mark.parametrize("mode", [GATE_MODE, SYNTHETIC_MODE, APPROVED_MODE])
def test_an_explicit_report_path_is_honoured(repository_root, tmp_path, mode) -> None:
    """The safe runner redirects output through this variable, whatever the mode."""
    destination = tmp_path / "report.json"

    resolved = resolve_report_path(
        mode, repository_root, {REPORT_PATH_ENVIRONMENT_VARIABLE: str(destination)}
    )

    assert resolved == destination.resolve()


def test_the_report_path_is_read_from_the_process_environment(
    repository_root, monkeypatch, tmp_path
) -> None:
    """The notebook passes no environment, so the default source must work."""
    monkeypatch.delenv(MODE_ENVIRONMENT_VARIABLE, raising=False)
    monkeypatch.setenv(REPORT_PATH_ENVIRONMENT_VARIABLE, str(tmp_path / "out.json"))

    assert (
        resolve_report_path(SYNTHETIC_MODE, repository_root)
        == (tmp_path / "out.json").resolve()
    )


def test_the_run_context_records_reproduction_details(config) -> None:
    """Revision, seed, and configuration version make a report reproducible."""
    context = run_context(SYNTHETIC_MODE, config, "abc123")

    assert context["git_revision"] == "abc123"
    assert context["mode"] == SYNTHETIC_MODE
    assert context["random_seed"] == config.random_seed
    assert context["config_version"] == config.config_version
    assert context["run_at_utc"].endswith("+00:00")


def test_a_gated_report_names_what_is_still_required(config) -> None:
    """A gated run trains nothing and says why."""
    report = gated_report(run_context(GATE_MODE, config, "abc123"))

    assert report["status"] == GATED_STATUS
    assert "do not train or promote" in report["decision_recommendation"]
    assert "accepted model-training contract" in report["blocking_requirements"]
    assert "models" not in report


@pytest.mark.parametrize(
    ("mode", "status"),
    [(SYNTHETIC_MODE, SYNTHETIC_STATUS), (APPROVED_MODE, APPROVED_STATUS)],
)
def test_an_evaluation_report_states_its_mode_and_limits(
    config, evaluated, mode, status
) -> None:
    """The status distinguishes mechanics-only output from candidate evidence."""
    partitions, models = evaluated

    report = evaluation_report(
        mode, run_context(mode, config, "abc123"), TINY_CONTRACT, partitions, models
    )

    assert report["status"] == status
    assert report["partition_counts"] == partitions.counts
    assert report["prevalence"] == partitions.prevalence
    assert report["input_manifest"]["dataset_sha256"] == TINY_CONTRACT.dataset_sha256
    assert "no runtime promotion" in report["decision_recommendation"]
    assert any("threshold" in limitation for limitation in report["limitations"])


def test_a_gated_run_cannot_produce_an_evaluation_report(config, evaluated) -> None:
    """There is nothing to report when nothing was allowed to run."""
    partitions, models = evaluated

    with pytest.raises(ValueError, match="synthetic or approved"):
        evaluation_report(
            GATE_MODE,
            run_context(GATE_MODE, config, "abc123"),
            TINY_CONTRACT,
            partitions,
            models,
        )


def test_the_report_carries_no_row_identifier_or_weight(config, evaluated) -> None:
    """Only aggregates, counts, and input identity reach the artifact."""
    partitions, models = evaluated

    report = evaluation_report(
        SYNTHETIC_MODE,
        run_context(SYNTHETIC_MODE, config, "abc123"),
        TINY_CONTRACT,
        partitions,
        models,
    )
    payload = json.dumps(report)

    for column in TINY_CONTRACT.feature_columns:
        # Feature names are declared input identity; their values are not.
        assert str(partitions.test[column].iloc[0]) not in payload
    assert "coef" not in payload
    assert "intercept" not in payload


def test_writing_adds_a_digest_of_the_payload(config, evaluated, tmp_path) -> None:
    """The digest covers the report without itself, as the reviewers recompute it."""
    partitions, models = evaluated
    report = evaluation_report(
        SYNTHETIC_MODE,
        run_context(SYNTHETIC_MODE, config, "abc123"),
        TINY_CONTRACT,
        partitions,
        models,
    )
    destination = tmp_path / "nested" / "report.json"

    written = write_report(report, destination)
    stored = json.loads(destination.read_text(encoding="utf-8"))

    assert stored == written
    assert stored["report_sha256"] == digest_report(stored)


def test_the_committed_report_matches_this_digest_method(repository_root) -> None:
    """The refactor kept the digest the committed evidence was produced with."""
    stored = json.loads(
        reviewed_report_path(repository_root).read_text(encoding="utf-8")
    )

    assert stored["report_sha256"] == digest_report(stored)


def test_a_location_outside_the_repository_is_not_printed(
    repository_root, tmp_path
) -> None:
    """Notebook output must not reveal a workstation path."""
    assert (
        report_location(tmp_path / "report.json", repository_root)
        == "temporary external output"
    )
    assert (
        report_location(reviewed_report_path(repository_root), repository_root)
        == REVIEWED_REPORT
    )
