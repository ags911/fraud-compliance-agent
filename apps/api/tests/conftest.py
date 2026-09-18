"""Shared fixtures: repository paths and root-level scripts loaded by file path."""

import importlib.util
import sys
from pathlib import Path
from types import ModuleType

import pytest

# tests -> api -> apps -> repository root
REPOSITORY_ROOT = Path(__file__).resolve().parents[3]


def load_script(name: str) -> ModuleType:
    """Import `scripts/<name>.py` without making `scripts/` a package.

    Args:
        name: Script file name without the `.py` suffix.

    Returns:
        The imported module.

    Raises:
        FileNotFoundError: If the script does not exist.
    """
    path = REPOSITORY_ROOT / "scripts" / f"{name}.py"
    if not path.is_file():
        raise FileNotFoundError(path)
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    # Registered before execution because dataclasses look their module up by name.
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


@pytest.fixture(scope="session")
def repository_root() -> Path:
    """Return the monorepo root."""
    return REPOSITORY_ROOT


@pytest.fixture(scope="session")
def sparkov_build() -> ModuleType:
    """Return the Sparkov mechanics dataset build script as a module."""
    return load_script("build_sparkov_mechanics_dataset")
