"""Repository-root detection must ignore scoped `AGENTS.md` files.

Notebooks, scripts, and the modelling library locate the monorepo root by
walking up from the working directory. A scoped `AGENTS.md` in `apps/api` once
made that walk stop at the wrong folder, so the marker is now a file that exists
only at the root.
"""

import pytest
from conftest import load_script

from modelling.paths import UNAVAILABLE_REVISION, find_repository_root, git_revision


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


def test_the_modelling_library_finds_the_root_from_a_scoped_folder(monorepo) -> None:
    """Notebook 08 resolves every path through this one finder."""
    root, api = monorepo

    assert find_repository_root(api) == root


def test_a_directory_outside_the_repository_is_refused(tmp_path) -> None:
    """Without the root marker no path can be trusted, so the run stops."""
    with pytest.raises(RuntimeError, match="inside the fraud-compliance-agent"):
        find_repository_root(tmp_path)


def test_the_revision_is_reported_for_this_repository(repository_root) -> None:
    """The report records the revision that produced it."""
    revision = git_revision(repository_root)

    assert len(revision) == 40
    assert int(revision, 16) >= 0


def test_a_non_repository_reports_an_unavailable_revision(tmp_path) -> None:
    """Git's own error text never reaches notebook output."""
    assert git_revision(tmp_path) == UNAVAILABLE_REVISION
