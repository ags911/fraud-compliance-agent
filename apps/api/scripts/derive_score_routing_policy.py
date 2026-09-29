"""Derive the immutable ADR-025 routing policy from local Sparkov CSV files."""

from __future__ import annotations

import hashlib
import json
import math
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "apps" / "api"))

from modelling.richer_benchmark import assign_partitions
from modelling.richer_features import (
    build_features,
    load_raw_sparkov,
    raw_sparkov_paths,
)
from server.sandbox_model.scorer import load_portable_model


def choose_thresholds(
    scores: list[float], labels: list[int]
) -> tuple[dict[str, float | str], dict[str, float | str]]:
    """Select ordered CHALLENGE and HOLD thresholds from rounded test scores.

    Args:
        scores: Five-decimal portable-model scores on the chronological test set.
        labels: Matching binary Sparkov labels.

    Returns:
        Metadata for the lowest precision-qualified CHALLENGE and HOLD rules.

    Raises:
        ValueError: If inputs are invalid or HOLD cannot exceed CHALLENGE.
    """
    if len(scores) != len(labels) or not scores:
        raise ValueError("scores and labels must be non-empty and aligned")
    candidates = sorted(set(scores))

    def metric(threshold: float) -> dict[str, float]:
        flagged = [
            label
            for score, label in zip(scores, labels, strict=True)
            if score >= threshold
        ]
        positives = sum(labels)
        true_positives = sum(flagged)
        return {
            "precision": true_positives / len(flagged),
            "recall": true_positives / positives if positives else 0.0,
            "alert_rate": len(flagged) / len(scores),
        }

    def first(target: float) -> tuple[float, dict[str, float]] | None:
        for candidate in candidates:
            values = metric(candidate)
            if values["precision"] >= target:
                return candidate, values
        return None

    challenge_hit = first(0.50)
    if challenge_hit is None:
        raise ValueError("CHALLENGE precision target was not reached")
    hold_hit = first(0.90)
    if hold_hit is None:
        rank = max(1, math.ceil(0.001 * len(scores)))
        hold_value = sorted(scores, reverse=True)[rank - 1]
        hold_metrics = metric(hold_value)
        hold_rule = "top_0.1_percent_alert_rate"
    else:
        hold_value, hold_metrics = hold_hit
        hold_rule = "precision_at_least_0.90"
    challenge_value, challenge_metrics = challenge_hit
    if hold_value <= challenge_value:
        raise ValueError("HOLD threshold must be above CHALLENGE")
    return (
        {
            "value": challenge_value,
            "rule": "precision_at_least_0.50",
            **challenge_metrics,
        },
        {"value": hold_value, "rule": hold_rule, **hold_metrics},
    )


def main() -> None:
    """Write compact sorted policy JSON from checked local raw Sparkov data.

    Raises:
        FileNotFoundError: If gitignored raw Sparkov data is unavailable.
        ValueError: If corpus checksums or derived threshold ordering fail.

    Side effects:
        Replaces only ``config/sandbox-score-routing.v1.json`` with generated
        content. The raw corpus is read locally and is never written.
    """
    model = load_portable_model()
    if model is None:
        raise ValueError("portable model is unavailable")
    manifest = json.loads(
        (ROOT / "apps/api/server/sandbox_model/manifest.json").read_text()
    )
    train_path, test_path = raw_sparkov_paths(ROOT)
    raw_hashes = {
        path.name: hashlib.sha256(path.read_bytes()).hexdigest()
        for path in (train_path, test_path)
    }
    if raw_hashes != manifest["raw_sparkov_sha256"]:
        raise ValueError("raw Sparkov checksums differ from model manifest")
    config = json.loads((ROOT / "config/sandbox-portable-model.v1.json").read_text())
    frame = load_raw_sparkov(train_path, test_path)
    rich = build_features(frame, (), (), minimum_history=1)
    partitions = assign_partitions(
        frame["source"],
        frame["event_time"],
        __import__("pandas").Timestamp(
            config["partitioning"]["chronological_train_cutpoint"]
        ),
    )
    test = rich.loc[partitions == "test", config["features"]]
    scores = [
        round(
            model.score(
                tuple(None if pd.isna(value) else float(value) for value in row)
            )[0],
            5,
        )
        for row in test.itertuples(index=False, name=None)
    ]
    labels = [int(value) for value in frame.loc[partitions == "test", "is_fraud"]]
    challenge, hold = choose_thresholds(scores, labels)
    policy = {
        "model_version": model.model_version,
        "policy_version": "score-routing-v1",
        "source": {
            "partition": "Sparkov chronological test",
            "raw_sparkov_sha256": raw_hashes,
        },
        "thresholds": {"challenge": challenge, "hold": hold},
    }
    (ROOT / "config/sandbox-score-routing.v1.json").write_text(
        json.dumps(policy, sort_keys=True, separators=(",", ":")) + "\n"
    )


if __name__ == "__main__":
    main()
