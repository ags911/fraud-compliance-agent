"""Run modes and the sanitised candidate-release report.

The report is the only artifact an evaluation run leaves behind: aggregate
metrics, configuration identity, partition counts, limitations, and a digest of
its own payload. It carries no source row, identifier, model weight, or selected
threshold, and it is a review input rather than a release decision.

Only an approved-mode run may write the reviewed report in `docs/proposals/`.
Gate and synthetic runs default to a temporary file, because a demonstration run
once overwrote accepted mechanics evidence with synthetic output.
"""

from __future__ import annotations

import hashlib
import json
import os
import tempfile
from collections.abc import Mapping
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from modelling.config import TrainingConfig
from modelling.datasets import DatasetContract
from modelling.features import Partitions

GATE_MODE = "gate"
SYNTHETIC_MODE = "synthetic"
APPROVED_MODE = "approved"
MODES = (GATE_MODE, SYNTHETIC_MODE, APPROVED_MODE)
# Synthetic is the safe default: an unset or mistyped mode must never train on
# approved data or write the reviewed artifact.
DEFAULT_MODE = SYNTHETIC_MODE
MODE_ENVIRONMENT_VARIABLE = "FCA_NOTEBOOK08_MODE"
REPORT_PATH_ENVIRONMENT_VARIABLE = "FCA_NOTEBOOK08_REPORT_PATH"
REVIEWED_REPORT_RELATIVE_PATH = (
    Path("docs") / "proposals" / "fast-path-model-release.candidate.json"
)
ARTIFACT_NAME = "fast-path-model-release"
GATED_STATUS = "gated"
SYNTHETIC_STATUS = "synthetic_mechanics_only"
# The demo model-summary route serves only a report with this status, so it is
# effectively part of that endpoint's contract.
APPROVED_STATUS = "candidate_evaluation_pending_review"

BLOCKING_REQUIREMENTS = (
    "accepted model-training contract",
    "approved corpus and target",
    "approved feature contract",
    "chronological partitions",
    "calibration procedure",
    "release criteria",
)
SYNTHETIC_LIMITATIONS = (
    "No policy threshold was selected; model scores have no payment authority.",
    "Deterministic controls, authority, oversight, and review remain independent runtime controls.",
    "Synthetic mechanics results are not fraud-model performance evidence and cannot support release or promotion.",
)
APPROVED_LIMITATIONS = (
    "Candidate results are Sparkov synthetic benchmark mechanics only and cannot support a production fraud-performance claim.",
    "Candidate results require independent review against accepted release criteria.",
    "This notebook does not promote a model or select a payment-action threshold.",
)
GATED_RECOMMENDATION = "proposed — do not train or promote a candidate model"
EVALUATED_RECOMMENDATION = (
    "proposed — no runtime promotion or policy decision is implied"
)


def resolve_mode(environment: Mapping[str, str] | None = None) -> str:
    """Return the requested run mode.

    Args:
        environment: Variable source; the process environment by default.

    Returns:
        One of `MODES`, defaulting to synthetic when unset or blank.

    Raises:
        RuntimeError: If the value is not a known mode. A typo must stop the run
            rather than fall through to a mode that writes reviewed evidence.
    """
    source = os.environ if environment is None else environment
    mode = source.get(MODE_ENVIRONMENT_VARIABLE, DEFAULT_MODE).strip().lower()
    if not mode:
        mode = DEFAULT_MODE
    if mode not in MODES:
        raise RuntimeError(
            f"{MODE_ENVIRONMENT_VARIABLE} must be gate, synthetic, or approved."
        )
    return mode


def reviewed_report_path(repository_root: Path) -> Path:
    """Return the reviewed candidate report's committed location."""
    return repository_root / REVIEWED_REPORT_RELATIVE_PATH


def resolve_report_path(
    mode: str,
    repository_root: Path,
    environment: Mapping[str, str] | None = None,
) -> Path:
    """Return where this run may write its report.

    Args:
        mode: Resolved run mode.
        repository_root: Located monorepo root.
        environment: Variable source; the process environment by default.

    Returns:
        An explicit override when one is set, otherwise the reviewed report for
        an approved run and a temporary file for every other mode, so a gate or
        synthetic run cannot overwrite accepted evidence.
    """
    source = os.environ if environment is None else environment
    override = source.get(REPORT_PATH_ENVIRONMENT_VARIABLE)
    if override:
        return Path(override).resolve()
    if mode == APPROVED_MODE:
        return reviewed_report_path(repository_root).resolve()
    return (Path(tempfile.gettempdir()) / f"{ARTIFACT_NAME}.{mode}.json").resolve()


