"""Produce sanitised temporal and overlap evidence for the local Sparkov corpus.

The raw CSVs remain outside Git. This utility reports only aggregate coverage,
label totals, and overlap counts; it never emits timestamps per event or any
source identifier, customer-like reference, or transaction row.
"""

from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path
from typing import Any

import pandas as pd

REQUIRED_COLUMNS = frozenset(
    {"trans_date_trans_time", "cc_num", "trans_num", "is_fraud"}
)


def inspect_file(path: Path) -> tuple[dict[str, Any], set[str], set[str]]:
    """Return sanitised time/label metadata and aggregate-only reference sets."""
    row_count = 0
    label_counts: Counter[str] = Counter()
    unique_days: set[str] = set()
    customer_like_references: set[str] = set()
    event_references: set[str] = set()
    minimum_time: pd.Timestamp | None = None
    maximum_time: pd.Timestamp | None = None
    missing_time = 0
    missing_event_reference = 0

    for chunk in pd.read_csv(path, chunksize=100_000):
        missing_columns = REQUIRED_COLUMNS.difference(chunk.columns)
        if missing_columns:
            fields = ", ".join(sorted(missing_columns))
            raise ValueError(f"Dataset is missing expected Sparkov columns: {fields}")
        times = pd.to_datetime(
            chunk["trans_date_trans_time"], errors="coerce", utc=True
        )
        row_count += len(chunk)
        missing_time += int(times.isna().sum())
        missing_event_reference += int(chunk["trans_num"].isna().sum())
        if times.notna().any():
            chunk_minimum = times.min()
            chunk_maximum = times.max()
            minimum_time = (
                chunk_minimum
                if minimum_time is None
                else min(minimum_time, chunk_minimum)
            )
            maximum_time = (
                chunk_maximum
                if maximum_time is None
                else max(maximum_time, chunk_maximum)
            )
            unique_days.update(times.dropna().dt.date.astype(str))
        label_counts.update(chunk["is_fraud"].astype(str))
        customer_like_references.update(chunk["cc_num"].astype(str))
        event_references.update(chunk["trans_num"].astype(str))

    return (
        {
            "row_count": row_count,
            "minimum_event_time": minimum_time.isoformat()
            if minimum_time is not None
            else None,
            "maximum_event_time": maximum_time.isoformat()
            if maximum_time is not None
            else None,
            "unique_event_days": len(unique_days),
            "missing_event_time": missing_time,
            "missing_event_reference": missing_event_reference,
            "label_counts": dict(sorted(label_counts.items())),
            "unique_customer_like_reference_count": len(customer_like_references),
            "unique_event_reference_count": len(event_references),
        },
        customer_like_references,
        event_references,
    )


def parse_args() -> argparse.Namespace:
    """Parse explicit local paths; neither raw path is stored in output."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--train", type=Path, required=True, help="Local Sparkov fraudTrain.csv path."
    )
    parser.add_argument(
        "--test", type=Path, required=True, help="Local Sparkov fraudTest.csv path."
    )
    parser.add_argument(
        "--output", type=Path, help="Optional destination for sanitised JSON evidence."
    )
    return parser.parse_args()


def main() -> int:
    """Inspect two explicit corpus partitions without exposing source rows."""
    args = parse_args()
    train_path = args.train.expanduser().resolve()
    test_path = args.test.expanduser().resolve()
    if not train_path.is_file() or not test_path.is_file():
        print("Both --train and --test must be readable local CSV files.")
        return 2

    try:
        train_summary, train_customers, train_events = inspect_file(train_path)
        test_summary, test_customers, test_events = inspect_file(test_path)
    except (OSError, UnicodeError, ValueError, pd.errors.ParserError) as error:
        print(f"Temporal evidence inspection failed: {error}")
        return 1

    evidence = {
        "artifact": "sparkov-temporal-evidence",
        "status": "sanitised-local-observation",
        "train": train_summary,
        "test": test_summary,
        "cross_partition": {
            "customer_like_reference_overlap_count": len(
                train_customers.intersection(test_customers)
            ),
            "event_reference_overlap_count": len(
                train_events.intersection(test_events)
            ),
            "interpretation": "Customer-like reference overlap is expected historical continuity, not permission to use raw references as model features.",
        },
        "limitations": [
            "This checks source timestamp ordering and aggregate overlap only.",
            "It does not prove label maturity, online feature parity, or production representativeness.",
        ],
    }
    output = json.dumps(evidence, indent=2, sort_keys=True)
    if args.output:
        destination = args.output.expanduser().resolve()
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_text(f"{output}\n", encoding="utf-8")
        print(f"Wrote sanitised temporal evidence: {destination}")
    else:
        print(output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
