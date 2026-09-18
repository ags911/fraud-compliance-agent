"""Inspect the notebook workstream and run its safe synthetic demonstration.

This utility is intentionally an orchestration/status tool, not a data
pipeline. It never reads datasets, environment-variable values, raw notebook
outputs, provider payloads, or model artefacts. Approved-mode notebook runs
remain a deliberate, separately reviewed action.
"""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class NotebookStep:
    """Describe an ordered notebook and the evidence that controls its gate."""

    number: int
    filename: str
    state: str
    requirement: str


STEPS = (
    NotebookStep(1, "01-plaid-sandbox-source-inventory.ipynb", "observed", "Requires local Doppler-backed Plaid Sandbox configuration for a new observation run."),
    NotebookStep(2, "02-plaid-sandbox-lifecycle-probes.ipynb", "observed", "Requires local Doppler-backed Plaid Sandbox configuration for a new probe run."),
    NotebookStep(3, "03-plaid-to-canonical-mapping.ipynb", "proposal-prepared", "Mapping evidence is prepared; P0-03 review must resolve the explicit point-in-time and canonical-semantics gaps."),
    NotebookStep(4, "04-feature-availability-matrix.ipynb", "proposal-prepared", "Matrix evidence is prepared; no feature is approved for online scoring pending mapping and scenario review."),
    NotebookStep(5, "05-enrichment-pipeline-prototype.ipynb", "proposal-prepared", "Snapshot design is prepared; no runtime enrichment is authorised pending feature and mapping review."),
    NotebookStep(6, "06-corpus-and-label-feasibility.ipynb", "proposal-prepared", "Sparkov mechanics evidence is prepared; a separate real target, mature labels, and representative corpus remain required for production-model work."),
    NotebookStep(7, "07-leakage-and-evaluation-design.ipynb", "proposal-prepared", "A mechanics-only temporal protocol is prepared; production cutpoints, label treatment, feature schema, calibration, and release criteria require independent approval."),
    NotebookStep(8, "08-fast-path-model-training-and-evaluation.ipynb", "mechanics-evaluated", "The checksum-pinned Sparkov mechanics run is complete and pending review; production training still requires a real corpus, point-in-time feature parity, calibration, and release approval."),
    NotebookStep(9, "09-slow-path-investigation-evaluation.ipynb", "gated", "Requires accepted eligibility, typed-tool, response-schema, and scenario-suite contracts."),
    NotebookStep(10, "10-model-monitoring-and-champion-challenger.ipynb", "gated", "Requires an accepted model release, monitoring contract, delayed labels, cohort definitions, and rollback criteria."),
)


def repository_root(start: Path) -> Path:
    """Find the repository root without depending on the caller's cwd."""
    for candidate in (start, *start.parents):
        if (candidate / "AGENTS.md").is_file():
            return candidate
    raise RuntimeError("Run from inside the fraud-compliance-agent repository.")


def inspect(root: Path) -> int:
    """Print a sanitised ordered status report without opening data or secrets."""
    print("Fraud Compliance Agent notebook pipeline")
    print("Mode: inspect only — no notebooks, data, or provider calls were executed.\n")
    missing = False
    for step in STEPS:
        present = (root / "notebooks" / step.filename).is_file()
        marker = "present" if present else "MISSING"
        missing = missing or not present
        print(f"{step.number:02d}  {step.state:<18} {marker:<7} {step.filename}")
        print(f"    Gate: {step.requirement}")
    print("\nSafe execution: `make notebook-synthetic` runs only Notebook 08 in synthetic mode in a temporary kernel output directory.")
    print("Approved/real-data execution is intentionally not implemented by this tool; use the accepted contract and documented review process.")
    return 1 if missing else 0


def run_synthetic(root: Path) -> int:
    """Execute only Notebook 08's mechanics fixture, writing outputs outside Git."""
    notebook = root / "notebooks" / "08-fast-path-model-training-and-evaluation.ipynb"
    if not notebook.is_file():
        print("Notebook 08 is missing; synthetic execution cannot start.", file=sys.stderr)
        return 1
    runner = root / "scripts" / "run_notebook_safely.py"
    if not runner.is_file():
        print("Safe notebook runner is missing; synthetic execution cannot start.", file=sys.stderr)
        return 1

    environment = os.environ.copy()
    environment["FCA_NOTEBOOK08_MODE"] = "synthetic"
    environment["FCA_NOTEBOOK08_RENDER_PLOTS"] = "false"
    with tempfile.TemporaryDirectory(prefix="fraud-compliance-notebook-") as output_directory:
        command = [sys.executable, str(runner), str(notebook), "--output-directory", output_directory]
        result = subprocess.run(command, cwd=root, env=environment, check=False)
    return result.returncode


def parse_args() -> argparse.Namespace:
    """Parse the intentionally small safe command surface."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--run-synthetic",
        action="store_true",
        help="run only Notebook 08's synthetic mechanics fixture; never run provider or approved-data modes",
    )
    return parser.parse_args()


def main() -> int:
    """Run inspection by default or the explicit safe synthetic demonstration."""
    args = parse_args()
    root = repository_root(Path.cwd().resolve())
    return run_synthetic(root) if args.run_synthetic else inspect(root)


if __name__ == "__main__":
    raise SystemExit(main())
