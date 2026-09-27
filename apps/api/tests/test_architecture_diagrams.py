"""The architecture diagrams keep one scale, one look, and work on a dark page.

These check the committed SVGs, so they need no D2 install and run in CI. To
change a diagram, edit its `.d2` source and run `make architecture-diagrams`.
"""

import re
from pathlib import Path

import pytest

DIAGRAMS = "docs/architecture/diagrams"
# The document itself is archived (superseded by context/architecture.md);
# the diagram sources and rendered SVGs it embedded stay live at DIAGRAMS.
DOCUMENT = "docs/archive/docs/architecture/system-architecture.md"
# GitHub shows an image at natural size up to about this width, so a wider
# diagram is shrunk and its text ends up smaller than the others.
MAX_WIDTH = 900


@pytest.fixture(scope="module")
def sources(repository_root) -> list[Path]:
    """Return every diagram source, excluding the shared partial."""
    found = sorted((repository_root / DIAGRAMS).glob("[a-z]*.d2"))
    assert found, "no diagram sources found"
    return found


def test_every_source_has_a_rendered_svg(sources) -> None:
    """A source without its SVG would show as a broken image in the document."""
    for source in sources:
        assert source.with_suffix(".svg").is_file(), source.name


@pytest.mark.parametrize("stem", ["context", "containers", "pipeline", "sequence"])
def test_the_named_views_exist(repository_root, stem) -> None:
    """The views the document is organised around are all present."""
    assert (repository_root / DIAGRAMS / f"{stem}.svg").is_file()


def test_every_diagram_stays_within_the_scale_limit(sources) -> None:
    """Rule 1: a diagram wider than the limit is shrunk, so its text is smaller."""
    for source in sources:
        svg = source.with_suffix(".svg").read_text(encoding="utf-8")
        width = int(re.search(r'viewBox="[-\d.]+ [-\d.]+ (\d+)', svg).group(1))

        assert width <= MAX_WIDTH, f"{source.stem} is {width} wide; stack it vertically"


def test_no_diagram_paints_its_own_page_background(sources) -> None:
    """A hard white rectangle looks pasted in on a dark page."""
    for source in sources:
        svg = source.with_suffix(".svg").read_text(encoding="utf-8")

        assert not re.search(r'<rect[^>]*rx="0" fill="#FFFFFF" class=" fill-N7"', svg)


def test_every_diagram_switches_palette_on_a_dark_page(sources) -> None:
    """The render script adds a prefers-color-scheme rule to each SVG."""
    for source in sources:
        svg = source.with_suffix(".svg").read_text(encoding="utf-8")

        assert "prefers-color-scheme: dark" in svg, source.name


def test_every_diagram_uses_the_console_palette_and_embeds_its_font(sources) -> None:
    """Colours come from the Payments tokens and the font travels with the SVG."""
    for source in sources:
        svg = source.with_suffix(".svg").read_text(encoding="utf-8").lower()

        assert "#0a2540" in svg, f"{source.stem} does not use the ink token"
        assert "@font-face" in svg, f"{source.stem} does not embed its font"


def test_every_diagram_imports_the_shared_look(sources) -> None:
    """One palette and type scale are defined once, in `_shared.d2`."""
    for source in sources:
        assert "...@_shared" in source.read_text(encoding="utf-8"), source.name


def test_the_document_embeds_each_diagram_and_uses_no_mermaid(
    repository_root, sources
) -> None:
    """Every view is on the one library, and each is actually shown."""
    document = (repository_root / DOCUMENT).read_text(encoding="utf-8")

    assert "mermaid" not in document.lower()
    for source in sources:
        assert f"diagrams/{source.stem}.svg" in document, source.stem


def test_the_shared_file_states_the_scale_rules(repository_root) -> None:
    """The rules live next to the palette, where the next author will read them."""
    shared = (repository_root / DIAGRAMS / "_shared.d2").read_text(encoding="utf-8")

    assert "900 units wide" in shared
    assert "stack it vertically" in shared
