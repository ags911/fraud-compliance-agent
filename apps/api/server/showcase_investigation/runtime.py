"""Orchestrate deterministic playback and bounded live showcase investigations."""

import asyncio
import json
import uuid
from collections.abc import AsyncIterator
from typing import Any

from server.showcase_investigation.admission import LiveAdmissionController
from server.showcase_investigation.errors import ShowcaseRuntimeUnavailable
from server.showcase_investigation.fixtures import (
    FixturePacket,
    ScenarioFixture,
    load_fixture_packet,
)
from server.showcase_investigation.graph import run_live_graph
from server.showcase_investigation.models import (
    FailureReason,
    LiveInvestigationResult,
    ShowcaseInvestigationRequest,
)
from server.showcase_investigation.provider import (
    GroqInvestigationProvider,
    InvestigationProvider,
)
from server.showcase_investigation.settings import ShowcaseSettings, load_settings

_PUBLIC_READY_SCENARIOS = frozenset({"S01", "S02", "S03", "S04", "S05"})
_SKIPPED_SCENARIOS = {
    "S01": ("PASS", "deterministic_clear_route"),
    "S02": ("HOLD", "hard_deterministic_control"),
    "S03": ("HOLD", "hard_app_control"),
}
_FAILURE_SUMMARIES: dict[FailureReason, str] = {
    "provider_unavailable": (
        "The synthetic investigation stopped safely because its provider was unavailable."
    ),
    "tool_failed": (
        "The synthetic investigation stopped safely because accepted evidence was unavailable."
    ),
    "invalid_output": (
        "The synthetic investigation stopped safely because its output was invalid."
    ),
    "timeout": "The synthetic investigation stopped safely after its time limit.",
    "tool_budget_exhausted": (
        "The synthetic investigation stopped safely after its tool budget was exhausted."
    ),
}


