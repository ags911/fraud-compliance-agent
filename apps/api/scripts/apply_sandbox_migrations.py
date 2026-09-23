"""Apply idempotent Sandbox data migrations to configured Neon PostgreSQL."""

import os
from pathlib import Path

import psycopg


def apply_migration(database_url: str, migration_path: Path) -> None:
    """Apply one reviewed idempotent SQL migration to Neon PostgreSQL.

    Args:
        database_url: PostgreSQL URL held outside source control.
        migration_path: Reviewed migration file within this repository.

    Raises:
        ValueError: If the database URL or migration path is invalid.
        psycopg.Error: If Neon rejects the migration.

    Side effects:
        Creates or updates only the schema declared by the supplied migration.
    """
    if not database_url.startswith(("postgresql://", "postgres://")):
        raise ValueError("DATABASE_URL must be a PostgreSQL URL")
    if not migration_path.is_file() or migration_path.suffix != ".sql":
        raise ValueError("migration path must name a SQL file")
    # The migration contains no untrusted input and is reviewed with the codebase.
    with psycopg.connect(database_url) as connection, connection.cursor() as cursor:
        cursor.execute(migration_path.read_text(encoding="utf-8"))


def main() -> None:
    """Apply the Sandbox schema only when a caller supplies a Neon URL."""
    database_url = os.getenv("DATABASE_URL", "").strip()
    if not database_url:
        raise SystemExit("DATABASE_URL must be configured outside source control")
    migration_path = Path(__file__).resolve().parents[1] / "migrations" / "0001_sandbox_scenario_data.sql"
    apply_migration(database_url, migration_path)
    print("sandbox migrations applied")


if __name__ == "__main__":
    main()
