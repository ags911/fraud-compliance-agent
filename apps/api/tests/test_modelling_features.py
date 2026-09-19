"""Partitioning selects declared columns and never mixes partitions."""

import pandas as pd
import pytest
from modelling_fixtures import (
    CALIBRATION_ROWS,
    TEST_ROWS,
    TINY_CONTRACT,
    TRAIN_ROWS,
    tiny_dataset,
)

from modelling.features import split_partitions


@pytest.fixture
def partitions():
    """Return the tiny dataset split on its declared partition column."""
    return split_partitions(tiny_dataset(), TINY_CONTRACT)


def test_every_row_lands_in_exactly_one_partition(partitions) -> None:
    """The split reconciles with the source, so no row is lost or duplicated."""
    assert partitions.counts == {
        "train": TRAIN_ROWS,
        "calibration": CALIBRATION_ROWS,
        "test": TEST_ROWS,
    }
    assert sum(partitions.counts.values()) == len(tiny_dataset())


def test_partitions_do_not_overlap(partitions) -> None:
    """Train, calibration, and test hold disjoint source rows."""
    train = set(partitions.train.index)
    calibration = set(partitions.calibration.index)
    test = set(partitions.test.index)

    assert not train & calibration
    assert not train & test
    assert not calibration & test


def test_prevalence_is_reported_per_partition(partitions) -> None:
    """The report's prevalence figures come from the partitions themselves."""
    prevalence = partitions.prevalence

    assert set(prevalence) == {"train", "calibration", "test"}
    assert all(0 < rate < 1 for rate in prevalence.values())
    assert prevalence["test"] == pytest.approx(
        float(partitions.test[TINY_CONTRACT.target_column].mean())
    )


def test_the_feature_matrix_holds_only_declared_columns_in_order(partitions) -> None:
    """A model never sees the target, the partition, or a reporting slice."""
    features = partitions.features(partitions.train)

    assert list(features.columns) == list(TINY_CONTRACT.feature_columns)
    assert TINY_CONTRACT.target_column not in features.columns
    assert TINY_CONTRACT.partition_column not in features.columns
    for slice_column in TINY_CONTRACT.slice_columns:
        assert slice_column not in features.columns


def test_a_single_class_partition_is_refused() -> None:
    """A partition with one outcome is rejected rather than resampled."""
    frame = tiny_dataset()
    test_rows = frame[TINY_CONTRACT.partition_column] == "test"
    frame.loc[test_rows, TINY_CONTRACT.target_column] = 0

    with pytest.raises(RuntimeError, match="both target classes"):
        split_partitions(frame, TINY_CONTRACT)


def test_partition_names_come_from_the_contract() -> None:
    """Renaming a partition in the contract renames it in the split."""
    frame = tiny_dataset()
    frame[TINY_CONTRACT.partition_column] = frame[
        TINY_CONTRACT.partition_column
    ].replace({"test": "holdout"})
    contract = type(TINY_CONTRACT)(
        **{**TINY_CONTRACT.__dict__, "test_partition": "holdout"}
    )

    partitions = split_partitions(frame, contract)

    assert partitions.counts["test"] == TEST_ROWS
    assert isinstance(partitions.test, pd.DataFrame)
