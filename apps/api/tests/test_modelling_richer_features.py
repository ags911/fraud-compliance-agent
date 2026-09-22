"""Point-in-time behaviour of the richer Sparkov benchmark features.

Every feature of a row may depend only on rows that occurred before it. These
tests pin that rule with hand-computed values and a prefix-invariance check, so
a future refactor cannot leak later transactions or the label into a feature.
"""

import numpy as np
import pandas as pd
import pytest

from modelling.richer_features import CATEGORY_PREFIX, build_features, raw_sparkov_paths

CATEGORIES = ("food", "travel")
WINDOWS = (3600, 86400)


def _frame() -> pd.DataFrame:
    """Return a tiny, time-ordered transaction frame for two cards."""
    times = pd.to_datetime(
        [
            "2020-01-01 00:00:00",  # card A, first ever
            "2020-01-01 00:10:00",  # card B, first ever
            "2020-01-01 00:30:00",  # card A, 30 min after its first
            "2020-01-01 02:00:00",  # card A, 90 min after its second
            "2020-01-02 03:00:00",  # card A, more than a day later
        ],
        utc=True,
    )
    return pd.DataFrame(
        {
            "event_time": times,
            "card": [1, 2, 1, 1, 1],
            "merchant": ["m1", "m1", "m1", "m2", "m1"],
            "category": ["food", "food", "food", "travel", "other"],
            "amount": [10.0, 50.0, 30.0, 20.0, 40.0],
        }
    )


def test_history_features_use_only_strictly_earlier_rows() -> None:
    """Counts, gaps, and window sums match hand-computed earlier-only values."""
    features = build_features(_frame(), CATEGORIES, WINDOWS, minimum_history=2)

    # Card A's third row (index 3) sees exactly two earlier card-A rows.
    row = features.iloc[3]
    assert row["card_prior_count"] == 2
    assert row["card_seconds_since_prior"] == 5400
    # Only the 00:30 row falls inside the 1-hour window ending at 02:00.
    assert row["card_count_last_3600s"] == 0
    assert row["card_count_last_86400s"] == 2
    assert row["card_amount_sum_last_86400s"] == pytest.approx(40.0)
    # Prior mean of 10 and 30 is 20, so a 20 payment is exactly typical.
    assert row["card_prior_mean_amount"] == pytest.approx(20.0)
    assert row["amount_to_card_prior_mean"] == pytest.approx(1.0)
    # First-ever rows have no history rather than an invented one.
    assert features.iloc[0]["card_prior_count"] == 0
    assert np.isnan(features.iloc[0]["card_seconds_since_prior"])
    assert features.iloc[1]["card_prior_count"] == 0


def test_payee_style_familiarity_counts_earlier_rows_only() -> None:
    """A card-merchant pair is familiar only after it has been seen before."""
    features = build_features(_frame(), CATEGORIES, WINDOWS, minimum_history=2)

    assert features["card_merchant_prior_count"].tolist() == [0, 0, 1, 0, 2]
    assert features["merchant_prior_count"].tolist() == [0, 1, 2, 0, 3]


def test_ratio_is_undefined_until_enough_history_exists() -> None:
    """A ratio against a one-transaction mean would be noise, so it is empty."""
    features = build_features(_frame(), CATEGORIES, WINDOWS, minimum_history=2)

    assert features["amount_to_card_prior_mean"].iloc[:3].isna().all()
    assert not np.isnan(features["amount_to_card_prior_mean"].iloc[3])


def test_features_are_prefix_invariant() -> None:
    """Adding later rows never changes an earlier row's features."""
    full = build_features(_frame(), CATEGORIES, WINDOWS, minimum_history=2)
    prefix = build_features(_frame().iloc[:3], CATEGORIES, WINDOWS, minimum_history=2)

    pd.testing.assert_frame_equal(full.iloc[:3].reset_index(drop=True), prefix)


def test_the_label_can_never_reach_a_feature() -> None:
    """A stray target column in the input is not carried into the features."""
    frame = _frame().assign(is_fraud=[0, 1, 0, 1, 0])
    features = build_features(frame, CATEGORIES, WINDOWS, minimum_history=2)

    assert "is_fraud" not in features.columns
    assert not any("fraud" in name for name in features.columns)


def test_category_indicators_use_the_fixed_list_and_zero_for_unseen() -> None:
    """Unseen categories map to all-zero indicators instead of new columns."""
    features = build_features(_frame(), CATEGORIES, WINDOWS, minimum_history=2)

    indicators = [f"{CATEGORY_PREFIX}{name}" for name in CATEGORIES]
    assert [c for c in features.columns if c.startswith(CATEGORY_PREFIX)] == indicators
    assert features.iloc[4][indicators].sum() == 0
    assert features.iloc[3][f"{CATEGORY_PREFIX}travel"] == 1


def test_unsorted_input_is_rejected() -> None:
    """History features are only meaningful on a time-ordered frame."""
    with pytest.raises(ValueError, match="time-ordered"):
        build_features(_frame().iloc[::-1], CATEGORIES, WINDOWS, minimum_history=2)


def test_base_time_features_are_utc_and_identifier_free() -> None:
    """Base features carry no card or merchant identifier."""
    features = build_features(_frame(), CATEGORIES, WINDOWS, minimum_history=2)

    assert features["event_hour_utc"].tolist() == [0, 0, 0, 2, 3]
    assert features["is_weekend"].tolist() == [0, 0, 0, 0, 0]
    assert not {"card", "merchant", "cc_num"} & set(features.columns)


def test_raw_sparkov_paths_stay_under_the_git_ignored_data_directory(
    repository_root,
) -> None:
    """The corpus is only ever read from the ignored local directory."""
    train, test = raw_sparkov_paths(repository_root)

    assert train.parent == test.parent == repository_root / "data" / "raw" / "sparkov"
    assert (train.name, test.name) == ("fraudTrain.csv", "fraudTest.csv")
