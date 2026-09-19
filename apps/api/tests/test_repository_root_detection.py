"""Repository-root detection must ignore scoped `AGENTS.md` files.

Notebooks and scripts locate the monorepo root by walking up from the working
directory. A scoped `AGENTS.md` in `apps/api` once made that walk stop at the
wrong folder, so the marker is now a file that exists only at the root.
"""

import json

import pytest
from conftest import load_script

NOTEBOOK_08 = "notebooks/08-fast-path-model-training-and-evaluation.ipynb"


@pytest.fixture
def monorepo(tmp_path):
    """Build a tiny tree with a root marker and a scoped AGENTS.md in a sub-app."""
    root = tmp_path / "repo"
    (root / "docs").mkdir(parents=True)
    (root / "docs" / "project-context.md").write_text("context\n", encoding="utf-8")
    (root / "notebooks").mkdir()
    api = root / "apps" / "api"
    api.mkdir(parents=True)
    (api / "AGENTS.md").write_text("scoped\n", encoding="utf-8")
    return root, api


def test_notebook_pipeline_finds_the_root_from_a_scoped_folder(monorepo) -> None:
    """The status tool resolves the root even when run from a folder with its own AGENTS.md."""
    root, api = monorepo

    assert load_script("notebook_pipeline").repository_root(api) == root


def test_notebook_validator_finds_the_root_from_a_scoped_folder(monorepo) -> None:
    """The notebook policy check resolves the root the same way."""
    root, api = monorepo
    validator = load_script("validate_notebooks")
    finder = next(
        getattr(validator, name)
        for name in dir(validator)
        if name in {"find_repository_root", "repository_root"}
    )

    assert finder(api) == root


def test_notebook_08_finds_the_root_from_a_scoped_folder(
    monorepo, repository_root
) -> None:
    """Notebook 08's own root finder ignores a scoped AGENTS.md."""
    root, api = monorepo
    notebook = json.loads((repository_root / NOTEBOOK_08).read_text(encoding="utf-8"))
    setup = next(
        "".join(cell["source"])
        for cell in notebook["cells"]
        if cell["cell_type"] == "code"
        and "def find_repository_root" in "".join(cell["source"])
    )
    # Run only the helper's definition, not the rest of the cell's work.
    definition = setup[
        setup.index("def find_repository_root") : setup.index("REPOSITORY_ROOT = ")
    ]
    namespace: dict = {"Path": type(root)}
    exec(compile(definition, "notebook-08-root-finder", "exec"), namespace)

    assert namespace["find_repository_root"](api) == root
