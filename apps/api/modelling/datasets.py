"""Dataset contracts, loading, and schema validation for evaluation runs.

Two sources exist and no others. Approved mode reads the local CSV that the
accepted training contract pins by checksum; synthetic mode generates a seeded
fixture that exercises mechanics only. Neither path repairs, resamples, or
imputes source data: a dataset that does not match its declared schema stops
the run.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from modelling.config import SyntheticFixtureConfig

CONTRACT_RELATIVE_PATH = Path("docs") / "contracts" / "model-training-contract.v1.json"
# A contract missing any of these cannot describe a reviewable run, so approved
# mode refuses it rather than inferring the absent value.
REQUIRED_ACCEPTED_FIELDS = frozenset(
    {
        "approval_status",
        "dataset_path",
        "dataset_sha256",
        "target_column",
        "feature_columns",
        "partition_column",
        "calibration_partition",
        "calibration_procedure",
        "test_partition",
        "slice_columns",
        "release_criteria_version",
    }
)
ACCEPTED_APPROVAL_STATUS = "accepted"
TRAIN_PARTITION = "train"
SYNTHETIC_DATASET_DIGEST = "synthetic-mechanics-only"
SYNTHETIC_FEATURE_COLUMNS = (
    "amount_minor",
    "velocity_6h",
    "account_age_days",
    "is_new_payee",
)


@dataclass(frozen=True)
class DatasetContract:
    """The declared schema and partitioning of one evaluation dataset.

    Approved runs build this from the accepted training contract; synthetic runs
    build it from the fixture's own fixed schema. Both carry a dataset digest so
    the report identifies its input without copying any row.
    """

    target_column: str
    feature_columns: tuple[str, ...]
    partition_column: str
    train_partition: str
    calibration_partition: str
    test_partition: str
    calibration_procedure: str
    slice_columns: tuple[str, ...]
    dataset_sha256: str
    release_criteria_version: str

    @property
    def partitions(self) -> tuple[str, str, str]:
        """Return the declared train, calibration, and test partition names."""
        return (self.train_partition, self.calibration_partition, self.test_partition)


def contract_path(repository_root: Path) -> Path:
    """Return the accepted model-training contract's location.

    Args:
        repository_root: Located monorepo root.

    Returns:
        Path to `docs/contracts/model-training-contract.v1.json`.
    """
    return repository_root / CONTRACT_RELATIVE_PATH


def load_accepted_manifest(repository_root: Path) -> dict[str, Any]:
    """Load only a complete, explicitly accepted training contract.

    Args:
        repository_root: Located monorepo root.

    Returns:
        The parsed contract document.

    Raises:
        RuntimeError: If the contract is absent, is not valid JSON, omits a
            required field, or is not marked accepted. Approved mode must never
            proceed on an inferred or partial contract.
    """
    source = contract_path(repository_root)
    if not source.is_file():
        raise RuntimeError(
            "Missing accepted model-training contract at "
            "docs/contracts/model-training-contract.v1.json. Create and approve it "
            "through the contract/ADR process; do not infer values here."
        )
    try:
        manifest = json.loads(source.read_text(encoding="utf-8"))
    except json.JSONDecodeError as error:
        raise RuntimeError(f"{source.name} is not valid JSON.") from error

    missing = sorted(REQUIRED_ACCEPTED_FIELDS - set(manifest))
    if missing or manifest.get("approval_status") != ACCEPTED_APPROVAL_STATUS:
        raise RuntimeError(
            "Model-training contract is not accepted or is incomplete: "
            + ", ".join(missing or ["approval_status"])
        )
    return manifest


def contract_from_manifest(manifest: dict[str, Any]) -> DatasetContract:
    """Convert an accepted training contract into a dataset contract.

    Args:
        manifest: Document returned by `load_accepted_manifest`.

    Returns:
        The declared schema, partition names, and dataset digest.

    Raises:
        KeyError: If a required field is absent, which `load_accepted_manifest`
            has already excluded for contracts loaded through it.
    """
    return DatasetContract(
        target_column=str(manifest["target_column"]),
        feature_columns=tuple(str(column) for column in manifest["feature_columns"]),
        partition_column=str(manifest["partition_column"]),
        # The train partition name is optional in the contract's older shape;
        # the build adapter has always emitted "train".
        train_partition=str(manifest.get("train_partition", TRAIN_PARTITION)),
        calibration_partition=str(manifest["calibration_partition"]),
        test_partition=str(manifest["test_partition"]),
        calibration_procedure=str(manifest["calibration_procedure"]),
        slice_columns=tuple(str(column) for column in manifest["slice_columns"]),
        dataset_sha256=str(manifest["dataset_sha256"]),
        release_criteria_version=str(manifest["release_criteria_version"]),
    )


def synthetic_contract() -> DatasetContract:
    """Return the fixed schema of the synthetic mechanics fixture.

    Returns:
        A contract whose digest and release-criteria version state plainly that
        the run is mechanics-only and supports no release decision.
    """
    return DatasetContract(
        target_column="target",
        feature_columns=SYNTHETIC_FEATURE_COLUMNS,
        partition_column="partition",
        train_partition=TRAIN_PARTITION,
        calibration_partition="calibration",
        test_partition="test",
        calibration_procedure="synthetic-diagnostic-only",
        slice_columns=("synthetic_slice",),
        dataset_sha256=SYNTHETIC_DATASET_DIGEST,
        release_criteria_version="not-applicable",
    )


def synthetic_mechanics_dataset(
    fixture: SyntheticFixtureConfig, random_seed: int
) -> pd.DataFrame:
    """Generate the seeded synthetic fixture.

    Args:
        fixture: Row counts, distributions, and target coefficients.
        random_seed: Seed for every random draw, so the frame is reproducible.

    Returns:
        A frame carrying the synthetic contract's features, target, partition,
        and reporting slice.

    Raises:
        ValueError: If the declared train and calibration rows do not leave at
            least one test row.
    """
    test_rows = fixture.rows - fixture.train_rows - fixture.calibration_rows
    if test_rows < 1:
        raise ValueError(
            "The synthetic fixture's train and calibration rows leave no test partition."
        )
    rng = np.random.default_rng(random_seed)
    size = fixture.rows
    timestamp = pd.date_range(
        fixture.start_timestamp_utc.replace("Z", "+00:00"), periods=size, freq="h"
    )
    amount = rng.lognormal(
        mean=fixture.amount_lognormal_mean,
        sigma=fixture.amount_lognormal_sigma,
        size=size,
    )
    velocity_6h = rng.poisson(lam=fixture.velocity_poisson_lambda, size=size)
    account_age_days = rng.integers(
        fixture.account_age_days_minimum,
        fixture.account_age_days_maximum_exclusive,
        size=size,
    )
    is_new_payee = rng.integers(0, 2, size=size)

    # This target is deliberately rule-shaped: a fixed logit over the same
    # features the models receive. It validates mechanics only and must never be
    # read as fraud-performance evidence.
    logit = fixture.target_logit
    synthetic_logit = (
        logit["intercept"]
        + logit["amount"] * amount
        + logit["velocity_6h"] * velocity_6h
        + logit["is_new_payee"] * is_new_payee
        + logit["account_age_days"] * account_age_days
    )
    synthetic_probability = 1 / (1 + np.exp(-synthetic_logit))
    target = rng.binomial(1, np.clip(synthetic_probability, 0.001, 0.999))

    # Partitions are contiguous and chronological, matching the approved
    # protocol's shape rather than a random split.
    position = np.arange(size)
    partition = np.where(
        position < fixture.train_rows,
        TRAIN_PARTITION,
        np.where(
            position < fixture.train_rows + fixture.calibration_rows,
            "calibration",
            "test",
        ),
    )
    return pd.DataFrame(
        {
            "event_time": timestamp,
            "amount_minor": np.round(amount * 100).astype(int),
            "velocity_6h": velocity_6h,
            "account_age_days": account_age_days,
            "is_new_payee": is_new_payee,
            "target": target,
            "partition": partition,
            "synthetic_slice": np.where(is_new_payee == 1, "new_payee", "known_payee"),
        }
    )


def load_approved_dataset(
    manifest: dict[str, Any], repository_root: Path
) -> pd.DataFrame:
    """Load the contract-declared local CSV after verifying its checksum.

    Args:
        manifest: Accepted training contract declaring the path and digest.
        repository_root: Root that a relative declared path resolves against.

    Returns:
        The dataset exactly as stored, with no repair or transformation.

    Raises:
        RuntimeError: If the file is missing locally, is not a CSV, or its
            SHA-256 digest differs from the accepted contract. A mismatch means
            the evidence would not describe the approved dataset, so no
            substitute is accepted.

    Side effects:
        Reads the local dataset file. It never writes, copies, or uploads it.
    """
    dataset_path = Path(str(manifest["dataset_path"])).expanduser()
    if not dataset_path.is_absolute():
        dataset_path = repository_root / dataset_path
    if not dataset_path.is_file():
        raise RuntimeError(
            "Approved dataset path is unavailable locally. "
            "Do not replace it with another dataset."
        )
    if dataset_path.suffix.lower() != ".csv":
        raise RuntimeError(
            "This library accepts approved local CSV input only. "
            "Extend the accepted contract before using another format."
        )
    digest = hashlib.sha256(dataset_path.read_bytes()).hexdigest()
    if digest != manifest["dataset_sha256"]:
        raise RuntimeError(
            "Dataset checksum does not match the accepted training contract."
        )
    return pd.read_csv(dataset_path)


def validate_dataset(frame: pd.DataFrame, contract: DatasetContract) -> None:
    """Confirm a frame carries every declared column and partition.

    Args:
        frame: Loaded or generated dataset.
        contract: Schema the dataset must satisfy.

    Raises:
        RuntimeError: If a declared feature, target, partition, or slice column
            is absent, or if any declared partition has no rows. The message
            names columns and partitions only, never a value.
    """
    required_columns = {
        *contract.feature_columns,
        contract.target_column,
        contract.partition_column,
        *contract.slice_columns,
    }
    missing_columns = sorted(required_columns - set(frame.columns))
    if missing_columns:
        raise RuntimeError(
            "Dataset is missing declared columns: " + ", ".join(missing_columns)
        )
    present = set(frame[contract.partition_column].dropna().astype(str))
    missing_partitions = sorted(set(contract.partitions) - present)
    if missing_partitions:
        raise RuntimeError(
            "Declared train/calibration/test partitions are incomplete: "
            + ", ".join(missing_partitions)
        )
