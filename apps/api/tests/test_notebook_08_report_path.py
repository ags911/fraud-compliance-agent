"""Regression tests: only an approved-mode run may write the reviewed report.

A direct default-mode run of Notebook 08 once overwrote the reviewed Sparkov
report with synthetic output. These tests execute the notebook's setup cell in
isolation, which only resolves paths, and never train or write anything.
"""

import json
import tempfile
from pathlib import Path

import pytest

NOTEBOOK = "notebooks/08-fast-path-model-training-and-evaluation.ipynb"
REVIEWED_REPORT = "docs/proposals/fast-path-model-release.candidate.json"


@pytest.fixture(scope="module")
def setup_source(repository_root) -> str:
    """Return the source of the notebook cell that resolves the mode and paths."""
    notebook = json.loads((repository_root / NOTEBOOK).read_text(encoding="utf-8"))
    for cell in notebook["cells"]:
        source = "".join(cell["source"])
        if cell["cell_type"] == "code" and "REVIEWED_REPORT_PATH" in source:
            return source
    raise AssertionError("Notebook 08 no longer defines REVIEWED_REPORT_PATH.")


def _resolve(source: str, monkeypatch, mode: str | None, report_path: Path | None = None) -> dict:
    """Run the setup cell with the given environment and return its namespace."""
    monkeypatch.delenv("FCA_NOTEBOOK08_MODE", raising=False)
    monkeypatch.delenv("FCA_NOTEBOOK08_REPORT_PATH", raising=False)
    if mode is not None:
        monkeypatch.setenv("FCA_NOTEBOOK08_MODE", mode)
    if report_path is not None:
        monkeypatch.setenv("FCA_NOTEBOOK08_REPORT_PATH", str(report_path))
    namespace: dict = {}
    exec(compile(source, "notebook-08-setup-cell", "exec"), namespace)
    return namespace


@pytest.mark.parametrize("mode", [None, "synthetic", "gate"])
def test_non_approved_modes_never_default_to_the_reviewed_report(setup_source, monkeypatch, repository_root, mode) -> None:
    """Default, synthetic, and gate runs write to a temporary file, not the repository."""
    namespace = _resolve(setup_source, monkeypatch, mode)
    report_path = namespace["REPORT_PATH"]

    assert report_path != (repository_root / REVIEWED_REPORT).resolve()
    assert report_path.is_relative_to(Path(tempfile.gettempdir()).resolve())
    assert not report_path.is_relative_to(repository_root)


def test_default_mode_is_synthetic(setup_source, monkeypatch) -> None:
    """An unset mode is the safe synthetic mode, never approved."""
    assert _resolve(setup_source, monkeypatch, None)["MODE"] == "synthetic"


def test_approved_mode_writes_the_reviewed_report(setup_source, monkeypatch, repository_root) -> None:
    """Approved mode is the only mode that targets the reviewed artifact."""
    namespace = _resolve(setup_source, monkeypatch, "approved")

    assert namespace["REPORT_PATH"] == (repository_root / REVIEWED_REPORT).resolve()


def test_an_explicit_report_path_is_honoured(setup_source, monkeypatch, tmp_path) -> None:
    """The safe runner redirects output through this variable, whatever the mode."""
    destination = tmp_path / "report.json"

    assert _resolve(setup_source, monkeypatch, "approved", destination)["REPORT_PATH"] == destination.resolve()


def test_an_unknown_mode_is_rejected(setup_source, monkeypatch) -> None:
    """A typo cannot fall through to a mode that writes the reviewed report."""
    with pytest.raises(RuntimeError, match="gate, synthetic, or approved"):
        _resolve(setup_source, monkeypatch, "aproved")
