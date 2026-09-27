"""Bounded LangGraph workflow for the optional live S04 investigation."""

from collections.abc import Mapping
from typing import Any, TypedDict

from langgraph.graph import END, START, StateGraph

from server.showcase_investigation.errors import (
    InvalidProviderOutput,
    ProviderUnavailable,
    ToolExecutionFailed,
)
from server.showcase_investigation.fixtures import ScenarioFixture
from server.showcase_investigation.models import (
    EvidenceItem,
    FailureReason,
    LiveInvestigationResult,
    ProviderAssessment,
    ToolName,
    ToolPlan,
)
from server.showcase_investigation.provider import InvestigationProvider

_ALLOWED_TOOLS: tuple[ToolName, ...] = (
    "get_payee_evidence",
    "get_account_activity_evidence",
    "get_device_session_evidence",
)


class _GraphState(TypedDict, total=False):
    """Carry only validated synthetic state through the bounded graph."""

    facts: dict[str, Any]
    plan: ToolPlan
    called_tools: list[ToolName]
    evidence: list[EvidenceItem]
    assessment: ProviderAssessment
    failure_reason: FailureReason


def _validate_citations(
    assessment: ProviderAssessment, evidence: list[EvidenceItem]
) -> None:
    """Require every visible claim to cite evidence returned in this run.

    Args:
        assessment: Typed provider recommendation containing visible claims.
        evidence: Validated evidence returned by selected tools in this run.

    Raises:
        InvalidProviderOutput: If a citation is missing, duplicated, or unknown.
    """
    returned_ids = {item.evidence_id for item in evidence}
    for claim in assessment.claims:
        cited_ids = claim.evidence_ids
        if len(cited_ids) != len(set(cited_ids)) or not set(cited_ids) <= returned_ids:
            raise InvalidProviderOutput("claim cites unavailable evidence")


async def run_live_graph(
    scenario: ScenarioFixture,
    provider: InvestigationProvider,
) -> LiveInvestigationResult:
    """Run the S04 plan–tool–assess graph within accepted safety bounds.

    Args:
        scenario: Accepted synthetic S04 fixture bound to this request.
        provider: Optional live provider adapter selected by the server.

    Returns:
        Validated evidence and assessment, or one stable failure reason. The
        result contains no authority decision or payment action.

    Side effects:
        Makes up to two provider requests and reads accepted in-memory fixture
        evidence. It does not persist data or execute a payment action.
    """
    if scenario.scenario_id != "S04":
        return LiveInvestigationResult(failure_reason="invalid_output")

    async def select_tools(state: _GraphState) -> dict[str, Any]:
        try:
            # Bind the offered tools to this scenario server-side: a tool with
            # no accepted payload here is never offered, so a model cannot
            # pick it and fail the run. A plan naming one anyway still fails
            # closed in collect_evidence.
            offered = tuple(
                name
                for name in _ALLOWED_TOOLS
                if (scenario.tool_evidence or {}).get(name)
            )
            plan = await provider.select_tools(state["facts"], offered)
            if len(plan.tools) != len(set(plan.tools)):
                return {"failure_reason": "tool_budget_exhausted"}
            return {"plan": plan, "called_tools": list(plan.tools)}
        except ProviderUnavailable:
            return {"failure_reason": "provider_unavailable"}
        except InvalidProviderOutput:
            return {"failure_reason": "invalid_output"}

    async def collect_evidence(state: _GraphState) -> dict[str, Any]:
        evidence: list[EvidenceItem] = []
        try:
            for tool_name in state["plan"].tools:
                values = (scenario.tool_evidence or {}).get(tool_name)
                if not values:
                    # Account activity deliberately has no accepted S04 payload;
                    # tools never manufacture a result to satisfy the graph.
                    raise ToolExecutionFailed(tool_name)
                evidence.extend(values)
            return {"evidence": evidence}
        except ToolExecutionFailed:
            return {"failure_reason": "tool_failed"}

    async def assess(state: _GraphState) -> dict[str, Any]:
        try:
            assessment = await provider.assess(state["facts"], state["evidence"])
            _validate_citations(assessment, state["evidence"])
            return {"assessment": assessment}
        except ProviderUnavailable:
            return {"failure_reason": "provider_unavailable"}
        except InvalidProviderOutput:
            return {"failure_reason": "invalid_output"}

    def after_step(state: _GraphState) -> str:
        """Stop immediately when a stable failure has been selected."""
        return "stop" if state.get("failure_reason") else "continue"

    graph = StateGraph(_GraphState)
    graph.add_node("select_tools", select_tools)
    graph.add_node("collect_evidence", collect_evidence)
    graph.add_node("assess", assess)
    graph.add_edge(START, "select_tools")
    graph.add_conditional_edges(
        "select_tools", after_step, {"stop": END, "continue": "collect_evidence"}
    )
    graph.add_conditional_edges(
        "collect_evidence", after_step, {"stop": END, "continue": "assess"}
    )
    graph.add_edge("assess", END)

    # LangGraph recursion is a defensive framework bound, not a product-facing
    # budget. The explicit three-tool limit remains the contractual control.
    final: Mapping[str, Any] = await graph.compile().ainvoke(
        {"facts": scenario.facts}, config={"recursion_limit": 8}
    )
    return LiveInvestigationResult(
        called_tools=final.get("called_tools", []),
        evidence=final.get("evidence", []),
        assessment=final.get("assessment"),
        failure_reason=final.get("failure_reason"),
    )
