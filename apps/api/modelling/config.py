"""Load the versioned, reviewable evaluation configuration.

Seeds, hyperparameters, the threshold grid, and the synthetic fixture's shape
live in `config/fast-path-model-training.v1.json` rather than in notebook cells,
so a reviewer can see every parameter that produced a recorded report. Nothing
here is a fraud threshold, a promotion criterion, or an action limit.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

CONFIG_RELATIVE_PATH = Path("config") / "fast-path-model-training.v1.json"
BASELINE_MODEL_ID = "logistic_regression_baseline"
CANDIDATE_MODEL_ID = "xgboost_candidate"
# The report and the demo model-summary contract both key on these ids, so a
# rename is a contract change, not a local edit.
MODEL_IDS = (BASELINE_MODEL_ID, CANDIDATE_MODEL_ID)
SUPPORTED_SCHEMA_VERSIONS = frozenset({"1.0"})


@dataclass(frozen=True)
class BaselineModelConfig:
    """Hyperparameters for the interpretable logistic-regression baseline."""

    imputation_strategy: str
    class_weight: str
    max_iter: int


@dataclass(frozen=True)
class CandidateModelConfig:
    """Hyperparameters for the XGBoost comparison candidate.

    The class-imbalance weight is deliberately absent: it is derived from the
    train partition at fit time so it cannot drift from the data it describes.
    """

    imputation_strategy: str
    objective: str
    eval_metric: str
    n_estimators: int
    max_depth: int
    learning_rate: float
    subsample: float
    colsample_bytree: float
    n_jobs: int
    tree_method: str


@dataclass(frozen=True)
class ThresholdSweepConfig:
    """Inclusive-start, exclusive-stop grid of candidate thresholds to report."""

    start: float
    stop: float
    step: float


@dataclass(frozen=True)
class EvaluationConfig:
    """Reporting parameters that describe, but never select, a policy point."""

    threshold_sweep: ThresholdSweepConfig
    reliability_bins: int


@dataclass(frozen=True)
class SyntheticFixtureConfig:
    """Shape of the synthetic mechanics fixture.

    The fixture exercises the pipeline end to end without any corpus. Its target
    is rule-shaped by construction, so its metrics describe this configuration
    and nothing else.
    """

    rows: int
    train_rows: int
    calibration_rows: int
    start_timestamp_utc: str
    amount_lognormal_mean: float
    amount_lognormal_sigma: float
    velocity_poisson_lambda: float
    account_age_days_minimum: int
    account_age_days_maximum_exclusive: int
    target_logit: dict[str, float]


@dataclass(frozen=True)
class TrainingConfig:
    """Every parameter of one evaluation run, loaded from the versioned file."""

    config_version: str
    schema_version: str
    status: str
    random_seed: int
    baseline: BaselineModelConfig
    candidate: CandidateModelConfig
    evaluation: EvaluationConfig
    synthetic_fixture: SyntheticFixtureConfig


def config_path(repository_root: Path) -> Path:
    """Return the versioned configuration file's location.

    Args:
        repository_root: Located monorepo root.

    Returns:
        Path to `config/fast-path-model-training.v1.json`.
    """
    return repository_root / CONFIG_RELATIVE_PATH


def _require(document: dict[str, Any], key: str, source: Path) -> Any:
    """Return a required configuration value or fail with a reviewable message.

    Args:
        document: Parsed configuration object or one of its sections.
        key: Key that must be present.
        source: File the value came from, named in the error only.

    Returns:
        The value stored under `key`.

    Raises:
        RuntimeError: If the key is missing. The message never includes a value,
            so configuration content cannot leak into notebook output.
    """
    if key not in document:
        raise RuntimeError(f"{source.name} is missing the required field {key!r}.")
    return document[key]


def load_training_config(repository_root: Path) -> TrainingConfig:
    """Load and validate the evaluation configuration.

    Args:
        repository_root: Located monorepo root.

    Returns:
        The parsed configuration with each section typed.

    Raises:
        RuntimeError: If the file is absent, is not valid JSON, declares an
            unsupported schema version, omits a required field, or describes a
            model id this library does not implement. Every failure stops the
            run rather than falling back to an invented default.
    """
    source = config_path(repository_root)
    if not source.is_file():
        raise RuntimeError(
            "Missing evaluation configuration at config/fast-path-model-training.v1.json."
        )
    try:
        document = json.loads(source.read_text(encoding="utf-8"))
    except json.JSONDecodeError as error:
        raise RuntimeError(f"{source.name} is not valid JSON.") from error

    schema_version = str(_require(document, "schema_version", source))
    if schema_version not in SUPPORTED_SCHEMA_VERSIONS:
        raise RuntimeError(
            f"{source.name} declares unsupported schema_version {schema_version!r}."
        )

    models = _require(document, "models", source)
    missing_models = sorted(set(MODEL_IDS) - set(models))
    if missing_models:
        raise RuntimeError(
            f"{source.name} does not configure: " + ", ".join(missing_models)
        )

    evaluation = _require(document, "evaluation", source)
    sweep = _require(evaluation, "threshold_sweep", source)
    fixture = _require(document, "synthetic_fixture", source)
    try:
        return TrainingConfig(
            config_version=str(_require(document, "config_version", source)),
            schema_version=schema_version,
            status=str(_require(document, "status", source)),
            random_seed=int(_require(document, "random_seed", source)),
            baseline=BaselineModelConfig(**models[BASELINE_MODEL_ID]),
            candidate=CandidateModelConfig(**models[CANDIDATE_MODEL_ID]),
            evaluation=EvaluationConfig(
                threshold_sweep=ThresholdSweepConfig(
                    start=float(_require(sweep, "start", source)),
                    stop=float(_require(sweep, "stop", source)),
                    step=float(_require(sweep, "step", source)),
                ),
                reliability_bins=int(_require(evaluation, "reliability_bins", source)),
            ),
            synthetic_fixture=SyntheticFixtureConfig(**fixture),
        )
    except TypeError as error:
        # An unexpected or missing hyperparameter must fail loudly: silently
        # dropping one would change a recorded result without a visible edit.
        raise RuntimeError(
            f"{source.name} does not match the expected configuration shape."
        ) from error
