"""Contract tests for the read-only portfolio benchmark summary."""

from fastapi.testclient import TestClient

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
