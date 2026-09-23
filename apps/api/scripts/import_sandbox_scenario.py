"""Import one sanitised scenario fixture into the configured Neon database."""

import argparse
import os
from pathlib import Path

from server.sandbox_data.service import PsycopgScenarioRepository, load_fixture


def import_sanitised_fixture(fixture_path: Path, database_url: str) -> str:
    """Derive and persist one sanitised fixture into its scenario version.

    Args:
        fixture_path: JSON fixture containing only permitted sanitised values.
        database_url: Neon PostgreSQL URL supplied outside source control.

    Returns:
        The imported scenario and fixture version for operator confirmation.

    Raises:
        ValueError: If the fixture or database URL is invalid.
        SandboxDataUnavailable: If the optional PostgreSQL store cannot be used.

    Side effects:
        Writes the supplied scenario version, its enriched transactions, and
        its prepared daily aggregates in one PostgreSQL transaction.
    """
    dataset = load_fixture(fixture_path)
    PsycopgScenarioRepository(database_url).replace_dataset(dataset)
    return f"{dataset.scenario_id}:{dataset.fixture_version}"


def main() -> None:
    """Parse explicit import arguments without ever calling Plaid directly."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("fixture", type=Path, help="sanitised fixture JSON path")
    arguments = parser.parse_args()
    database_url = os.getenv("DATABASE_URL", "").strip()
    if not database_url:
        raise SystemExit("DATABASE_URL must be configured outside source control")
    # The import accepts a reviewed fixture only. Provider retrieval stays outside this command.
    print(import_sanitised_fixture(arguments.fixture, database_url))


if __name__ == "__main__":
    main()
