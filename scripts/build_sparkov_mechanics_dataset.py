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
# The complete, ordered output schema. Anything else (identifiers, names,
# locations) must never reach the output file.
OUTPUT_COLUMNS = [*FEATURE_COLUMNS, *SLICE_COLUMNS, "is_fraud", "partition"]
PARTITIONS = ("train", "calibration", "test")
QUALITY_CHECKS = (
    "approved_columns_only",
    "no_missing_values",
    "value_ranges",
    "binary_target",
    "row_counts_reconcile",
    "partition_time_order",
)


def check_chunk_quality(chunk: pd.DataFrame) -> None:
    """Fail fast when a transformed chunk breaks the dataset contract.

    Args:
        chunk: Output of `transform_chunk` for one source chunk.

    Raises:
        ValueError: If the columns differ from the approved schema, any value is
            missing, a feature is out of range, or the target is not binary. The
            message names the failed check only; it never includes row values.
    """
    if list(chunk.columns) != OUTPUT_COLUMNS:
        raise ValueError("Quality check failed: output columns differ from the approved schema.")
    if chunk.isna().any().any():
        raise ValueError("Quality check failed: a transformed chunk contains missing values.")
    amount = chunk["amount_source_value"]
    ranges_valid = (
        np.isfinite(amount).all()
        and (amount >= 0).all()
        and chunk["event_hour_utc"].between(0, 23).all()
        and chunk["event_day_of_week_utc"].between(0, 6).all()
        and chunk["is_weekend"].isin([0, 1]).all()
        and chunk["partition"].isin(PARTITIONS).all()
    )
    if not ranges_valid:
        raise ValueError("Quality check failed: a feature value is out of range.")
    if not chunk["is_fraud"].isin([0, 1]).all():
        raise ValueError("Quality check failed: the target column is not binary.")


def check_row_counts(partition_counts: dict[str, int], source_row_counts: dict[str, int]) -> None:
    """Confirm every source row landed in exactly one output partition.

    Args:
        partition_counts: Rows written to the train, calibration, and test partitions.
        source_row_counts: Rows read from `source_train` and `source_test`.

    Raises:
        ValueError: If any row was dropped or duplicated between source and output.
    """
    if (
        partition_counts["train"] + partition_counts["calibration"] != source_row_counts["source_train"]
        or partition_counts["test"] != source_row_counts["source_test"]
    ):
        raise ValueError("Quality check failed: partition row counts do not reconcile with the source files.")


def check_partition_time_order(bounds: dict[str, tuple[pd.Timestamp, pd.Timestamp]], cutpoint: pd.Timestamp) -> None:
    """Confirm the partitions are chronological and never overlap.

    Args:
        bounds: Earliest and latest source timestamp seen in each partition.
        cutpoint: The chronological train/calibration boundary.

    Raises:
        ValueError: If a partition is missing, train extends past the cutpoint,
            calibration begins at or before it, or the partitions are not
            ordered train, then calibration, then test.
    """
    if set(bounds) != set(PARTITIONS):
        raise ValueError("Quality check failed: a chronological partition is empty.")
    _, train_end = bounds["train"]
    calibration_start, calibration_end = bounds["calibration"]
    test_start, _ = bounds["test"]
    if train_end > cutpoint or calibration_start <= cutpoint:
        raise ValueError("Quality check failed: partitions do not respect the chronological cutpoint.")
    if not (train_end <= calibration_start and calibration_end <= test_start):
        raise ValueError("Quality check failed: partitions are not ordered train, calibration, then test.")


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
    source_row_counts: dict[str, int] = {"source_train": 0, "source_test": 0}
    time_bounds: dict[str, tuple[pd.Timestamp, pd.Timestamp]] = {}
    for source_path, source_partition in ((train_path, "source_train"), (test_path, "source_test")):
        for chunk in pd.read_csv(source_path, usecols=SOURCE_COLUMNS, chunksize=100_000):
            transformed = transform_chunk(chunk, source_partition, cutpoint)
            check_chunk_quality(transformed)
            source_row_counts[source_partition] += len(chunk)
            timestamps = pd.to_datetime(chunk["trans_date_trans_time"], errors="raise", utc=True)
            for partition in partition_counts:
                in_partition = (transformed["partition"] == partition).to_numpy()
                rows = transformed.loc[in_partition, "is_fraud"]
                partition_counts[partition] += len(rows)
                partition_positive_counts[partition] += int(rows.sum())
                if in_partition.any():
                    # Track each partition's time span so ordering can be proven
                    # after the final chunk, without holding rows in memory.
                    earliest, latest = timestamps[in_partition].min(), timestamps[in_partition].max()
                    known = time_bounds.get(partition)
                    time_bounds[partition] = (
                        earliest if known is None else min(known[0], earliest),
                        latest if known is None else max(known[1], latest),
                    )
            transformed.to_csv(output_path, mode="w" if first_chunk else "a", header=first_chunk, index=False)
            first_chunk = False

    if any(partition_positive_counts[partition] == 0 for partition in partition_positive_counts):
        raise ValueError("Every chronological partition must contain both target classes.")
    check_row_counts(partition_counts, source_row_counts)
    check_partition_time_order(time_bounds, cutpoint)
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
        "quality_checks": {
            "passed": True,
            "checks": list(QUALITY_CHECKS),
            "source_row_counts": {"train_file": source_row_counts["source_train"], "test_file": source_row_counts["source_test"]},
            "partition_time_bounds_utc": {name: [span[0].isoformat(), span[1].isoformat()] for name, span in time_bounds.items()},
        },
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
