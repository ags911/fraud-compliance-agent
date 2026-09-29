"""The deployment verifier keeps live overviews off and their inputs shipped (spec 0011 AC-11)."""

import pytest
from conftest import load_script


@pytest.fixture
def verifier(monkeypatch):
    module = load_script("verify_mvp3_deployment_config")
    # The Bicep compile is covered by CI; these tests check text invariants only.
    monkeypatch.setattr(module.shutil, "which", lambda name: None)
    return module


def _break(monkeypatch, verifier, path: str, old: str, new: str) -> None:
    original = verifier._read

    def read(relative_path: str) -> str:
        text = original(relative_path)
        if relative_path == path:
            assert old in text, old
            return text.replace(old, new)
        return text

    monkeypatch.setattr(verifier, "_read", read)


def test_the_verifier_passes_as_committed(verifier) -> None:
    verifier.main()


@pytest.mark.parametrize(
    ("path", "old", "new"),
    [
        # The code default switched on.
        (
            "apps/api/server/sandbox_data/overview_writer.py",
            '_explicit_boolean("SHOWCASE_OVERVIEW_LIVE_ENABLED", False)',
            '_explicit_boolean("SHOWCASE_OVERVIEW_LIVE_ENABLED", True)',
        ),
        # The Bicep default switched on.
        (
            "infra/azure/main.bicep",
            "param showcaseOverviewLiveEnabled string = 'false'",
            "param showcaseOverviewLiveEnabled string = 'true'",
        ),
        # The Dockerfile stops copying the config or the contract.
        (
            "apps/api/Dockerfile",
            "COPY config/public-showcase-overview.v1.json /app/showcase/config/",
            "",
        ),
        (
            "apps/api/Dockerfile",
            "COPY docs/contracts/sandbox-overview.v1.schema.json /app/showcase/docs/contracts/",
            "",
        ),
        # .dockerignore stops allowing either.
        (".dockerignore", "!config/public-showcase-overview.v1.json", ""),
        (".dockerignore", "!docs/contracts/sandbox-overview.v1.schema.json", ""),
    ],
)
def test_the_verifier_fails_for_each_overview_condition(
    monkeypatch, verifier, path, old, new
) -> None:
    _break(monkeypatch, verifier, path, old, new)
    with pytest.raises(SystemExit):
        verifier.main()
