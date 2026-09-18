"""Consistency tests between accepted contracts, scripts, notebooks, and evidence.

These catch drift between files that must agree but are edited separately: the
training contract, the build script, the committed benchmark report, and the
notebook sequence.
"""

import hashlib
import json

import pytest
from conftest import load_script

CONTRACT = "docs/contracts/model-training-contract.v1.json"
REPORT = "docs/proposals/fast-path-model-release.candidate.json"
REQUIRED_CONTRACT_FIELDS = {
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


@pytest.fixture(scope="module")
def contract(repository_root) -> dict:
    """Return the accepted model-training contract."""
    return json.loads((repository_root / CONTRACT).read_text(encoding="utf-8"))


@pytest.fixture(scope="module")
def report(repository_root) -> dict:
    """Return the committed candidate evaluation report."""
    return json.loads((repository_root / REPORT).read_text(encoding="utf-8"))


def test_training_contract_is_accepted_and_complete(contract) -> None:
    """Notebook 08's approved mode refuses anything less than this."""
    assert REQUIRED_CONTRACT_FIELDS <= set(contract)
    assert contract["approval_status"] == "accepted"


def test_training_contract_pins_a_local_ignored_dataset(contract) -> None:
    """The dataset stays under the git-ignored data folder and is pinned by checksum."""
    assert not contract["dataset_path"].startswith("/")
    assert contract["dataset_path"].startswith("data/")
    assert len(contract["dataset_sha256"]) == 64
    int(contract["dataset_sha256"], 16)


def test_training_contract_matches_the_build_script(contract, sparkov_build) -> None:
    """The contract's schema is exactly what the build script produces."""
    assert contract["feature_columns"] == sparkov_build.FEATURE_COLUMNS
    assert contract["slice_columns"] == sparkov_build.SLICE_COLUMNS
    assert contract["target_column"] == "is_fraud"
    assert {contract["train_partition"], contract["calibration_partition"], contract["test_partition"]} == set(sparkov_build.PARTITIONS)


def test_training_contract_keeps_the_no_authority_boundary(contract) -> None:
    """Mechanics evidence can never be read as production training or a payment decision."""
    assert "never production training" in contract["training_scope"]
    assert any("No score can approve" in boundary for boundary in contract["release_boundary"])


def test_committed_report_agrees_with_the_contract(contract, report) -> None:
    """The report was produced by an approved-mode run of this exact contract."""
    assert report["status"] == "candidate_evaluation_pending_review"
    assert report["input_manifest"]["feature_columns"] == contract["feature_columns"]
    assert report["input_manifest"]["dataset_sha256"] == contract["dataset_sha256"]
    assert report["input_manifest"]["target_column"] == contract["target_column"]
    assert report["input_manifest"]["release_criteria_version"] == contract["release_criteria_version"]
    assert set(report["partition_counts"]) == {"train", "calibration", "test"}
    assert set(report["models"]) == {"logistic_regression_baseline", "xgboost_candidate"}


def test_committed_report_has_not_been_edited_by_hand(report) -> None:
    """The report's own checksum matches its payload, using the notebook's method."""
    payload = {key: value for key, value in report.items() if key != "report_sha256"}
    expected = hashlib.sha256(json.dumps(payload, sort_keys=True, indent=2).encode("utf-8")).hexdigest()

    assert report["report_sha256"] == expected


def test_committed_report_grants_no_authority(report) -> None:
    """The report states that it selects no threshold and promotes no model."""
    limitations = " ".join(report["limitations"])
    assert "cannot support a production fraud-performance claim" in limitations
    assert "does not promote a model" in limitations
    assert "no runtime promotion" in report["decision_recommendation"]


def test_notebook_pipeline_lists_every_notebook_in_order(repository_root) -> None:
    """The status tool's step list matches the notebooks on disk, with no gaps."""
    steps = load_script("notebook_pipeline").STEPS
    on_disk = sorted(path.name for path in (repository_root / "notebooks").glob("[0-9][0-9]-*.ipynb"))

    assert [step.number for step in steps] == list(range(1, len(steps) + 1))
    assert [step.filename for step in steps] == on_disk
    assert all(step.filename.startswith(f"{step.number:02d}-") for step in steps)
    assert all(step.state and step.requirement for step in steps)
