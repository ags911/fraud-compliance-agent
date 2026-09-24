"""Load the operator switch and file locations for durable showcase cases."""

import os
import re
from dataclasses import dataclass
from pathlib import Path

from server.showcase_investigation.settings import _explicit_boolean

_REPOSITORY_ROOT = Path(__file__).resolve().parents[4]
EVENT_SCHEMA_PATH = Path("docs/contracts/public-showcase-events.v1.schema.json")

# Anonymous browser scoping key: a lowercase version 4 UUID, nothing else.
_BROWSER_ID = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"
)


@dataclass(frozen=True)
class CaseSettings:
    """Hold whether case storage may run and where its inputs live."""

    enabled: bool
    database_url: str | None
    root: Path

    @property
    def ready(self) -> bool:
        """Return whether both the explicit switch and a database are present."""
        return self.enabled and bool(self.database_url)

    @property
    def event_schema_path(self) -> Path:
        """Return the accepted event schema used to validate stored events."""
        return self.root / EVENT_SCHEMA_PATH


def load_case_settings() -> CaseSettings:
    """Load the case storage switch without opening any connection.

    Returns:
        Settings describing whether case storage is enabled and configured.

    Raises:
        ShowcaseRuntimeUnavailable: If ``SHOWCASE_CASES_ENABLED`` is not an
            explicit boolean.

    Side effects:
        Reads three process environment variables.
    """
    override = os.getenv("FCA_SHOWCASE_ROOT", "").strip()
    return CaseSettings(
        # Off by default, so a future DATABASE_URL in the database free public
        # deployment can never switch case storage on by accident.
        enabled=_explicit_boolean("SHOWCASE_CASES_ENABLED", False),
        database_url=os.getenv("DATABASE_URL", "").strip() or None,
        root=Path(override) if override else _REPOSITORY_ROOT,
    )


def valid_browser_id(value: str | None) -> str | None:
    """Return the browser ID when it is a lowercase version 4 UUID, else None."""
    if value is None:
        return None
    candidate = value.strip()
    return candidate if _BROWSER_ID.fullmatch(candidate) else None
