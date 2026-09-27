"""Plan or apply explicit retention cleanup for superseded Sandbox datasets."""

import argparse
import os

from server.sandbox_data.service import PsycopgScenarioRepository


def prune_sandbox_datasets(
    database_url: str, *, apply: bool = False
) -> tuple[int, int]:
    """Select or delete superseded sanitised datasets and orphaned baselines.

    Args:
        database_url: PostgreSQL URL supplied outside source control.
        apply: Delete eligible records only when explicitly true.

    Returns:
        Counts of eligible dataset and baseline records, in that order.

    Raises:
        ValueError: If the repository rejects the database URL.
        TypeError: If the repository rejects the apply flag.
        SandboxDataUnavailable: If the optional PostgreSQL store is unavailable.

    Side effects:
        With ``apply`` true, removes only non-current datasets not referenced by
        simulation runs and then unreferenced baselines. The default is dry run.
    """
    result = PsycopgScenarioRepository(database_url).prune_superseded_datasets(
        apply=apply
    )
    return result.datasets, result.baselines


def main() -> None:
    """Run an operator-invoked retention plan, dry by default.

    Side effects:
        Prints aggregate counts only. ``--apply`` performs the repository's
        validated child-first deletions; without it, no database rows are deleted.
    """
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--apply",
        action="store_true",
        help="delete eligible records; omit for the default dry run",
    )
    arguments = parser.parse_args()
    database_url = os.getenv("DATABASE_URL", "").strip()
    if not database_url:
        raise SystemExit("DATABASE_URL must be configured outside source control")
    # The command emits no scenario, fixture, baseline, or run identifiers.
    datasets, baselines = prune_sandbox_datasets(database_url, apply=arguments.apply)
    print(f"datasets={datasets} baselines={baselines}")


if __name__ == "__main__":
    main()