class ShowcaseRuntime:
    """Serve accepted synthetic fixtures without operational or payment authority."""

    def __init__(
        self,
        packet: FixturePacket,
        settings: ShowcaseSettings,
        *,
        provider: InvestigationProvider | None = None,
        admission: LiveAdmissionController | None = None,
    ) -> None:
        """Create one process-local runtime from validated inputs.

        Args:
            packet: Accepted S01–S08 synthetic fixture packet.
            settings: Accepted limits plus optional server-side provider config.
            provider: Injected provider for tests. Production construction uses
                Groq only when key, model and allowlist all agree.
            admission: Optional deterministic controller used by tests.

        Side effects:
            Creates process-local admission counters. No provider call or
            persistence occurs during construction.
        """
        self.packet = packet
        self.settings = settings
        self.admission = admission or LiveAdmissionController(settings.limits)
        if provider is not None:
            self.provider = provider
        elif settings.provider_ready:
            self.provider = GroqInvestigationProvider(
                settings.groq_api_key or "",
                settings.groq_model or "",
            )
        else:
            self.provider = None

    @classmethod
    def from_environment(cls) -> "ShowcaseRuntime":
        """Build the runtime from accepted files and server environment.

        Returns:
            Ready recorded runtime with optional live provider configuration.

        Raises:
            ShowcaseRuntimeUnavailable: If accepted fixtures or safeguards
                cannot be loaded. Missing provider settings only disable live
                execution and do not disable recorded playback.

        Side effects:
            Reads accepted files and process environment configuration.
        """
        return cls(load_fixture_packet(), load_settings())

    def require_public_scenario(self, scenario_id: str) -> ScenarioFixture:
        """Return an MVP 3-ready scenario or refuse deferred behavior.

        Args:
            scenario_id: Validated S01–S08 identifier from the public request.

        Returns:
            Accepted S01–S05 fixture.

        Raises:
            ShowcaseRuntimeUnavailable: For S06–S08, whose operational review,
                idempotency and replay behavior remains deferred.
        """
        if scenario_id not in _PUBLIC_READY_SCENARIOS:
            raise ShowcaseRuntimeUnavailable(
                "scenario operational behavior is not available in MVP 3"
            )
        return self.packet.scenarios[scenario_id]

    @staticmethod
    def _identity(run_id: str, scenario_id: str, sequence: int, event: str) -> dict:
        """Build stable event identity fields for one transient run."""
        suffix = run_id.removeprefix("run_")[:16]
        return {
            "schema_version": "1.0",
            "event_id": f"evt_{suffix}_{sequence}",
            "run_id": run_id,
            "scenario_id": scenario_id,
            "sequence": sequence,
            "event": event,
        }

    @staticmethod
    def _sse(payload: dict[str, Any]) -> str:
        """Encode one validated event payload as an SSE data frame."""
        return f"data: {json.dumps(payload, separators=(',', ':'))}\n\n"

    async def _recorded_s04(
        self, scenario: ScenarioFixture, run_id: str, sequence: int
    ) -> AsyncIterator[dict[str, Any]]:
        """Yield the exact accepted two-tool S04 playback.

        Args:
            scenario: Accepted S04 fixture containing payee/device evidence.
            run_id: Transient identifier shared by every event in the stream.
            sequence: First available event sequence number.

        Yields:
            Tool, investigation, and result payloads with synthetic provenance.

        Raises:
            ShowcaseRuntimeUnavailable: If accepted recorded evidence is absent.
        """
        returned_ids: set[str] = set()
        for call_index, tool_name in enumerate(
            scenario.recorded_tool_sequence, start=1
        ):
            yield {
                **self._identity(run_id, "S04", sequence, "tool_call"),
                "call_index": call_index,
                "tool_name": tool_name,
            }
            sequence += 1
            evidence = (scenario.tool_evidence or {}).get(tool_name)
            if not evidence:
                raise ShowcaseRuntimeUnavailable("accepted S04 evidence is unavailable")
            returned_ids.update(item.evidence_id for item in evidence)
            yield {
                **self._identity(run_id, "S04", sequence, "tool_result"),
                "call_index": call_index,
                "tool_name": tool_name,
                "evidence": [item.model_dump() for item in evidence],
            }
            sequence += 1

        required = {"ev_payee_relationship", "ev_device_familiarity"}
        if returned_ids != required:
            raise ShowcaseRuntimeUnavailable("accepted S04 evidence has drifted")
        yield {
            **self._identity(run_id, "S04", sequence, "investigation_result"),
            "investigation_status": "complete",
            "recommendation": "CHALLENGE",
            "recommendation_basis": "evidence_grounded",
            "summary": (
                "Synthetic evidence remains mixed, so the bounded agent "
                "recommends a challenge."
            ),
            "claims": [
                {
                    "claim_id": "claim_recent_payee",
                    "text": "The synthetic payee relationship is recent.",
                    "evidence_ids": ["ev_payee_relationship"],
                },
                {
                    "claim_id": "claim_changed_network",
                    "text": (
                        "The recognised device is paired with a changed synthetic "
                        "network context."
                    ),
                    "evidence_ids": ["ev_device_familiarity"],
                },
            ],
            "uncertainties": [
                "No production identity or provider evidence is available."
            ],
            "authority_status": "not_evaluated",
            "simulated_action": "none",
            "failure_reason": None,
        }
        sequence += 1
        yield self._run_result(
            run_id,
            "S04",
            sequence,
            status="complete",
            recommendation="CHALLENGE",
            basis="evidence_grounded",
            execution_mode="recorded",
        )

    def _incomplete_result(
        self,
        run_id: str,
        scenario_id: str,
        sequence: int,
        failure_reason: FailureReason,
    ) -> dict[str, Any]:
        """Build one accepted fail-safe investigation event."""
        uncertainty = (
            "No live provider response was used."
            if failure_reason == "provider_unavailable"
            else "The incomplete investigation produced no authoritative outcome."
        )
        return {
            **self._identity(run_id, scenario_id, sequence, "investigation_result"),
            "investigation_status": "incomplete",
            "recommendation": "HOLD",
            "recommendation_basis": "fail_safe",
            "summary": _FAILURE_SUMMARIES[failure_reason],
            "claims": [],
            "uncertainties": [uncertainty],
            "authority_status": "not_evaluated",
            "simulated_action": "none",
            "failure_reason": failure_reason,
        }

    def _run_result(
        self,
        run_id: str,
        scenario_id: str,
        sequence: int,
        *,
        status: str,
        recommendation: str,
        basis: str,
        execution_mode: str,
    ) -> dict[str, Any]:
        """Build the non-authoritative terminal result payload."""
        return {
            **self._identity(run_id, scenario_id, sequence, "run_result"),
            "investigation_status": status,
            "recommendation": recommendation,
            "recommendation_basis": basis,
            "authority_status": "not_evaluated",
            "simulated_action": "none",
            "execution_mode": execution_mode,
            "data_label": "synthetic",
        }

    async def _live_s04(
        self, scenario: ScenarioFixture, run_id: str, sequence: int
    ) -> AsyncIterator[dict[str, Any]]:
        """Yield bounded live S04 events from a validated LangGraph result."""
        if self.provider is None:
            result = LiveInvestigationResult(failure_reason="provider_unavailable")
        else:
            try:
                async with asyncio.timeout(self.settings.limits.timeout_seconds):
                    result = await run_live_graph(scenario, self.provider)
            except TimeoutError:
                result = LiveInvestigationResult(failure_reason="timeout")

        for call_index, tool_name in enumerate(result.called_tools, start=1):
            yield {
                **self._identity(run_id, "S04", sequence, "tool_call"),
                "call_index": call_index,
                "tool_name": tool_name,
            }
            sequence += 1
            evidence = (scenario.tool_evidence or {}).get(tool_name)
            if evidence and all(item in result.evidence for item in evidence):
                yield {
                    **self._identity(run_id, "S04", sequence, "tool_result"),
                    "call_index": call_index,
                    "tool_name": tool_name,
                    "evidence": [item.model_dump() for item in evidence],
                }
                sequence += 1

        if result.failure_reason or result.assessment is None:
            failure = result.failure_reason or "invalid_output"
            yield self._incomplete_result(run_id, "S04", sequence, failure)
            sequence += 1
            yield self._run_result(
                run_id,
                "S04",
                sequence,
                status="incomplete",
                recommendation="HOLD",
                basis="fail_safe",
                execution_mode="live",
            )
            return

        assessment = result.assessment
        yield {
            **self._identity(run_id, "S04", sequence, "investigation_result"),
            "investigation_status": "complete",
            "recommendation": assessment.recommendation,
            "recommendation_basis": "evidence_grounded",
            "summary": assessment.summary,
            "claims": [claim.model_dump() for claim in assessment.claims],
            "uncertainties": assessment.uncertainties,
            "authority_status": "not_evaluated",
            "simulated_action": "none",
            "failure_reason": None,
        }
        sequence += 1
        yield self._run_result(
            run_id,
            "S04",
            sequence,
            status="complete",
            recommendation=assessment.recommendation,
            basis="evidence_grounded",
            execution_mode="live",
        )

    async def stream(
        self, request: ShowcaseInvestigationRequest, client_key: str
    ) -> AsyncIterator[str]:
        """Stream one accepted scenario with exactly one terminal done event.

        Args:
            request: Strict scenario-only request validated by FastAPI.
            client_key: Socket-derived client identity used only for process-
                local admission control.

        Yields:
            SSE frames matching the accepted v1 event schema.

        Raises:
            ShowcaseRuntimeUnavailable: Before streaming when the scenario is
                outside the S01–S05 database-free runtime scope.

        Side effects:
            May reserve process-local admission capacity and, for an admitted
            live S04 only, make bounded Groq calls. No data is persisted.
        """
        scenario = self.require_public_scenario(request.scenario_id)
        run_id = f"run_{uuid.uuid4().hex}"
        actual_mode = "recorded"
        fallback_reason: str | None = None
        admitted = False

        # Only S04 can use the live provider. Every deterministic or failure-
        # injection scenario stays recorded even if a caller requests live.
        if request.execution_mode == "live" and request.scenario_id == "S04":
            if not self.settings.live_enabled:
                fallback_reason = "live_disabled"
            elif self.provider is None or not self.settings.provider_ready:
                fallback_reason = "provider_unavailable"
            else:
                decision = await self.admission.acquire(client_key)
                if decision.allowed:
                    admitted = True
                    actual_mode = "live"
                else:
                    fallback_reason = "admission_limited"
        elif request.execution_mode == "live":
            fallback_reason = (
                "provider_unavailable"
                if request.scenario_id == "S05"
                else "live_disabled"
            )

        sequence = 1
        started = {
            **self._identity(run_id, request.scenario_id, sequence, "run_started"),
            "requested_mode": request.execution_mode,
            "execution_mode": actual_mode,
            "fallback_reason": fallback_reason,
            "provider": "groq" if actual_mode == "live" else None,
            "model_id": self.settings.groq_model if actual_mode == "live" else None,
            "data_label": "synthetic",
        }

        try:
            yield self._sse(started)
            sequence += 1
            if request.scenario_id in _SKIPPED_SCENARIOS:
                recommendation, reason = _SKIPPED_SCENARIOS[request.scenario_id]
                yield self._sse(
                    {
                        **self._identity(
                            run_id, request.scenario_id, sequence, "route_resolved"
                        ),
                        "deterministic_route": recommendation,
                        "investigation_eligibility": "skipped",
                    }
                )
                sequence += 1
                yield self._sse(
                    {
                        **self._identity(
                            run_id,
                            request.scenario_id,
                            sequence,
                            "investigation_skipped",
                        ),
                        "reason": reason,
                    }
                )
                sequence += 1
                yield self._sse(
                    self._run_result(
                        run_id,
                        request.scenario_id,
                        sequence,
                        status="skipped",
                        recommendation=recommendation,
                        basis="deterministic",
                        execution_mode="recorded",
                    )
                )
            elif request.scenario_id == "S05":
                yield self._sse(
                    {
                        **self._identity(run_id, "S05", sequence, "route_resolved"),
                        "deterministic_route": "INVESTIGATE",
                        "investigation_eligibility": "eligible_failure_test",
                    }
                )
                sequence += 1
                yield self._sse(
                    self._incomplete_result(
                        run_id, "S05", sequence, "provider_unavailable"
                    )
                )
                sequence += 1
                yield self._sse(
                    self._run_result(
                        run_id,
                        "S05",
                        sequence,
                        status="incomplete",
                        recommendation="HOLD",
                        basis="fail_safe",
                        execution_mode="recorded",
                    )
                )
            else:
                yield self._sse(
                    {
                        **self._identity(run_id, "S04", sequence, "route_resolved"),
                        "deterministic_route": "INVESTIGATE",
                        "investigation_eligibility": "eligible",
                    }
                )
                sequence += 1
                iterator = (
                    self._live_s04(scenario, run_id, sequence)
                    if actual_mode == "live"
                    else self._recorded_s04(scenario, run_id, sequence)
                )
                async for payload in iterator:
                    yield self._sse(payload)
        finally:
            if admitted:
                await self.admission.release()
        yield "event: done\ndata: {}\n\n"
