"""The deployment verifier pins the weekday warm window to the free allowances."""

import pytest
from conftest import load_script


@pytest.fixture
def verifier(monkeypatch):
    module = load_script("verify_mvp3_deployment_config")
    # The Bicep compile is covered by CI; these tests check text invariants only.
    monkeypatch.setattr(module.shutil, "which", lambda name: None)
    return module


def _break(monkeypatch, verifier, old: str, new: str) -> None:
    original = verifier._read

    def read(relative_path: str) -> str:
        text = original(relative_path)
        if relative_path == "infra/azure/main.bicep":
            assert old in text, old
            return text.replace(old, new)
        return text

    monkeypatch.setattr(verifier, "_read", read)


@pytest.mark.parametrize(
    ("old", "new"),
    [
        # The window widened past 7 hours, or onto weekends.
        ("start: '0 9 * * 1-5'", "start: '0 7 * * 1-5'"),
        ("end: '0 16 * * 1-5'", "end: '0 19 * * 1-5'"),
        ("end: '0 16 * * 1-5'", "end: '0 16 * * *'"),
        # UTC instead of UK time shifts the window by an hour each summer.
        ("timezone: 'Europe/London'", "timezone: 'UTC'"),
        # More than one warm replica doubles the cost.
        ("desiredReplicas: '1'", "desiredReplicas: '2'"),
        # The rule removed: the site goes back to cold starts all day.
        ("type: 'cron'", "type: 'http'"),
    ],
)
def test_the_verifier_fails_when_the_warm_window_changes(
    monkeypatch, verifier, old, new
) -> None:
    _break(monkeypatch, verifier, old, new)
    with pytest.raises(SystemExit):
        verifier.main()
