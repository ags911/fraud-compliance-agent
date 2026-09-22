"""Point-in-time features for the richer Sparkov benchmark experiment.

Every feature of a row is computed from that row and from rows that occurred
strictly before it. Nothing here reads the fraud label, so no feature can be a
target encoding, and no later transaction can leak backwards into an earlier
row. The card and merchant keys exist only to group history offline; they are
replaced by anonymous integer codes on load and never become model features.

This module is offline research code. The served API must not import it, and
its output is Sparkov synthetic benchmark mechanics, not a runtime feature
contract: online equivalents are not established.
"""

from __future__ import annotations

from collections.abc import Sequence
from pathlib import Path

import numpy as np
import pandas as pd

CATEGORY_PREFIX = "category_"

# Only these source columns are read. Names, addresses, coordinates, date of
# birth, and job stay on disk and never enter memory.
RAW_COLUMNS = [
    "trans_date_trans_time",
    "cc_num",
    "merchant",
    "category",
    "amt",
    "is_fraud",
]

_EPOCH = pd.Timestamp("1970-01-01", tz="UTC")


def raw_sparkov_paths(repository_root: Path) -> tuple[Path, Path]:
    """Return the conventional local locations of the two raw Sparkov files.

    Args:
        repository_root: Located monorepo root.

    Returns:
        The `fraudTrain.csv` and `fraudTest.csv` paths under the git-ignored
        `data/raw/sparkov` directory. The files may not exist on every machine.
    """
    base = repository_root / "data" / "raw" / "sparkov"
    return base / "fraudTrain.csv", base / "fraudTest.csv"


def load_raw_sparkov(train_path: Path, test_path: Path) -> pd.DataFrame:
    """Load the two Sparkov files as one time-ordered, identifier-free frame.

    Args:
        train_path: Local `fraudTrain.csv`.
        test_path: Local `fraudTest.csv`.

    Returns:
        A frame sorted by event time with `event_time` (UTC), `card` and
        `merchant` as anonymous integer codes, `category`, `amount`, `is_fraud`,
        and `source` (`train` or `test`, the file each row came from).

    Raises:
        FileNotFoundError: If either file is absent.
        ValueError: If a timestamp cannot be parsed. Nothing is repaired.

    Side effects:
        Reads two local files. Nothing is written, and the source identifiers
        are discarded after being converted to codes.
    """
    frames = []
    for source, path in (("train", train_path), ("test", test_path)):
        raw = pd.read_csv(path, usecols=RAW_COLUMNS)
        raw["source"] = source
        frames.append(raw)
    combined = pd.concat(frames, ignore_index=True)

    # Codes are assigned across both files so one card or merchant keeps one
    # code, which is what lets history from train inform a later test row.
    frame = pd.DataFrame(
        {
            "event_time": pd.to_datetime(
                combined["trans_date_trans_time"], utc=True, errors="raise"
            ),
            "card": pd.factorize(combined["cc_num"])[0].astype("int64"),
            "merchant": pd.factorize(combined["merchant"])[0].astype("int64"),
            "category": combined["category"].astype(str),
            "amount": combined["amt"].astype("float64"),
            "is_fraud": combined["is_fraud"].astype("int8"),
            "source": combined["source"],
        }
    )
    # A stable sort keeps file order for identical timestamps, so the result is
    # reproducible.
    return frame.sort_values("event_time", kind="stable").reset_index(drop=True)


