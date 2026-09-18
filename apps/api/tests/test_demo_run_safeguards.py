"""Tests for process-local public-showcase execution safeguards."""

import asyncio
import json

import pytest
from fastapi.testclient import TestClient

from server import main


class _SlowPipeline:
    """Minimal pipeline double that exceeds the configured demo timeout."""

    async def astream(self, _state: dict, stream_mode: str):
        """Delay without producing provider output.

        Args:
            _state: Unused synthetic pipeline state.
            stream_mode: Expected LangGraph stream mode.

        Yields:
            No values before cancellation by the timeout.

        Side effects:
            Suspends briefly to exercise timeout cancellation.
        """
        assert stream_mode == "updates"
        await asyncio.sleep(1)
        if False:
            yield {}


class _CapturingPipeline:
    """Capture the effective provider-outage flag from one streamed run."""

    def __init__(self) -> None:
        """Create an empty in-memory capture with no provider side effects."""
        self.states: list[dict] = []

    async def astream(self, state: dict, stream_mode: str):
        """Record validated state and emit no pipeline result.

        Args:
            state: Synthetic pipeline state assembled by the route.
            stream_mode: Expected LangGraph stream mode.

        Yields:
            No node result; the API still emits its terminal SSE event.

        Side effects:
            Appends a shallow state copy to this test double.
        """
        assert stream_mode == "updates"
        self.states.append(dict(state))
        if False:
            yield {}


@pytest.mark.parametrize("raw", ["0", "-1", "not-a-number"])
def test_positive_int_env_rejects_invalid_values(monkeypatch: pytest.MonkeyPatch, raw: str) -> None:
    """Invalid concurrency configuration fails during application startup."""
    monkeypatch.setenv("DEMO_MAX_CONCURRENT_RUNS", raw)

    with pytest.raises(RuntimeError, match="positive integer"):
        main.create_app()


def test_bounded_stream_emits_redacted_timeout_and_done(monkeypatch: pytest.MonkeyPatch) -> None:
    """A timed-out run is an explicit failure followed by the terminal event."""
    monkeypatch.setattr(main, "pipeline", _SlowPipeline())

    async def collect() -> list[str]:
        state = main._build_initial_state("customer", {"amount": 1}, [], False)
        return [
            event
            async for event in main._stream_bounded_run(
                state,
                asyncio.Semaphore(1),
                timeout_seconds=0.01,
            )
        ]

    events = asyncio.run(collect())
    error_payload = json.loads(events[0].removeprefix("data: "))

    assert error_payload == {"node": "error", "error": "processing_timeout"}
    assert events[-1] == "event: done\ndata: {}\n\n"


def test_external_investigation_is_opt_in(monkeypatch: pytest.MonkeyPatch) -> None:
    """The safe default disables paid provider work for public demo traffic."""
    monkeypatch.delenv("DEMO_ALLOW_EXTERNAL_INVESTIGATION", raising=False)
    assert main._boolean_env("DEMO_ALLOW_EXTERNAL_INVESTIGATION", False) is False

    monkeypatch.setenv("DEMO_ALLOW_EXTERNAL_INVESTIGATION", "true")
    assert main._boolean_env("DEMO_ALLOW_EXTERNAL_INVESTIGATION", False) is True


def test_boolean_env_rejects_ambiguous_configuration(monkeypatch: pytest.MonkeyPatch) -> None:
    """A typo cannot silently enable or disable an external provider."""
    monkeypatch.setenv("DEMO_ALLOW_EXTERNAL_INVESTIGATION", "sometimes")

    with pytest.raises(RuntimeError, match="must be true or false"):
        main.create_app()


@pytest.mark.parametrize(
    ("configured", "expected_outage"),
    [(None, True), ("false", True), ("true", False)],
)
def test_preset_route_applies_external_investigation_policy(
    monkeypatch: pytest.MonkeyPatch,
    configured: str | None,
    expected_outage: bool,
) -> None:
    """Preset traffic cannot reach the provider unless deployment opts in."""
    if configured is None:
        monkeypatch.delenv("DEMO_ALLOW_EXTERNAL_INVESTIGATION", raising=False)
    else:
        monkeypatch.setenv("DEMO_ALLOW_EXTERNAL_INVESTIGATION", configured)
    capturing_pipeline = _CapturingPipeline()
    monkeypatch.setattr(main, "pipeline", capturing_pipeline)

    with TestClient(main.create_app()) as client:
        response = client.post("/run/preset/B")

    assert response.status_code == 200
    assert capturing_pipeline.states[0]["simulate_llm_outage"] is expected_outage
