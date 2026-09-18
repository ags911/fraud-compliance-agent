"""Contract tests for the read-only portfolio benchmark summary."""

import json

from fastapi.testclient import TestClient

from server import main
from server.main import create_app


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
    xgboost = next(model for model in payload["model_results"] if model["model_id"] == "xgboost_candidate")
    assert xgboost["threshold_sweep"]
    assert {item["slice"] for item in xgboost["slice_metrics"]} == {"category", "amount_band"}
    assert any("No score can approve" in boundary for boundary in payload["release_boundary"])


def test_demo_model_summary_refuses_a_synthetic_run_report(tmp_path, monkeypatch) -> None:
    """A synthetic notebook report must not be served under the Sparkov label."""
    report = tmp_path / "report.json"
    report.write_text(
        json.dumps(
            {
                "status": "synthetic_mechanics_only",
                "input_manifest": {"feature_columns": ["amount_minor"], "dataset_sha256": "synthetic"},
                "models": {},
                "partition_counts": {},
                "prevalence": {"test": 0.0},
                "report_sha256": "synthetic",
            }
        ),
        encoding="utf-8",
    )
    monkeypatch.setattr(main, "_MODEL_REPORT_PATH", report)

    response = TestClient(create_app()).get("/demo/model-summary")

    assert response.status_code == 503
    assert response.json()["detail"] == "demo_model_summary_unavailable"
