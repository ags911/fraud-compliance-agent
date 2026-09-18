"""Build a local-only, mechanics-only Sparkov model dataset.

The output intentionally supports notebook and evaluation mechanics only. It
uses no source identifiers, personal/location fields, labels as features, or
cross-partition learned transformations. Neither the output nor its model is a
production risk artifact.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

SOURCE_COLUMNS = ["trans_date_trans_time", "amt", "category", "is_fraud"]
FEATURE_COLUMNS = ["amount_source_value", "event_hour_utc", "event_day_of_week_utc", "is_weekend"]
SLICE_COLUMNS = ["category", "amount_band"]


def file_checksum(path: Path) -> str:
    """Return a SHA-256 checksum without retaining source content."""
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def train_cutpoint(path: Path, train_fraction: float) -> pd.Timestamp:
    """Return a deterministic chronological cutpoint from the training source."""
    timestamps = pd.read_csv(path, usecols=["trans_date_trans_time"])["trans_date_trans_time"]
    parsed = pd.to_datetime(timestamps, errors="raise", utc=True).sort_values(ignore_index=True)
    if parsed.empty:
        raise ValueError("Training source contains no timestamps.")
    index = max(0, min(len(parsed) - 1, int(len(parsed) * train_fraction) - 1))
    return parsed.iloc[index]


def amount_band(values: pd.Series) -> pd.Series:
    """Return fixed, source-unit bands for reporting slices without fitting data."""
    return pd.cut(
        values,
        bins=[-np.inf, 10, 50, 100, 500, np.inf],
        labels=["up_to_10", "10_to_50", "50_to_100", "100_to_500", "over_500"],
        include_lowest=True,
    ).astype("string")


def transform_chunk(chunk: pd.DataFrame, partition: str, cutpoint: pd.Timestamp | None) -> pd.DataFrame:
    """Create permitted mechanics columns for one source chunk."""
    timestamp = pd.to_datetime(chunk["trans_date_trans_time"], errors="raise", utc=True)
    amount = pd.to_numeric(chunk["amt"], errors="raise")
    target = pd.to_numeric(chunk["is_fraud"], errors="raise").astype("int8")
    if partition == "source_train":
        if cutpoint is None:
            raise ValueError("A chronological cutpoint is required for source training data.")
        partition_values = np.where(timestamp <= cutpoint, "train", "calibration")
    else:
        partition_values = np.full(len(chunk), "test", dtype=object)
    return pd.DataFrame(
        {
            "amount_source_value": amount.astype("float64"),
            "event_hour_utc": timestamp.dt.hour.astype("int8"),
            "event_day_of_week_utc": timestamp.dt.dayofweek.astype("int8"),
            "is_weekend": (timestamp.dt.dayofweek >= 5).astype("int8"),
            "category": chunk["category"].astype("string"),
            "amount_band": amount_band(amount),
            "is_fraud": target,
            "partition": partition_values,
        }
    )


def build_dataset(train_path: Path, test_path: Path, output_path: Path, train_fraction: float) -> dict[str, Any]:
    """Write a deterministic local CSV and return sanitised construction evidence."""
    if not 0 < train_fraction < 1:
        raise ValueError("--train-fraction must be strictly between zero and one.")
    cutpoint = train_cutpoint(train_path, train_fraction)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    if output_path.exists():
        output_path.unlink()

    first_chunk = True
    partition_counts: dict[str, int] = {"train": 0, "calibration": 0, "test": 0}
    partition_positive_counts: dict[str, int] = {"train": 0, "calibration": 0, "test": 0}
    for source_path, source_partition in ((train_path, "source_train"), (test_path, "source_test")):
        for chunk in pd.read_csv(source_path, usecols=SOURCE_COLUMNS, chunksize=100_000):
            transformed = transform_chunk(chunk, source_partition, cutpoint)
            for partition in partition_counts:
                rows = transformed.loc[transformed["partition"] == partition, "is_fraud"]
                partition_counts[partition] += len(rows)
                partition_positive_counts[partition] += int(rows.sum())
            transformed.to_csv(output_path, mode="w" if first_chunk else "a", header=first_chunk, index=False)
            first_chunk = False

    if any(partition_positive_counts[partition] == 0 for partition in partition_positive_counts):
        raise ValueError("Every chronological partition must contain both target classes.")
    return {
        "artifact": "sparkov-mechanics-dataset",
        "status": "local-mechanics-only",
        "dataset_sha256": file_checksum(output_path),
        "feature_columns": FEATURE_COLUMNS,
        "slice_columns": SLICE_COLUMNS,
        "target_column": "is_fraud",
        "partition_column": "partition",
        "chronological_train_cutpoint": cutpoint.isoformat(),
        "partition_counts": partition_counts,
        "partition_positive_counts": partition_positive_counts,
        "source_exclusions": ["all identifiers", "names", "addresses", "locations", "date_of_birth", "job", "is_fraud from features"],
        "limitations": [
            "Source time is used for offline mechanics only; online availability parity is not established.",
            "Sparkov labels and behaviour are simulated and do not establish fraud performance.",
            "No runtime scoring, policy threshold, or model promotion is authorised.",
        ],
    }


def parse_args() -> argparse.Namespace:
    """Parse explicit input and local-output paths."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--train", type=Path, required=True, help="Local Sparkov fraudTrain.csv path.")
    parser.add_argument("--test", type=Path, required=True, help="Local Sparkov fraudTest.csv path.")
    parser.add_argument("--output", type=Path, required=True, help="Ignored local output CSV path.")
    parser.add_argument("--manifest-output", type=Path, help="Optional sanitised local manifest path.")
    parser.add_argument("--train-fraction", type=float, default=0.8, help="Chronological source-train fraction used for base-model fitting.")
    return parser.parse_args()


def main() -> int:
    """Build the narrow dataset after validating explicit local paths."""
    args = parse_args()
    train_path = args.train.expanduser().resolve()
    test_path = args.test.expanduser().resolve()
    output_path = args.output.expanduser().resolve()
    if not train_path.is_file() or not test_path.is_file():
        print("Both --train and --test must be readable local CSV files.")
        return 2
    try:
        manifest = build_dataset(train_path, test_path, output_path, args.train_fraction)
    except (OSError, UnicodeError, ValueError, pd.errors.ParserError) as error:
        print(f"Mechanics dataset build failed: {error}")
        return 1

    payload = json.dumps(manifest, indent=2, sort_keys=True)
    if args.manifest_output:
        destination = args.manifest_output.expanduser().resolve()
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_text(f"{payload}\n", encoding="utf-8")
        print(f"Wrote sanitised manifest: {destination}")
    else:
        print(payload)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