def run_context(mode: str, config: TrainingConfig, git_revision: str) -> dict[str, Any]:
    """Describe the run so a reader can reproduce or date the evidence.

    Args:
        mode: Resolved run mode.
        config: Loaded evaluation configuration.
        git_revision: Revision reported by `modelling.paths.git_revision`.

    Returns:
        Run timestamp, revision, mode, seed, and configuration version. It holds
        no workstation path, user, environment variable value, or credential.
    """
    return {
        "run_at_utc": datetime.now(UTC).isoformat(),
        "git_revision": git_revision,
        "mode": mode,
        "random_seed": config.random_seed,
        "config_version": config.config_version,
    }


def gated_report(context: dict[str, Any]) -> dict[str, Any]:
    """Return the report for a gated run, which trains nothing.

    Args:
        context: Output of `run_context`.

    Returns:
        A report naming what is still missing before any model work may begin.
    """
    return {
        "artifact": ARTIFACT_NAME,
        "status": GATED_STATUS,
        "run_context": context,
        "blocking_requirements": list(BLOCKING_REQUIREMENTS),
        "decision_recommendation": GATED_RECOMMENDATION,
    }


def evaluation_report(
    mode: str,
    context: dict[str, Any],
    contract: DatasetContract,
    partitions: Partitions,
    models: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    """Assemble the report for a synthetic or approved run.

    Args:
        mode: Resolved run mode; it selects the status and the limitations.
        context: Output of `run_context`.
        contract: Dataset contract, recorded as input identity only.
        partitions: Split dataset, recorded as counts and prevalence only.
        models: Output of `modelling.evaluation.evaluate_models`.

    Returns:
        The sanitised report body, without its own digest.

    Raises:
        ValueError: If `mode` is gated, which has no evaluation to report.
    """
    if mode not in {SYNTHETIC_MODE, APPROVED_MODE}:
        raise ValueError("Only a synthetic or approved run produces an evaluation.")
    synthetic = mode == SYNTHETIC_MODE
    return {
        "artifact": ARTIFACT_NAME,
        "status": SYNTHETIC_STATUS if synthetic else APPROVED_STATUS,
        "run_context": context,
        # Input identity only: the digest and column names, never a row.
        "input_manifest": {
            "dataset_sha256": contract.dataset_sha256,
            "feature_columns": list(contract.feature_columns),
            "target_column": contract.target_column,
            "release_criteria_version": contract.release_criteria_version,
        },
        "partition_counts": partitions.counts,
        "prevalence": partitions.prevalence,
        "models": models,
        "limitations": list(
            SYNTHETIC_LIMITATIONS if synthetic else APPROVED_LIMITATIONS
        ),
        "decision_recommendation": EVALUATED_RECOMMENDATION,
    }


def digest_report(report: dict[str, Any]) -> str:
    """Return the SHA-256 digest of a report payload.

    Args:
        report: Report body without a `report_sha256` key.

    Returns:
        The digest of the canonical JSON payload: sorted keys, two-space indent.
        Recomputing it detects a report edited by hand after a run.
    """
    payload = {key: value for key, value in report.items() if key != "report_sha256"}
    return hashlib.sha256(
        json.dumps(payload, sort_keys=True, indent=2).encode("utf-8")
    ).hexdigest()


def write_report(report: dict[str, Any], destination: Path) -> dict[str, Any]:
    """Add the payload digest and write the report as canonical JSON.

    Args:
        report: Report body from `gated_report` or `evaluation_report`.
        destination: Path resolved by `resolve_report_path`.

    Returns:
        The report including its `report_sha256`.

    Side effects:
        Creates the destination's parent directory and overwrites the file. It
        writes only aggregate, sanitised content; no model weight, source row,
        identifier, or selected threshold is ever written.
    """
    complete = dict(report)
    complete["report_sha256"] = digest_report(complete)
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(
        json.dumps(complete, sort_keys=True, indent=2) + "\n", encoding="utf-8"
    )
    return complete


def report_location(destination: Path, repository_root: Path) -> str:
    """Describe where a report was written without exposing a local path.

    Args:
        destination: Path the report was written to.
        repository_root: Located monorepo root.

    Returns:
        A repository-relative path, or a fixed phrase for anything outside the
        repository, so notebook output stays portable and reviewable.
    """
    if destination.is_relative_to(repository_root):
        return str(destination.relative_to(repository_root))
    return "temporary external output"
