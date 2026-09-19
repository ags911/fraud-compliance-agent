"""Notebook 08 stays a thin runner over the tested `modelling` library.

The training, evaluation, and report logic used to live in notebook cells, where
it could not be tested and a parameter could be changed without review. These
tests keep it out of the notebook.
"""

import ast
import json

import pytest

NOTEBOOK = "notebooks/08-fast-path-model-training-and-evaluation.ipynb"
ALLOWED_IMPORT_ROOTS = {"__future__", "os", "pathlib", "modelling"}
# Anything that would mean the notebook had taken logic back from the library.
BANNED_SOURCE_FRAGMENTS = (
    "LogisticRegression(",
    "XGBClassifier(",
    "Pipeline(",
    ".fit(",
    "predict_proba",
    "hashlib",
    "average_precision_score",
    "np.random",
    "default_rng",
    "go.Figure",
    "random_state",
)
# The stages a reader should be able to follow from the cells themselves.
REQUIRED_CALLS = (
    "prepare_run",
    "load_accepted_manifest",
    "load_dataset",
    "split_partitions",
    "train_models",
    "evaluate_models",
    "build_diagnostics",
    "write_report",
)


@pytest.fixture(scope="module")
def code_cells(repository_root) -> list[str]:
    """Return the notebook's code-cell sources in order."""
    notebook = json.loads((repository_root / NOTEBOOK).read_text(encoding="utf-8"))
    return [
        "".join(cell["source"])
        for cell in notebook["cells"]
        if cell["cell_type"] == "code"
    ]


@pytest.fixture(scope="module")
def notebook_source(code_cells) -> str:
    """Return every code cell joined into one module-shaped source."""
    return "\n".join(code_cells)


def test_the_notebook_defines_no_functions_or_classes(notebook_source) -> None:
    """Reusable logic belongs in `apps/api/modelling`, where it is tested."""
    tree = ast.parse(notebook_source)
    definitions = [
        node.name
        for node in ast.walk(tree)
        if isinstance(node, ast.FunctionDef | ast.AsyncFunctionDef | ast.ClassDef)
    ]

    assert definitions == []


def test_the_notebook_imports_only_the_library_and_the_standard_library(
    notebook_source,
) -> None:
    """A direct scikit-learn, XGBoost, or Plotly import would be logic moving back."""
    tree = ast.parse(notebook_source)
    roots = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            roots.update(alias.name.split(".")[0] for alias in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module:
            roots.add(node.module.split(".")[0])

    assert roots <= ALLOWED_IMPORT_ROOTS


@pytest.mark.parametrize("fragment", BANNED_SOURCE_FRAGMENTS)
def test_the_notebook_holds_no_model_or_metric_logic(notebook_source, fragment) -> None:
    """Estimators, metrics, seeds, and digests are the library's responsibility."""
    assert fragment not in notebook_source


@pytest.mark.parametrize("call", REQUIRED_CALLS)
def test_each_stage_calls_the_library(notebook_source, call) -> None:
    """Every CRISP-DM stage remains visible as a call in the notebook."""
    assert f"{call}(" in notebook_source


def test_the_notebook_hard_codes_no_report_destination(notebook_source) -> None:
    """The destination comes from the guarded resolver, not from a cell.

    Only string literals are inspected: a comment may still explain where an
    approved run writes.
    """
    literals = [
        node.value
        for node in ast.walk(ast.parse(notebook_source))
        if isinstance(node, ast.Constant) and isinstance(node.value, str)
    ]

    assert not [
        literal
        for literal in literals
        if "docs/proposals" in literal or "fast-path-model-release" in literal
    ]


def test_the_notebook_stays_small(code_cells) -> None:
    """A runner that grows back into a harness has lost the point of the refactor."""
    lines = sum(len(cell.splitlines()) for cell in code_cells)

    assert lines < 150


def test_the_notebook_documents_where_the_logic_lives(repository_root) -> None:
    """A reader is pointed at the modules and their tests."""
    notebook = json.loads((repository_root / NOTEBOOK).read_text(encoding="utf-8"))
    markdown = "\n".join(
        "".join(cell["source"])
        for cell in notebook["cells"]
        if cell["cell_type"] == "markdown"
    )

    assert "apps/api" in markdown
    assert "config/fast-path-model-training.v1.json" in markdown
    assert "test_modelling_" in markdown
