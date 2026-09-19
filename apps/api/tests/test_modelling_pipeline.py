"""The run mode decides what may be read, and a gated run reads nothing."""

import json

import pytest

from modelling.config import config_path
from modelling.datasets import SYNTHETIC_DATASET_DIGEST, contract_path
from modelling.pipeline import load_dataset, mode_notice, prepare_run
from modelling.report import (
    APPROVED_MODE,
    GATE_MODE,
    MODE_ENVIRONMENT_VARIABLE,
    REPORT_PATH_ENVIRONMENT_VARIABLE,
    SYNTHETIC_MODE,
)


@pytest.fixture
def isolated_root(tmp_path, repository_root):
    """Return a temporary root holding only the committed configuration.

    The accepted training contract is deliberately absent, so an approved-mode
    run in this root must fail rather than read anything.
    """
    destination = config_path(tmp_path)
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(
        config_path(repository_root).read_text(encoding="utf-8"), encoding="utf-8"
    )
    return tmp_path


def test_preparing_a_run_loads_no_data(isolated_root) -> None:
    """Setup resolves the mode, configuration, and destination only."""
    setup = prepare_run(isolated_root, {MODE_ENVIRONMENT_VARIABLE: SYNTHETIC_MODE})

    assert setup.mode == SYNTHETIC_MODE
    assert setup.config.random_seed > 0
    assert setup.context["mode"] == SYNTHETIC_MODE
    # Setup writes nothing: the only file in the root is the configuration it read.
    assert [path.name for path in isolated_root.rglob("*") if path.is_file()] == [
        config_path(isolated_root).name
    ]
    assert not setup.report_path.is_relative_to(isolated_root)


def test_a_gated_run_loads_nothing(isolated_root) -> None:
    """Gate mode is the default-safe state: no fixture, no corpus, no model."""
    setup = prepare_run(isolated_root, {MODE_ENVIRONMENT_VARIABLE: GATE_MODE})

    assert load_dataset(setup) is None


def test_a_synthetic_run_uses_the_fixture_and_no_corpus(isolated_root) -> None:
    """Synthetic mode generates its own data and records that in the digest."""
    setup = prepare_run(isolated_root, {MODE_ENVIRONMENT_VARIABLE: SYNTHETIC_MODE})

    dataset = load_dataset(setup)

    assert dataset is not None
    assert dataset.manifest is None
    assert dataset.contract.dataset_sha256 == SYNTHETIC_DATASET_DIGEST
    assert len(dataset.frame) == setup.config.synthetic_fixture.rows


def test_an_approved_run_without_a_contract_fails(isolated_root) -> None:
    """Approved mode cannot proceed where no accepted contract exists."""
    setup = prepare_run(isolated_root, {MODE_ENVIRONMENT_VARIABLE: APPROVED_MODE})

    with pytest.raises(RuntimeError, match="Missing accepted model-training contract"):
        load_dataset(setup)


def test_an_approved_run_without_the_pinned_dataset_fails(
    isolated_root, repository_root
) -> None:
    """The contract alone is not enough: the checksum-pinned corpus must exist."""
    contract = json.loads(contract_path(repository_root).read_text(encoding="utf-8"))
    destination = contract_path(isolated_root)
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(contract), encoding="utf-8")
    setup = prepare_run(isolated_root, {MODE_ENVIRONMENT_VARIABLE: APPROVED_MODE})

    with pytest.raises(RuntimeError, match="unavailable locally"):
        load_dataset(setup)


def test_the_setup_carries_the_redirected_report_path(isolated_root, tmp_path) -> None:
    """The safe runner's redirect survives into the run's setup."""
    destination = tmp_path / "redirected.json"

    setup = prepare_run(
        isolated_root,
        {
            MODE_ENVIRONMENT_VARIABLE: SYNTHETIC_MODE,
            REPORT_PATH_ENVIRONMENT_VARIABLE: str(destination),
        },
    )

    assert setup.report_path == destination.resolve()


@pytest.mark.parametrize("mode", [GATE_MODE, SYNTHETIC_MODE, APPROVED_MODE])
def test_every_mode_has_a_standing_safety_notice(mode) -> None:
    """The notebook prints this before anything is loaded."""
    notice = mode_notice(mode)

    assert notice
    assert notice == notice.strip()


def test_the_synthetic_notice_refuses_a_performance_claim() -> None:
    """Mechanics-only output must be labelled wherever it is produced."""
    assert "cannot be used as fraud-model evidence" in mode_notice(SYNTHETIC_MODE)


def test_the_gate_notice_states_that_training_is_disabled() -> None:
    """The gated default explains itself rather than failing silently."""
    assert "disabled by default" in mode_notice(GATE_MODE)
