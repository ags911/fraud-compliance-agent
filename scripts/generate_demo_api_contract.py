"""Regenerate the accepted showcase OpenAPI document from the FastAPI app."""

import json
import sys
from pathlib import Path

REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
API_ROOT = REPOSITORY_ROOT / "apps" / "api"
OUTPUT_PATH = REPOSITORY_ROOT / "docs" / "contracts" / "demo-api.v1.openapi.json"

# The generator lives at repository level while the installed API package is
# rooted under apps/api. Add that owned source root, never an external path.
sys.path.insert(0, str(API_ROOT))

from server.main import create_app


def render_contract() -> str:
    """Return deterministic JSON for the current showcase HTTP contract.

    Returns:
        UTF-8 JSON text with stable key ordering and a trailing newline.

    Side effects:
        Creates the FastAPI application in memory. It does not contact a
        provider, run the pipeline, persist data, or write a file.
    """
    return json.dumps(create_app().openapi(), indent=2, sort_keys=True) + "\n"


def main() -> None:
    """Write the generated contract to its single accepted location.

    Side effects:
        Replaces ``docs/contracts/demo-api.v1.openapi.json`` with the schema
        generated from the current application. Review the resulting diff as a
        contract change before committing it.
    """
    OUTPUT_PATH.write_text(render_contract(), encoding="utf-8")


if __name__ == "__main__":
    main()
