"""Train the local-only display model from git-ignored Sparkov source files."""

from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

from sklearn.linear_model import LogisticRegression
from sklearn.metrics import average_precision_score, brier_score_loss, roc_auc_score
from xgboost import XGBClassifier

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "apps" / "api"))

from modelling.richer_benchmark import assign_partitions
from modelling.richer_features import (
    build_features,
    load_raw_sparkov,
    raw_sparkov_paths,
)


def _canonical(value: object) -> bytes:
    """Encode a JSON document without timestamps or platform-specific whitespace."""
    return json.dumps(value, sort_keys=True, separators=(",", ":")).encode("utf-8")


def main() -> None:
    """Train, calibrate, measure, and write the portable artifact deterministically.

    Raises:
        FileNotFoundError: If the owner-local raw Sparkov CSV files are absent.

    Side effects:
        Reads git-ignored synthetic corpus files and replaces only the packaged
        booster and manifest. It never changes a serving dependency or policy.
    """
    config = json.loads((ROOT / "config/sandbox-portable-model.v1.json").read_text())
    train_path, test_path = raw_sparkov_paths(ROOT)
    frame = load_raw_sparkov(train_path, test_path)
    # The offline builder remains the authority for point-in-time Sparkov history.
    rich = build_features(frame, (), (), minimum_history=1)
    names = config["features"]
    features = rich.loc[:, names]
    partitions = assign_partitions(
        frame["source"],
        frame["event_time"],
        __import__("pandas").Timestamp(
            config["partitioning"]["chronological_train_cutpoint"]
        ),
    )
    train_mask, calibration_mask, test_mask = (
        partitions == name for name in ("train", "calibration", "test")
    )
    options = config["xgboost"]
    model = XGBClassifier(
        objective="binary:logistic",
        eval_metric="logloss",
        random_state=config["random_seed"],
        n_estimators=options["n_estimators"],
        max_depth=options["max_depth"],
        learning_rate=options["learning_rate"],
        subsample=options["subsample"],
        colsample_bytree=options["colsample_bytree"],
        nthread=options["nthread"],
        tree_method=options["tree_method"],
    )
    model.fit(features[train_mask], frame.loc[train_mask, "is_fraud"], verbose=False)
    calibration_margin = model.predict(features[calibration_mask], output_margin=True)
    # Platt fitting sees the dedicated chronological calibration partition only.
    platt = LogisticRegression(random_state=config["random_seed"], solver="lbfgs")
    platt.fit(
        calibration_margin.reshape(-1, 1), frame.loc[calibration_mask, "is_fraud"]
    )
    test_margin = model.predict(features[test_mask], output_margin=True)
    scores = platt.predict_proba(test_margin.reshape(-1, 1))[:, 1]
    model_path = ROOT / "apps/api/server/sandbox_model/model.json"
    manifest_path = ROOT / "apps/api/server/sandbox_model/manifest.json"
    booster = json.loads(model.get_booster().save_raw("json"))
    model_raw = _canonical(booster)
    manifest = {
        "model_version": "sandbox-portable-xgb-v1",
        "feature_order": names,
        "raw_sparkov_sha256": {
            path.name: hashlib.sha256(path.read_bytes()).hexdigest()
            for path in (train_path, test_path)
        },
        "model_sha256": hashlib.sha256(model_raw).hexdigest(),
        "platt": {"a": float(platt.coef_[0, 0]), "b": float(platt.intercept_[0])},
        "metrics": {
            "pr_auc": float(
                average_precision_score(frame.loc[test_mask, "is_fraud"], scores)
            ),
            "roc_auc": float(roc_auc_score(frame.loc[test_mask, "is_fraud"], scores)),
            "brier": float(brier_score_loss(frame.loc[test_mask, "is_fraud"], scores)),
        },
        "xgboost_version": __import__("xgboost").__version__,
        "scope": config["scope"],
    }
    manifest["manifest_sha256"] = hashlib.sha256(_canonical(manifest)).hexdigest()
    model_path.write_bytes(model_raw)
    manifest_path.write_bytes(_canonical(manifest))


if __name__ == "__main__":
    main()
