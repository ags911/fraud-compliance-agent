"""Validate committed notebooks against the repository's review contract.

The validator reads notebook structure and metadata only. It never executes a
cell, opens a dataset, reads environment-variable values, or contacts a
provider. ``--fix`` performs only deterministic source hygiene: clearing cell
outputs/execution counts and normalising the documented kernel metadata.
"""

from __future__ import annotations

import argparse
import re
from pathlib import Path

import nbformat

EXPECTED_KERNEL_NAME = "fraud-compliance-agent-api"
EXPECTED_KERNEL_DISPLAY = "Fraud Compliance Agent API (Python 3.11)"
EXPECTED_LANGUAGE_VERSION = "3.11"
LOCAL_PATH_PATTERN = re.compile(r"(?:/Users/|/home/|[A-Za-z]:\\\\Users\\\\)")
REQUIRED_REVIEW_PHRASES = (
    "status",
    "decision supported",
    "limitations",
    "recommendation",
)


def parse_args() -> argparse.Namespace:
    """Parse the check/fix mode without accepting arbitrary data locations."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--fix",
        action="store_true",
        help="clear committed outputs and normalise kernel metadata before checking",
    )
    return parser.parse_args()


def repository_root(start: Path) -> Path:
    """Find the repository root from a path inside this project.

    Args:
        start: Existing path inside the repository.

    Returns:
        Repository directory containing ``docs/project-context.md`` and ``notebooks``.

    Raises:
        RuntimeError: If the expected repository markers cannot be found.
    """
    for candidate in (start, *start.parents):
        if (candidate / "docs" / "project-context.md").is_file() and (candidate / "notebooks").is_dir():
            return candidate
    raise RuntimeError("Run from inside the fraud-compliance-agent repository.")


def normalise_source_notebook(notebook: nbformat.NotebookNode) -> bool:
    """Clear transient execution state and apply canonical kernel metadata.

    Args:
        notebook: Parsed source notebook. No cell is executed or evaluated.

    Returns:
        ``True`` when in-memory source content changed.

    Side effects:
        Mutates only outputs, execution counts, and kernel/language metadata in
        the supplied in-memory notebook object.
    """
    changed = False
    for cell in notebook.cells:
        if cell.cell_type != "code":
            continue
        if cell.get("outputs"):
            cell.outputs = []
            changed = True
        if cell.get("execution_count") is not None:
            cell.execution_count = None
            changed = True

    expected_kernel = {
        "display_name": EXPECTED_KERNEL_DISPLAY,
        "language": "python",
        "name": EXPECTED_KERNEL_NAME,
    }
    if dict(notebook.metadata.get("kernelspec", {})) != expected_kernel:
        notebook.metadata.kernelspec = expected_kernel
        changed = True

    language_info = dict(notebook.metadata.get("language_info", {}))
    if (
        language_info.get("name") != "python"
        or language_info.get("version") != EXPECTED_LANGUAGE_VERSION
    ):
        language_info["name"] = "python"
        language_info["version"] = EXPECTED_LANGUAGE_VERSION
        notebook.metadata.language_info = language_info
        changed = True
    return changed


def notebook_failures(path: Path, notebook: nbformat.NotebookNode) -> list[str]:
    """Return deterministic policy failures without running notebook code.

    Args:
        path: Source notebook path used only in readable diagnostics.
        notebook: Parsed notebook content treated as untrusted text.

    Returns:
        Human-readable failures. An empty list means the source policy passes.
    """
    failures: list[str] = []
    if not notebook.cells or notebook.cells[0].cell_type != "markdown":
        failures.append("first cell must be Markdown")

    markdown = "\n".join(
        str(cell.source) for cell in notebook.cells if cell.cell_type == "markdown"
    ).lower()
    for phrase in REQUIRED_REVIEW_PHRASES:
        if phrase not in markdown:
            failures.append(f"review narrative is missing: {phrase!r}")

    for index, cell in enumerate(notebook.cells):
        if cell.cell_type != "code":
            continue
        if cell.get("outputs"):
            failures.append(f"code cell {index} has committed output")
        if cell.get("execution_count") is not None:
            failures.append(f"code cell {index} has an execution count")
        if index == 0 or notebook.cells[index - 1].cell_type != "markdown":
            failures.append(
                f"code cell {index} needs an immediately preceding Markdown explanation"
            )

    kernelspec = notebook.metadata.get("kernelspec", {})
    if kernelspec.get("name") != EXPECTED_KERNEL_NAME:
        failures.append(f"kernel name must be {EXPECTED_KERNEL_NAME!r}")
    if kernelspec.get("display_name") != EXPECTED_KERNEL_DISPLAY:
        failures.append(f"kernel display name must be {EXPECTED_KERNEL_DISPLAY!r}")
    if (
        notebook.metadata.get("language_info", {}).get("version")
        != EXPECTED_LANGUAGE_VERSION
    ):
        failures.append(
            f"language metadata must declare Python {EXPECTED_LANGUAGE_VERSION}"
        )

    # Scan source and rich outputs for developer-local paths that make evidence
    # non-portable or reveal workstation structure.
    if LOCAL_PATH_PATTERN.search(nbformat.writes(notebook)):
        failures.append("contains an absolute developer-local path")
    return [f"{path.name}: {failure}" for failure in failures]


def main() -> int:
    """Normalise when requested, then validate every ordered source notebook.

    Returns:
        Process status: zero when every notebook satisfies the source policy.

    Side effects:
        With ``--fix``, rewrites only notebooks requiring deterministic source
        hygiene. Without it, performs no writes.
    """
    args = parse_args()
    root = repository_root(Path.cwd().resolve())
    paths = sorted((root / "notebooks").glob("[0-9][0-9]-*.ipynb"))
    if len(paths) != 10:
        print(f"Expected 10 ordered notebooks; found {len(paths)}.")
        return 1

    failures: list[str] = []
    for path in paths:
        notebook = nbformat.read(path, as_version=4)
        if args.fix and normalise_source_notebook(notebook):
            nbformat.write(notebook, path)
            print(f"Normalised {path.relative_to(root)}")
        failures.extend(notebook_failures(path, notebook))

    if failures:
        print("Notebook source policy failed:")
        for failure in failures:
            print(f"- {failure}")
        return 1
    print(f"Notebook source policy passed for {len(paths)} notebooks.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