def build_features(
    frame: pd.DataFrame,
    categories: Sequence[str],
    windows_seconds: Sequence[int],
    minimum_history: int,
) -> pd.DataFrame:
    """Build point-in-time features for a time-ordered transaction frame.

    Args:
        frame: Rows sorted by `event_time`, with `card`, `merchant`, `category`,
            and `amount`. Any other column, including the label, is ignored.
        categories: The fixed category list to indicate. A category outside it
            gets all-zero indicators rather than a new column, so the feature
            set never depends on which rows are present.
        windows_seconds: Trailing windows for card activity counts and sums.
        minimum_history: Earlier card transactions required before an amount is
            compared with the card's own history. Below it the ratio is empty,
            not invented.

    Returns:
        One row per input row, in the same order, of base, category, and
        history features. Missing history is `NaN` (or zero for counts).

    Raises:
        ValueError: If `frame` is not sorted by `event_time`, because history
            would then include the future.

    Side effects:
        None. The input frame is not modified.
    """
    if not frame["event_time"].is_monotonic_increasing:
        raise ValueError("The frame must be time-ordered before history is built.")

    frame = frame.reset_index(drop=True)
    times = frame["event_time"]
    amount = frame["amount"].astype("float64")
    card = frame["card"]
    seconds = (times - _EPOCH).dt.total_seconds().to_numpy()

    features = pd.DataFrame(index=frame.index)
    features["amount"] = amount
    features["log_amount"] = np.log1p(amount)
    features["event_hour_utc"] = times.dt.hour.astype("int8")
    day_of_week = times.dt.dayofweek
    features["event_day_of_week_utc"] = day_of_week.astype("int8")
    features["is_weekend"] = (day_of_week >= 5).astype("int8")
    for name in categories:
        features[f"{CATEGORY_PREFIX}{name}"] = (frame["category"] == name).astype(
            "int8"
        )

    # Expanding history. Row order is time order, so a running total minus the
    # row's own value is exactly the sum over earlier rows.
    card_groups = frame.groupby("card", sort=False)
    prior_count = card_groups.cumcount()
    prior_sum = amount.groupby(card, sort=False).cumsum() - amount
    prior_square_sum = (amount**2).groupby(card, sort=False).cumsum() - amount**2
    has_history = prior_count > 0
    prior_mean = (prior_sum / prior_count).where(has_history)
    prior_variance = (prior_square_sum / prior_count - prior_mean**2).clip(lower=0)
    prior_std = np.sqrt(prior_variance)
    enough_history = prior_count >= minimum_history

    features["card_prior_count"] = prior_count
    features["card_prior_mean_amount"] = prior_mean
    features["amount_to_card_prior_mean"] = (amount / prior_mean).where(
        enough_history & (prior_mean > 0)
    )
    features["amount_zscore_vs_card_prior"] = ((amount - prior_mean) / prior_std).where(
        enough_history & (prior_std > 0)
    )
    features["card_seconds_since_prior"] = seconds - pd.Series(seconds).groupby(
        card, sort=False
    ).shift(1)

    # Familiarity: how often this card has used this merchant or category, and
    # how widely this merchant is used at all, counting only earlier rows.
    features["card_merchant_prior_count"] = frame.groupby(
        ["card", "merchant"], sort=False
    ).cumcount()
    features["card_category_prior_count"] = frame.groupby(
        ["card", "category"], sort=False
    ).cumcount()
    features["merchant_prior_count"] = frame.groupby("merchant", sort=False).cumcount()

    # Trailing windows. For each card, a binary search finds the earlier rows
    # inside the window; side="left" excludes the row's own timestamp.
    window_counts = {w: np.zeros(len(frame), dtype="int64") for w in windows_seconds}
    window_sums = {w: np.zeros(len(frame), dtype="float64") for w in windows_seconds}
    amount_values = amount.to_numpy()
    for positions in card_groups.indices.values():
        card_times = seconds[positions]
        running = np.concatenate(([0.0], np.cumsum(amount_values[positions])))
        upper = np.searchsorted(card_times, card_times, side="left")
        for window in windows_seconds:
            lower = np.searchsorted(card_times, card_times - window, side="left")
            window_counts[window][positions] = upper - lower
            window_sums[window][positions] = running[upper] - running[lower]
    for window in windows_seconds:
        features[f"card_count_last_{window}s"] = window_counts[window]
        features[f"card_amount_sum_last_{window}s"] = window_sums[window]
    return features
