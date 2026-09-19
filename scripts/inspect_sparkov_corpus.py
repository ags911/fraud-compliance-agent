"""Create sanitised metadata for a locally held proposed Sparkov CSV.

The raw dataset remains outside Git. This utility deliberately emits schema,
aggregate label counts, and a checksum only; it never prints transaction rows,
identifiers, names, locations, or environment values.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import sys
from collections import Counter
from pathlib import Path
from typing import Any

REQUIRED_COLUMNS = frozenset(
    {"trans_date_trans_time", "amt", "merchant", "category", "trans_num", "is_fraud"}
)
SENSITIVE_COLUMNS = frozenset(
    {
        "cc_num",
        "first",
        "last",
        "gender",
        "street",
        "city",
        "state",
        "zip",
        "lat",
        "long",
        "dob",
        "job",
        "merch_lat",
        "merch_long",
    }
)


def file_checksum(path: Path) -> str:
    """Return a SHA-256 checksum without retaining source content."""
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def inspect_csv(path: Path) -> dict[str, Any]:
    """Inspect CSV structure and aggregates without returning raw row values."""
    with path.open("r", encoding="utf-8-sig", newline="") as source:
        reader = csv.DictReader(source)
        raw_columns = reader.fieldnames or []
        index_columns = [column for column in raw_columns if not column]
        columns = [column for column in raw_columns if column]
        missing_required = sorted(REQUIRED_COLUMNS.difference(columns))
        if missing_required:
            raise ValueError(
                f"Dataset is missing expected Sparkov columns: {', '.join(missing_required)}"
            )

        label_counts: Counter[str] = Counter()
        blank_counts: Counter[str] = Counter()
        row_count = 0
        for row in reader:
            row_count += 1
            for column in columns:
                if not (row.get(column) or "").strip():
                    blank_counts[column] += 1
            label_counts[(row.get("is_fraud") or "").strip()] += 1

    unexpected_labels = sorted(set(label_counts).difference({"0", "1"}))
    return {
        "schema_columns": columns,
        "ignored_export_index_columns": index_columns,
        "row_count": row_count,
        "label_counts": dict(sorted(label_counts.items())),
        "blank_counts": {column: blank_counts[column] for column in columns},
        "sensitive_columns_present": sorted(SENSITIVE_COLUMNS.intersection(columns)),
        "unexpected_label_values": unexpected_labels,
    }


def build_manifest(path: Path) -> dict[str, Any]:
    """Build a reviewable proposed-corpus manifest from local aggregate evidence."""
    inspection = inspect_csv(path)
    return {
        "manifest_version": "0.1",
        "status": "proposed-not-approved",
        "corpus": "Sparkov simulated credit-card transactions",
        "data_class": "local raw research/demo corpus; never committed",
        "source_terms": "Must be re-verified by the reviewer before use; see docs/proposals/sparkov-corpus-intake.proposed.md.",
        "file_sha256": file_checksum(path),
        "schema": inspection,
        "proposed_target": {
            "source_field": "is_fraud",
            "meaning": "unverified simulated source label",
            "availability_time": "unknown — review required",
        },
        "proposed_exclusions": [
            "cc_num",
            "first",
            "last",
            "gender",
            "street",
            "city",
            "state",
            "zip",
            "lat",
            "long",
            "dob",
            "job",
            "merch_lat",
            "merch_long",
        ],
        "limitations": [
            "Synthetic labels are not evidence of real-world fraud performance.",
            "No Plaid or production feature parity is implied.",
            "This manifest does not approve training, thresholds, serving, or release.",
        ],
    }


def parse_args() -> argparse.Namespace:
    """Parse the narrow, explicit local-file interface."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--dataset",
        type=Path,
        default=os.environ.get("FCA_SPARKOV_DATASET_PATH"),
        help="Path to a locally downloaded Sparkov CSV; defaults to FCA_SPARKOV_DATASET_PATH.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        help="Optional path for a sanitised JSON manifest. The raw dataset is never copied.",
    )
    return parser.parse_args()


def main() -> int:
    """Inspect an explicit local dataset path and optionally write safe metadata."""
    args = parse_args()
    if args.dataset is None:
        print(
            "Set FCA_SPARKOV_DATASET_PATH or pass --dataset with a local CSV path.",
            file=sys.stderr,
        )
        return 2
    dataset_path = args.dataset.expanduser().resolve()
    if not dataset_path.is_file():
        print(f"Dataset is not a readable file: {dataset_path}", file=sys.stderr)
        return 2

    try:
        manifest = build_manifest(dataset_path)
    except (OSError, UnicodeError, ValueError, csv.Error) as error:
        print(f"Dataset inspection failed: {error}", file=sys.stderr)
        return 1

    output = json.dumps(manifest, indent=2, sort_keys=True)
    if args.output:
        destination = args.output.expanduser().resolve()
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_text(f"{output}\n", encoding="utf-8")
        print(f"Wrote sanitised manifest: {destination}")
    else:
        print(output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
