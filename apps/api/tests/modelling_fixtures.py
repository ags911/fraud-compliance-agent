"""A tiny, fixed dataset for model-level tests.

Training the real pipelines on a small deterministic frame keeps the tests fast
and their expectations stable. The frame is shaped like an evaluation dataset
and is not fraud data of any kind.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from modelling.datasets import DatasetContract

TRAIN_ROWS = 60
CALIBRATION_ROWS = 30
TEST_ROWS = 30
TOTAL_ROWS = TRAIN_ROWS + CALIBRATION_ROWS + TEST_ROWS
FIXTURE_SEED = 7

TINY_CONTRACT = DatasetContract(
    target_column="target",
    feature_columns=("amount", "velocity", "age_days"),
    partition_column="partition",
    train_partition="train",
    calibration_partition="calibration",
    test_partition="test",
    calibration_procedure="test-fixture-only",
    slice_columns=("band",),
    dataset_sha256="tiny-fixture",
    release_criteria_version="not-applicable",
)


def tiny_dataset(seed: int = FIXTURE_SEED) -> pd.DataFrame:
    """Build the tiny evaluation-shaped frame.

    Args:
        seed: Seed for the feature draws; the same seed gives the same frame.

    Returns:
        A frame with `TINY_CONTRACT`'s columns, contiguous partitions, and both
        target classes in every partition. Every third row is positive, so the
        target is separable enough for a model to fit without being trivial.
    """
    rng = np.random.default_rng(seed)
    position = np.arange(TOTAL_ROWS)
    target = (position % 3 == 0).astype(int)
    # The features carry the signal plus noise, so a fitted model scores the
    # positive rows higher without reaching a degenerate perfect separation.
    amount = 100.0 + 40.0 * target + rng.normal(0, 12, TOTAL_ROWS)
    velocity = 1.0 + 2.0 * target + rng.normal(0, 0.8, TOTAL_ROWS)
    age_days = 500.0 - 150.0 * target + rng.normal(0, 60, TOTAL_ROWS)
    partition = np.where(
        position < TRAIN_ROWS,
        "train",
        np.where(position < TRAIN_ROWS + CALIBRATION_ROWS, "calibration", "test"),
    )
    return pd.DataFrame(
        {
            "amount": amount,
            "velocity": velocity,
            "age_days": age_days,
            "target": target,
            "partition": partition,
            # Two reporting slices, both with mixed outcomes in every partition.
            "band": np.where(position % 2 == 0, "low", "high"),
        }
    )
