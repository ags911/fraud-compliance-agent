"""Run setup and mode-dependent data loading.

The run mode decides what may happen, so the decision lives here rather than in
notebook cells: a gated run loads no data at all, a synthetic run generates a
fixture, and only an approved run touches the checksum-pinned local corpus
declared by the accepted contract.
"""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import pandas as pd

from modelling.config import TrainingConfig, load_training_config
from modelling.datasets import (
    DatasetContract,
    contract_from_manifest,
    load_accepted_manifest,
    load_approved_dataset,
    synthetic_contract,
    synthetic_mechanics_dataset,
    validate_dataset,
)
from modelling.paths import git_revision
from modelling.report import (
    APPROVED_MODE,
    GATE_MODE,
    SYNTHETIC_MODE,
    resolve_mode,
    resolve_report_path,
    run_context,
)

MODE_NOTICES = {
    GATE_MODE: (
        "GATED — real model training is disabled by default. "
        "Set FCA_NOTEBOOK08_MODE=approved only after the accepted contract, corpus, "
        "feature schema, partitions, calibration procedure, and release criteria exist."
    ),
    SYNTHETIC_MODE: (
        "SYNTHETIC DEMONSTRATION MODE — the full workflow and visual diagnostics render. "
        "Labels are generated solely to exercise code and cannot be used as fraud-model evidence."
    ),
    APPROVED_MODE: (
        "APPROVED MODE — an accepted training contract is required, and only its "
        "declared local dataset path and checksum are used."
    ),
}


@dataclass(frozen=True)
class RunSetup:
    """Everything one evaluation run needs before it touches data."""

    mode: str
    config: TrainingConfig
    repository_root: Path
    report_path: Path
    context: dict[str, Any]


@dataclass(frozen=True)
class LoadedDataset:
    """A validated dataset with the contract that describes it.

    `manifest` is the accepted training contract for an approved run and `None`
    for a synthetic run, which has no approved provenance to record.
    """

    frame: pd.DataFrame
    contract: DatasetContract
    manifest: dict[str, Any] | None


def mode_notice(mode: str) -> str:
    """Return the standing safety notice for a run mode.

    Args:
        mode: Resolved run mode.

    Returns:
        The notice to print before any data is loaded.

    Raises:
        KeyError: If `mode` is not a known mode.
    """
    return MODE_NOTICES[mode]


def prepare_run(
    repository_root: Path, environment: Mapping[str, str] | None = None
) -> RunSetup:
    """Resolve the mode, configuration, report destination, and run context.

    Args:
        repository_root: Located monorepo root.
        environment: Variable source; the process environment by default.

    Returns:
        The run's setup. Resolving it loads no dataset and writes no file.

    Raises:
        RuntimeError: If the mode is unknown or the configuration is missing or
            malformed.
    """
    mode = resolve_mode(environment)
    config = load_training_config(repository_root)
    return RunSetup(
        mode=mode,
        config=config,
        repository_root=repository_root,
        report_path=resolve_report_path(mode, repository_root, environment),
        context=run_context(mode, config, git_revision(repository_root)),
    )


def load_dataset(setup: RunSetup) -> LoadedDataset | None:
    """Load and validate the dataset this run mode permits.

    Args:
        setup: Output of `prepare_run`.

    Returns:
        The validated dataset and its contract, or `None` in gate mode, where no
        data may be read at all.

    Raises:
        RuntimeError: If approved mode has no accepted contract, the declared
            dataset is absent or fails its checksum, or the loaded data does not
            match the declared schema and partitions.

    Side effects:
        Approved mode reads the contract-declared local dataset file. Nothing is
        written, copied, or sent anywhere.
    """
    if setup.mode == GATE_MODE:
        return None
    if setup.mode == APPROVED_MODE:
        manifest = load_accepted_manifest(setup.repository_root)
        contract = contract_from_manifest(manifest)
        frame = load_approved_dataset(manifest, setup.repository_root)
    else:
        manifest = None
        contract = synthetic_contract()
        frame = synthetic_mechanics_dataset(
            setup.config.synthetic_fixture, setup.config.random_seed
        )
    validate_dataset(frame, contract)
    return LoadedDataset(frame=frame, contract=contract, manifest=manifest)
