"""Repository-root and revision lookup for offline evaluation runs.

A notebook's working directory depends on the editor that opened it, so every
file path in this package is resolved from an explicitly located repository
root rather than from the process working directory.
"""

from __future__ import annotations

import subprocess
from pathlib import Path

# The marker is a file that exists only at the monorepo root. A scoped
# `AGENTS.md` once stopped this walk inside `apps/api`, which resolved every
# later path against the wrong directory.
ROOT_MARKER = Path("docs") / "project-context.md"
UNAVAILABLE_REVISION = "uncommitted-or-unavailable"


def find_repository_root(start: Path) -> Path:
    """Return the monorepo root containing `start`.

    Args:
        start: Any existing path inside the repository.

    Returns:
        The first directory at or above `start` that holds the root marker.

    Raises:
        RuntimeError: If no ancestor holds the marker, which means the caller is
            outside the repository and no path here can be trusted.
    """
    for candidate in (start, *start.parents):
        if (candidate / ROOT_MARKER).is_file():
            return candidate
    raise RuntimeError("Run this from inside the fraud-compliance-agent repository.")


def git_revision(repository_root: Path) -> str:
    """Return the checked-out Git revision for the run context.

    Args:
        repository_root: Directory to run the lookup in.

    Returns:
        The full commit hash, or `UNAVAILABLE_REVISION` when Git is absent, the
        directory is not a work tree, or the command fails. Git's own error text
        is suppressed so a workstation path never reaches notebook output.

    Side effects:
        Runs a fixed, argument-free `git rev-parse HEAD`; it reads Git state and
        writes nothing.
    """
    try:
        # A fixed argument list with no user input; `git` is resolved through PATH.
        return subprocess.check_output(
            ["git", "rev-parse", "HEAD"],  # noqa: S607
            cwd=repository_root,
            text=True,
            stderr=subprocess.DEVNULL,
        ).strip()
    except (OSError, subprocess.CalledProcessError):
        return UNAVAILABLE_REVISION
