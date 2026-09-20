"""The implementation plan's screen ticks must still be true.

The plan is the operational record of delivery status, and a tick on a screen
says it exists. A route that is removed or renamed while its row stays ticked is
the drift `docs/project-context.md` warns about, so this fails it.
"""

import re

import pytest

PLAN = "docs/product/implementation-plan.md"
ROUTER = "apps/web/src/ProductApp.tsx"
VITE = "apps/web/vite.config.ts"
SECTIONS = (
    "### MVP 1 — Guided product walkthrough",
    "### MVP 2 — Live decision demonstration",
)


def built_screens(plan: str) -> list[tuple[str, str]]:
    """Return the screens the plan ticks as built, with their first route.

    Args:
        plan: The implementation plan's text.

    Returns:
        A (screen, route) pair for each ticked row of the MVP 1 and MVP 2 screen
        tables. Rows whose route cell offers alternatives are skipped, because
        one of them being built does not identify which.
    """
    found: list[tuple[str, str]] = []
    section = None
    for line in plan.split("\n"):
        if line.startswith("#"):
            section = line if line in SECTIONS else None
        if not (section and line.startswith("| ✓ ")):
            continue
        cells = [cell.strip() for cell in line.strip("|").split("|")]
        # Status, Screen, Route, ...; the checklist tables have no route column.
        if len(cells) < 4 or not cells[2].startswith("`") or " or " in cells[2]:
            continue
        route = re.match(r"`([^`]+)`", cells[2])
        if route:
            found.append((cells[1], route.group(1)))
    return found


@pytest.fixture(scope="module")
def routed(repository_root) -> str:
    """Return the text a route can be declared in: the router and the Vite entries."""
    return "\n".join(
        (repository_root / path).read_text(encoding="utf-8") for path in (ROUTER, VITE)
    )


def test_the_plan_ticks_some_screens(repository_root) -> None:
    """The parser finds the ticked screens, so the checks below are not vacuous."""
    plan = (repository_root / PLAN).read_text(encoding="utf-8")

    assert len(built_screens(plan)) >= 5


def test_every_ticked_screen_has_a_route(repository_root, routed) -> None:
    """A screen ticked as built must be routed in the app or built as a page."""
    plan = (repository_root / PLAN).read_text(encoding="utf-8")

    for screen, route in built_screens(plan):
        if route.endswith(".html"):
            assert route.lstrip("/") in routed_pages(repository_root), (screen, route)
        else:
            assert f'path="{route}"' in routed, (
                f"{screen} is ticked but {route} is not routed"
            )


def routed_pages(repository_root) -> str:
    """Return the names of the root HTML pages, which are the Vite entries."""
    return "\n".join(
        path.name for path in (repository_root / "apps/web").glob("*.html")
    )
