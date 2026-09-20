"""Render the architecture diagrams from their D2 sources, and enforce the scale rule.

Each ``docs/architecture/diagrams/<name>.d2`` becomes ``<name>.svg``. Rendering:

* embeds the Inter fonts committed beside the sources, so the text looks the same
  in every viewer;
* removes D2's hard white background, so the diagram sits on the page's own;
* appends a ``prefers-color-scheme: dark`` stylesheet that swaps each light
  colour for a dark one, so a diagram is legible on a dark page too;
* fails when a diagram is wider than ``MAX_WIDTH`` units.

The width limit is the scale rule. GitHub shows an image at natural size up to
about this width, so a wider diagram is shrunk and its text ends up smaller than
the others. Stack such a view vertically instead of shrinking it.
"""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
from pathlib import Path

MAX_WIDTH = 900
DIAGRAMS = Path("docs/architecture/diagrams")

# Light colour -> dark counterpart. Light values are the console's Payments
# tokens (see `_shared.d2`); dark values are derived for a dark page and are not
# an approved theme, because the Payments system has no dark mode.
DARK = {
    "#0a2540": "#e6edf3",  # ink: text
    "#425466": "#8b98a9",  # secondary text, arrows, proposed border
    "#e3e8ee": "#30363d",  # group border
    "#f6f8fa": "#161b22",  # group and proposed fill
    "#e5f7ec": "#0f2a1e",  # built fill
    "#087f45": "#3ecf8e",  # built border
    "#fff2cc": "#33280d",  # planned fill
    "#946000": "#f5b73b",  # planned border
    "#f0ebff": "#1f1b3d",  # focus fill
    "#635bff": "#9d97ff",  # focus border
    "#5543cd": "#cfcaff",  # focus text
    # D2's own neutrals, used by sequence diagrams and default edge labels.
    "#676c7e": "#8b98a9",
    "#9499ab": "#8b98a9",
    "#eef1f8": "#161b22",
    "#edf0fd": "#161b22",
    "#e3e9fd": "#161b22",  # sequence-diagram note fill
    "#ffffff": "#161b22",  # D2 paints notes with its background colour
}
# D2 paints text and its own defaults with the theme's neutral colours.
THEME_TEXT = {"#0a0f25", "#4a6ff3"}
# D2 paints every connection in its theme blue, and a style set in an imported
# file does not reach the importing file's edges, so it is remapped here to the
# one neutral colour the palette gives arrows.
D2_EDGE_BLUE = "#0d32b2"
ARROW = "#425466"
# D2's default text and secondary greys, remapped to the ink tokens so diagrams
# that draw no palette classes (a sequence diagram) still match the rest.
D2_TO_TOKEN = {"#0a0f25": "#0a2540", "#676c7e": "#425466", "#9499ab": "#425466"}
HEX = re.compile(r"#[0-9a-fA-F]{6}\b")


def render(source: Path, fonts: Path) -> Path:
    """Render one D2 source to an SVG beside it.

    Args:
        source: The ``.d2`` file.
        fonts: Directory holding the static Inter TTFs.

    Returns:
        The SVG path.

    Raises:
        subprocess.CalledProcessError: If D2 fails to compile the source.

    Side effects:
        Runs the ``d2`` CLI and writes the SVG.
    """
    target = source.with_suffix(".svg")
    subprocess.run(
        [
            "d2",
            f"--font-regular={fonts / 'Inter-Regular.ttf'}",
            f"--font-italic={fonts / 'Inter-Italic.ttf'}",
            f"--font-bold={fonts / 'Inter-Bold.ttf'}",
            f"--font-semibold={fonts / 'Inter-SemiBold.ttf'}",
            str(source),
            str(target),
        ],
        check=True,
        capture_output=True,
    )
    return target


def dark_rules(svg: str) -> str:
    """Build the dark-mode stylesheet for one SVG.

    Args:
        svg: The rendered SVG text.

    Returns:
        A ``@media (prefers-color-scheme: dark)`` block overriding every colour
        the SVG uses, whether set by attribute, inline style, or D2's classes.

    Raises:
        ValueError: If the SVG uses a colour with no dark counterpart, which
            would leave that text or shape unreadable on a dark page.
    """
    used = {c.lower() for c in HEX.findall(svg)}
    unmapped = sorted(used - set(DARK) - THEME_TEXT)
    if unmapped:
        raise ValueError(f"No dark counterpart for: {', '.join(unmapped)}")
    rules: list[str] = []
    for light, dark in DARK.items():
        if light not in used:
            continue
        for prop in ("fill", "stroke", "color"):
            rules.append(f'[{prop}="{light}" i]{{{prop}:{dark}!important}}')
            rules.append(f'[style*="{prop}:{light}" i]{{{prop}:{dark}!important}}')
    # D2 draws text and some shapes through its theme classes (`.fill-N1`).
    for name, body in re.findall(r"(\.[\w-]+)\{([^}]*)\}", svg):
        for prop, value in re.findall(r"([\w-]+):(#[0-9a-fA-F]{6})", body):
            if prop not in {"fill", "stroke", "color"}:
                continue
            swap = DARK.get(
                value.lower(), "#e6edf3" if value.lower() in THEME_TEXT else None
            )
            if swap:
                rules.append(f"{name}{{{prop}:{swap}!important}}")
    return "@media (prefers-color-scheme: dark){" + "".join(rules) + "}"


def finish(svg_path: Path) -> int:
    """Post-process a rendered SVG and return its width.

    Args:
        svg_path: An SVG written by `render`.

    Returns:
        The diagram's width in SVG units, from its viewBox.

    Side effects:
        Rewrites the file without the white background and with the dark-mode
        stylesheet appended.
    """
    svg = svg_path.read_text(encoding="utf-8")
    svg = re.sub(D2_EDGE_BLUE, ARROW, svg, flags=re.IGNORECASE)
    for theme, token in D2_TO_TOKEN.items():
        svg = re.sub(theme, token, svg, flags=re.IGNORECASE)
    # D2's background is a full-size rect painted first; the page provides one.
    svg = re.sub(
        r'<rect x="-?\d+" y="-?\d+" width="\d+" height="\d+" rx="0" fill="#FFFFFF" class=" fill-N7"[^>]*/>',
        "",
        svg,
        count=1,
    )
    svg = svg.replace("</svg>", f"<style>{dark_rules(svg)}</style></svg>", 1)
    svg_path.write_text(svg, encoding="utf-8")
    match = re.search(r'viewBox="[-\d.]+ [-\d.]+ (\d+)', svg)
    return int(match.group(1)) if match else 0


def main() -> int:
    """Render every diagram and report widths.

    Returns:
        0 when every diagram renders and stays within `MAX_WIDTH`, otherwise 1.
    """
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path.cwd())
    args = parser.parse_args()
    directory = args.root / DIAGRAMS
    failed = False
    for source in sorted(directory.glob("[a-z]*.d2")):
        width = finish(render(source, directory / "fonts"))
        over = width > MAX_WIDTH
        failed = failed or over
        note = f"  over {MAX_WIDTH}: stack it vertically" if over else ""
        print(f"{source.stem}: {width} wide{note}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
