"""Execute one explicitly named notebook into a temporary, non-Git location."""

from __future__ import annotations

import argparse
import os
from pathlib import Path

import nbformat
from nbclient import NotebookClient


def parse_args() -> argparse.Namespace:
    """Parse a source notebook and an output directory controlled by the caller."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("notebook", type=Path)
    parser.add_argument("--output-directory", required=True, type=Path)
    return parser.parse_args()


def main() -> int:
    """Run a notebook while isolating both cell output and generated reports.

    Returns:
        Zero after the synthetic notebook and report are written under the
        caller-provided temporary directory.

    Raises:
        RuntimeError: If the source, mode, or repository boundary is invalid.

    Side effects:
        Starts a local Jupyter kernel and writes only inside the supplied output
        directory. It does not modify a source notebook or checked-in report.
    """
    args = parse_args()
    source = args.notebook.resolve()
    repository_root = source.parent.parent
    output_directory = args.output_directory.resolve()
    if not source.is_file() or not (repository_root / "docs" / "project-context.md").is_file():
        raise RuntimeError("Expected a notebook inside the fraud-compliance-agent repository.")
    if source.name != "08-fast-path-model-training-and-evaluation.ipynb":
        raise RuntimeError("This runner permits only Notebook 08's synthetic mechanics fixture.")
    if os.environ.get("FCA_NOTEBOOK08_MODE") != "synthetic":
        raise RuntimeError("This runner requires FCA_NOTEBOOK08_MODE=synthetic.")

    output_directory.mkdir(parents=True, exist_ok=True)
    # Notebook 08 normally writes its reviewed candidate report into the
    # repository. The safe synthetic runner redirects that side effect so a
    # demonstration cannot replace accepted mechanics evidence.
    os.environ["FCA_NOTEBOOK08_REPORT_PATH"] = str(
        output_directory / "fast-path-model-release.synthetic.json"
    )
    notebook = nbformat.read(source, as_version=4)
    NotebookClient(
        notebook,
        timeout=120,
        kernel_name="fraud-compliance-agent-api",
        resources={"metadata": {"path": str(repository_root)}},
    ).execute()
    destination = output_directory / source.name
    nbformat.write(notebook, destination)
    print(f"{source.name}: synthetic mechanics run completed; temporary output: {destination}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
