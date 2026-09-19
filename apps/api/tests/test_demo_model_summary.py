"""Contract tests for the read-only portfolio benchmark summary."""

import json
import shutil
from pathlib import Path

from fastapi.testclient import TestClient

from server.main import create_app

REPORT_RELATIVE = Path("docs/proposals/fast-path-model-release.candidate.json")
CONTRACT_RELATIVE = Path("docs/contracts/model-training-contract.v1.json")


def build_evidence_root(root: Path, repository_root: Path) -> Path:
    """Copy the committed evidence pair into a standalone evidence directory.

    Args:
        root: Directory to build the evidence tree in.
        repository_root: Monorepo root holding the committed evidence.

    Returns:
        `root`, now holding both files at their repository-relative paths.
    """
    for relative in (REPORT_RELATIVE, CONTRACT_RELATIVE):
        destination = root / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(repository_root / relative, destination)
    return root


def test_demo_model_summary_is_explicitly_not_deployable() -> None:
    """The portfolio endpoint exposes metrics without pretending a model is live."""
    response = TestClient(create_app()).get("/demo/model-summary")

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "mechanics_evaluation_complete_not_deployable"
    assert payload["data_source"] == "Sparkov simulated credit-card transactions"
    assert payload["feature_columns"] == [
        "amount_source_value",
        "event_hour_utc",
        "event_day_of_week_utc",
        "is_weekend",
    ]
    assert {model["model_id"] for model in payload["model_results"]} == {
        "logistic_regression_baseline",
        "xgboost_candidate",
    }
    xgboost = next(
        model
        for model in payload["model_results"]
        if model["model_id"] == "xgboost_candidate"
    )
    assert xgboost["threshold_sweep"]
    assert {item["slice"] for item in xgboost["slice_metrics"]} == {
        "category",
        "amount_band",
    }
    assert any(
        "No score can approve" in boundary for boundary in payload["release_boundary"]
    )


def test_demo_model_summary_refuses_a_synthetic_run_report(
    tmp_path, monkeypatch, repository_root
) -> None:
    """A synthetic notebook report must not be served under the Sparkov label."""
    evidence_root = build_evidence_root(tmp_path, repository_root)
    (evidence_root / REPORT_RELATIVE).write_text(
        json.dumps(
            {
                "status": "synthetic_mechanics_only",
                "input_manifest": {
                    "feature_columns": ["amount_minor"],
                    "dataset_sha256": "synthetic",
                },
                "models": {},
                "partition_counts": {},
                "prevalence": {"test": 0.0},
                "report_sha256": "synthetic",
            }
        ),
        encoding="utf-8",
    )
    monkeypatch.setenv("FCA_EVIDENCE_ROOT", str(evidence_root))

    response = TestClient(create_app()).get("/demo/model-summary")

    assert response.status_code == 503
    assert response.json()["detail"] == "demo_model_summary_unavailable"


def test_demo_model_summary_reads_a_configured_evidence_root(
    tmp_path, monkeypatch, repository_root
) -> None:
    """A container image has no repository, so the deployment points at a directory.

    Without this the packaged API would serve 503 for its own benchmark
    evidence, because the route's default is the repository layout.
    """
    monkeypatch.setenv(
        "FCA_EVIDENCE_ROOT", str(build_evidence_root(tmp_path, repository_root))
    )

    response = TestClient(create_app()).get("/demo/model-summary")

    assert response.status_code == 200
    assert response.json()["report_sha256"]


def test_an_empty_evidence_root_falls_back_to_the_repository(monkeypatch) -> None:
    """A blank deployment value must not resolve to the filesystem root."""
    monkeypatch.setenv("FCA_EVIDENCE_ROOT", "  ")

    assert TestClient(create_app()).get("/demo/model-summary").status_code == 200


def test_a_configured_evidence_root_without_the_files_is_unavailable(
    tmp_path, monkeypatch
) -> None:
    """A misconfigured deployment says the evidence is unavailable, not something else."""
    monkeypatch.setenv("FCA_EVIDENCE_ROOT", str(tmp_path))

    response = TestClient(create_app()).get("/demo/model-summary")

    assert response.status_code == 503
    assert response.json()["detail"] == "demo_model_summary_unavailable"
