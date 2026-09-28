"""Parity and fail-closed tests for ADR-024's display-only model."""

from __future__ import annotations

import json
import shutil
from datetime import date, datetime, timezone

import numpy as np
import pandas as pd
from xgboost import Booster, XGBClassifier

from modelling.richer_features import build_features
from server.sandbox_model.features import PortablePayment, build_feature_vector
from server.sandbox_model.scorer import PortableModel, load_portable_model


def test_tree_walker_matches_xgboost_margins_with_missing_values() -> None:
    """Keep the standard-library walker numerically aligned with XGBoost."""
    random = np.random.default_rng(20260928)
    rows = random.normal(size=(80, 8)).astype("float32")
    rows[::7, 4] = np.nan
    labels = (rows[:, 0] + rows[:, 1] > 0).astype("int8")
    model = XGBClassifier(
        objective="binary:logistic",
        n_estimators=8,
        max_depth=3,
        random_state=20260928,
        nthread=1,
        tree_method="hist",
    ).fit(rows, labels)
    portable = PortableModel(
        json.loads(model.get_booster().save_raw("json")), "test", 1, 0
    )
    expected = model.predict(rows, output_margin=True)
    actual = np.array(
        [
            portable.score(
                tuple(None if np.isnan(value) else float(value) for value in row)
            )[0]
            for row in rows
        ]
    )
    assert np.allclose(actual, 1 / (1 + np.exp(-expected)), atol=1e-6)


def test_committed_artifact_matches_xgboost_on_seeded_rows(repository_root) -> None:
    """Keep the committed booster and Platt parameters aligned with XGBoost."""
    model = load_portable_model()
    assert model is not None
    rows = np.array(
        [[1.1, 2, 0, 4, 12.5, np.nan, 1, 2], [2.2, 6, 1, 0, np.nan, np.nan, 0, 0]],
        dtype="float32",
    )
    booster = Booster()
    booster.load_model(
        str(repository_root / "apps/api/server/sandbox_model/model.json")
    )
    margins = booster.inplace_predict(rows, predict_type="margin")
    expected = 1 / (1 + np.exp(-(model.platt_a * margins + model.platt_b)))
    actual = np.array(
        [
            model.score(
                tuple(None if np.isnan(value) else float(value) for value in row)
            )[0]
            for row in rows
        ]
    )
    assert np.allclose(actual, expected, atol=1e-6)


def test_tampered_artifact_is_refused_once(
    tmp_path, monkeypatch, caplog, repository_root
) -> None:
    """Refuse a swapped package resource without preventing API startup."""
    package = repository_root / "apps/api/server/sandbox_model"
    shutil.copy(package / "model.json", tmp_path / "model.json")
    manifest = json.loads((package / "manifest.json").read_text())
    manifest["model_version"] = "tampered"
    (tmp_path / "manifest.json").write_text(json.dumps(manifest))
    monkeypatch.setattr(
        "server.sandbox_model.scorer.importlib.resources.files", lambda _: tmp_path
    )
    assert load_portable_model() is None
    assert [record.message for record in caplog.records] == [
        "sandbox_portable_model_unavailable"
    ]


def test_server_features_match_offline_builder_for_same_payments() -> None:
    """Keep the served eight-feature history semantics aligned with offline code."""
    payments = [
        PortablePayment(date(2020, 3, 2), "a", 1000, "payee-a", "food"),
        PortablePayment(date(2020, 3, 3), "b", 3000, "payee-b", "food"),
        PortablePayment(date(2020, 3, 4), "c", 2000, "payee-a", "travel"),
    ]
    frame = pd.DataFrame(
        {
            "event_time": [
                datetime.combine(item.event_date, datetime.min.time(), timezone.utc)
                for item in payments
            ],
            "card": [0, 0, 0],
            "merchant": [item.payee_reference for item in payments],
            "category": [item.category_bucket for item in payments],
            "amount": [item.amount_minor / 100 for item in payments],
        }
    )
    offline = build_features(frame, (), (), minimum_history=1).iloc[-1]
    served = build_feature_vector(payments[-1], payments[:-1])
    columns = [
        "log_amount",
        "event_day_of_week_utc",
        "is_weekend",
        "card_prior_count",
        "card_prior_mean_amount",
        "amount_to_card_prior_mean",
        "card_merchant_prior_count",
        "card_category_prior_count",
    ]
    assert np.allclose(
        np.asarray(served, dtype=float),
        offline[columns].to_numpy(dtype=float),
        equal_nan=True,
    )
