"""Every relative Markdown link in the repository must resolve.

Renaming or moving a document silently breaks links to it; this test turns that
into a failure. External links and vendored or generated trees are skipped.
"""

import re
from pathlib import Path
from urllib.parse import unquote

import pytest

# Inline links and images; the target ends at the first space or closing bracket.
LINK = re.compile(r"!?\[[^\]]*\]\(([^)\s]+)(?:\s+\"[^\"]*\")?\)")
FENCE = re.compile(r"^(```|~~~).*?^\1", re.MULTILINE | re.DOTALL)
INLINE_CODE = re.compile(r"`[^`\n]*`")
HEADING = re.compile(r"^#{1,6}\s+(.*?)\s*#*\s*$", re.MULTILINE)
SKIPPED_PARTS = {"node_modules", "vendor", "dist", "playwright-report", "test-results"}


def _slug(heading: str) -> str:
    """Return GitHub's anchor for a heading: lowercase, punctuation dropped, spaces to hyphens."""
    return re.sub(r"[^\w\- ]", "", heading.lower().replace("`", "")).replace(" ", "-")


def _anchors(markdown: str) -> set[str]:
    """Collect every anchor a document defines, including GitHub's `-1` duplicate suffixes."""
    seen: dict[str, int] = {}
    anchors: set[str] = set()
    for heading in HEADING.findall(FENCE.sub("", markdown)):
        slug = _slug(heading)
        count = seen.get(slug, 0)
        anchors.add(slug if count == 0 else f"{slug}-{count}")
        seen[slug] = count + 1
    return anchors


def _markdown_files(root: Path) -> list[Path]:
    """List project Markdown files, skipping dot-directories (except .github) and dependencies."""
    files = []
    for path in root.rglob("*.md"):
        parts = path.relative_to(root).parts[:-1]
        if SKIPPED_PARTS & set(parts):
            continue
        if any(part.startswith(".") and part != ".github" for part in parts):
            continue
        files.append(path)
    return sorted(files)


def _broken_links(path: Path, root: Path) -> list[str]:
    """Return a description of each unresolved relative link or anchor in one file."""
    text = INLINE_CODE.sub("", FENCE.sub("", path.read_text(encoding="utf-8")))
    problems = []
    for target in LINK.findall(text):
        if re.match(r"^([a-z][a-z0-9+.-]*:|//|/)", target, re.IGNORECASE):
            continue  # external URL, mailto:, or a site-absolute path
        raw_path, _, fragment = target.partition("#")
        resolved = path if not raw_path else (path.parent / unquote(raw_path)).resolve()
        location = f"{path.relative_to(root)} -> {target}"
        if not resolved.exists():
            problems.append(f"{location} (file not found)")
        elif fragment and resolved.suffix == ".md":
            if unquote(fragment).lower() not in _anchors(resolved.read_text(encoding="utf-8")):
                problems.append(f"{location} (anchor not found)")
    return problems


def test_the_scan_covers_the_project_documents(repository_root) -> None:
    """Guard against the scan silently matching nothing."""
    names = {path.relative_to(repository_root).as_posix() for path in _markdown_files(repository_root)}

    assert {"README.md", "docs/README.md", "docs/project-context.md", "docs/product/prd.md"} <= names
    assert not any(name.startswith("apps/api/vendor/") for name in names)


def test_relative_markdown_links_resolve(repository_root) -> None:
    """No project document links to a missing file or a missing heading."""
    broken = [problem for path in _markdown_files(repository_root) for problem in _broken_links(path, repository_root)]

    assert not broken, "Broken links:\n" + "\n".join(broken)


@pytest.mark.parametrize(
    ("heading", "slug"),
    [
        ("Showcase MVP completion checklist", "showcase-mvp-completion-checklist"),
        ("R1 — Required oversight is not completed oversight", "r1--required-oversight-is-not-completed-oversight"),
        ("`make check` and CI", "make-check-and-ci"),
    ],
)
def test_anchor_slugs_follow_github_rules(heading, slug) -> None:
    """The anchor helper matches GitHub's behaviour on the heading styles used here."""
    assert _slug(heading) == slug


def test_the_checker_detects_a_broken_link(tmp_path) -> None:
    """A missing file and a missing anchor are both reported."""
    (tmp_path / "target.md").write_text("# Real heading\n", encoding="utf-8")
    source = tmp_path / "source.md"
    source.write_text(
        "[ok](target.md#real-heading) [gone](missing.md) [bad anchor](target.md#nope) [web](https://example.com)\n"
        "```\n[fenced](ignored.md)\n```\n",
        encoding="utf-8",
    )

    problems = _broken_links(source, tmp_path)

    assert problems == [
        "source.md -> missing.md (file not found)",
        "source.md -> target.md#nope (anchor not found)",
    ]
