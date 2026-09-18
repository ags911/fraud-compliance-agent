"""Seeded, Sparkov-shaped source files for tests.

Everything here is synthetic and generated on demand, so the data-preparation
path can be exercised on a clean checkout and in CI without the real corpus,
which is never committed. Each named defect produces one deliberately broken
variant so the quality gates can be shown to fail for the right reason.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd

CATEGORIES = ["grocery_pos", "gas_transport", "shopping_net", "misc_pos"]
# Identifier and personal columns exist in the real source and must be dropped.
EXTRA_SOURCE_COLUMNS = ["cc_num", "merchant", "first", "last", "trans_num"]
DEFECTS = (
    "missing_amount",
    "missing_category",
    "negative_amount",
    "non_binary_label",
    "unparseable_timestamp",
    "test_before_train",
    "no_calibration_fraud",
)


def make_source_frames(
    seed: int = 20260919,
    train_rows: int = 600,
    test_rows: int = 200,
    defect: str | None = None,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Build a train and a test source frame, optionally with one defect.

    Args:
        seed: Seed for the random columns; the same seed gives identical frames.
        train_rows: Rows in the training source.
        test_rows: Rows in the test source, which always starts after training.
        defect: One of `DEFECTS`, or None for a clean dataset.

    Returns:
        The training and test frames with Sparkov's column names.

    Raises:
        ValueError: If `defect` is not a known defect name.
    """
    if defect is not None and defect not in DEFECTS:
        raise ValueError(f"Unknown defect: {defect}")
    rng = np.random.default_rng(seed)

    def frame(start: pd.Timestamp, rows: int) -> pd.DataFrame:
        # A fixed 37-minute step keeps timestamps strictly increasing, and a
        # fraud label on every 17th row guarantees both classes in every slice.
        timestamps = pd.date_range(start, periods=rows, freq="37min")
        return pd.DataFrame(
            {
                "trans_date_trans_time": timestamps.strftime("%Y-%m-%d %H:%M:%S"),
                "cc_num": rng.integers(10**15, 10**16, rows),
                "merchant": [f"merchant_{value}" for value in rng.integers(0, 50, rows)],
                "first": "Synthetic",
                "last": "Person",
                "trans_num": [f"tx{value:012d}" for value in rng.integers(0, 10**12, rows)],
                "amt": rng.lognormal(mean=3.5, sigma=1.0, size=rows).round(2),
                "category": rng.choice(CATEGORIES, rows),
                "is_fraud": (np.arange(rows) % 17 == 0).astype(int),
            }
        )

    train_start = pd.Timestamp("2019-01-01 00:00:00")
    train = frame(train_start, train_rows)
    train_end = pd.Timestamp(train["trans_date_trans_time"].iloc[-1])
    test_start = train_start - pd.Timedelta(days=30) if defect == "test_before_train" else train_end + pd.Timedelta(hours=1)
    test = frame(test_start, test_rows)

    if defect == "missing_amount":
        train.loc[5, "amt"] = np.nan
    elif defect == "missing_category":
        train.loc[5, "category"] = np.nan
    elif defect == "negative_amount":
        train.loc[5, "amt"] = -5.0
    elif defect == "non_binary_label":
        train.loc[5, "is_fraud"] = 2
    elif defect == "unparseable_timestamp":
        train.loc[5, "trans_date_trans_time"] = "not a date"
    elif defect == "no_calibration_fraud":
        # Calibration is the last 20% of the training source in time order.
        train.loc[int(train_rows * 0.8) :, "is_fraud"] = 0
    return train, test


def write_source_files(directory: Path, defect: str | None = None, **kwargs: int) -> tuple[Path, Path]:
    """Write the train and test frames as CSV files and return their paths.

    Args:
        directory: Existing directory to write into, normally pytest's `tmp_path`.
        defect: Optional defect name passed to `make_source_frames`.
        **kwargs: `seed`, `train_rows`, or `test_rows` overrides.

    Returns:
        The training and test CSV paths.
    """
    train, test = make_source_frames(defect=defect, **kwargs)
    train_path, test_path = directory / "fraudTrain.csv", directory / "fraudTest.csv"
    train.to_csv(train_path, index=False)
    test.to_csv(test_path, index=False)
    return train_path, test_path
