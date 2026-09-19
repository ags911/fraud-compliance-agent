"""The offline evaluation library stays outside the served API.

`modelling` depends on pandas, scikit-learn, XGBoost, and Plotly, which are
development dependencies. The served API must neither import it nor gain those
dependencies, and the evidence it produces must stay consistent with the
configuration and contract that describe it.
"""

import ast
import json

import pytest

from modelling.config import (
    BASELINE_MODEL_ID,
    CANDIDATE_MODEL_ID,
    load_training_config,
)
from modelling.report import reviewed_report_path

API_FORBIDDEN_IN_MODELLING = {"fastapi", "server", "starlette", "pydantic"}


def imported_roots(source: str) -> set[str]:
    """Return the top-level module names a Python source imports.

    Args:
        source: Python source text.

    Returns:
        Root package names from both `import` and `from ... import` statements.
        A relative import contributes nothing, because it cannot cross packages.
    """
    roots: set[str] = set()
    for node in ast.walk(ast.parse(source)):
        if isinstance(node, ast.Import):
            roots.update(alias.name.split(".")[0] for alias in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module and node.level == 0:
            roots.add(node.module.split(".")[0])
    return roots


def test_the_served_api_never_imports_the_modelling_library(repository_root) -> None:
    """A production image installed without dev dependencies must still start."""
    for path in sorted((repository_root / "apps" / "api" / "server").glob("*.py")):
        assert "modelling" not in imported_roots(path.read_text(encoding="utf-8")), path


def test_the_modelling_library_never_imports_the_api(repository_root) -> None:
    """Offline evaluation cannot depend on, or be triggered by, a request path."""
    for path in sorted((repository_root / "apps" / "api" / "modelling").glob("*.py")):
        roots = imported_roots(path.read_text(encoding="utf-8"))
        assert not roots & API_FORBIDDEN_IN_MODELLING, path


def test_the_api_runtime_dependencies_exclude_the_training_stack(
    repository_root,
) -> None:
    """scikit-learn, XGBoost, and Plotly stay development-only dependencies."""
    pyproject = (repository_root / "apps" / "api" / "pyproject.toml").read_text(
        encoding="utf-8"
    )
    runtime = pyproject.split("[project.optional-dependencies]")[0]

    for package in ("scikit-learn", "xgboost", "plotly", "pandas"):
        assert package not in runtime


@pytest.fixture(scope="module")
def committed_report(repository_root) -> dict:
    """Return the reviewed candidate report."""
    return json.loads(reviewed_report_path(repository_root).read_text(encoding="utf-8"))


def test_the_committed_report_used_the_configured_seed(
    repository_root, committed_report
) -> None:
    """A seed change without a rerun would leave the evidence unreproducible."""
    config = load_training_config(repository_root)

    assert committed_report["run_context"]["random_seed"] == config.random_seed


def test_the_committed_report_names_the_configuration_that_produced_it(
    repository_root, committed_report
) -> None:
    """The artifact points at the file holding the parameters of its run."""
    config = load_training_config(repository_root)

    assert committed_report["run_context"]["config_version"] == config.config_version


def test_the_configured_models_are_the_reported_models(
    repository_root, committed_report
) -> None:
    """The report, the configuration, and the demo summary key on the same ids."""
    config = load_training_config(repository_root)

    assert set(committed_report["models"]) == {BASELINE_MODEL_ID, CANDIDATE_MODEL_ID}
    assert config.baseline is not None
    assert config.candidate is not None


def test_the_reported_threshold_sweep_matches_the_configured_grid(
    repository_root, committed_report
) -> None:
    """A grid change without a rerun would misdescribe the recorded sweep."""
    config = load_training_config(repository_root)
    sweep = config.evaluation.threshold_sweep
    expected = round((sweep.stop - sweep.start) / sweep.step)

    for values in committed_report["models"].values():
        assert len(values["threshold_sweep"]) == expected
