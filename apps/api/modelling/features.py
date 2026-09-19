"""Partition selection and feature-matrix assembly.

Feature engineering happens upstream in the approved build adapter
(`scripts/build_sparkov_mechanics_dataset.py`), which is the only place a new
column may be derived. This module only selects the contract's declared columns
and splits the frame on its declared partition column, so nothing is learned
across a partition boundary and no leakage is introduced here.
"""

from __future__ import annotations

from dataclasses import dataclass

import pandas as pd

from modelling.datasets import DatasetContract


@dataclass(frozen=True)
class Partitions:
    """The train, calibration, and test rows of one validated dataset.

    The calibration partition is reserved by the accepted protocol and is held
    without being fitted on: this library reports uncalibrated diagnostics and
    selects no probability-calibration method.
    """

    train: pd.DataFrame
    calibration: pd.DataFrame
    test: pd.DataFrame
    contract: DatasetContract

    @property
    def counts(self) -> dict[str, int]:
        """Return the row count of each partition, for the release report."""
        return {
            "train": len(self.train),
            "calibration": len(self.calibration),
            "test": len(self.test),
        }

    @property
    def prevalence(self) -> dict[str, float]:
        """Return each partition's target rate, for the release report."""
        target = self.contract.target_column
        return {
            "train": float(self.train[target].mean()),
            "calibration": float(self.calibration[target].mean()),
            "test": float(self.test[target].mean()),
        }

    def features(self, frame: pd.DataFrame) -> pd.DataFrame:
        """Return the declared feature columns of `frame`, in contract order."""
        return frame[list(self.contract.feature_columns)]

    def target(self, frame: pd.DataFrame) -> pd.Series:
        """Return the declared target column of `frame`."""
        return frame[self.contract.target_column]


def split_partitions(frame: pd.DataFrame, contract: DatasetContract) -> Partitions:
    """Split a validated frame into its declared partitions.

    Args:
        frame: Dataset that has passed `validate_dataset`.
        contract: Schema declaring the partition column and partition names.

    Returns:
        The three partitions with the contract attached.

    Raises:
        RuntimeError: If any partition does not contain both target classes.
            Resampling or merging a partition silently would change what the
            recorded metrics mean, so the run stops instead.
    """
    partition_column = frame[contract.partition_column].astype(str)
    train = frame.loc[partition_column == contract.train_partition].copy()
    calibration = frame.loc[partition_column == contract.calibration_partition].copy()
    test = frame.loc[partition_column == contract.test_partition].copy()

    target = contract.target_column
    single_class = [
        name
        for name, part in (
            ("train", train),
            ("calibration", calibration),
            ("test", test),
        )
        if part[target].nunique() != 2
    ]
    if single_class:
        raise RuntimeError(
            "Every declared partition must contain both target classes; "
            "do not resample silently. Affected: " + ", ".join(single_class)
        )
    return Partitions(
        train=train, calibration=calibration, test=test, contract=contract
    )
