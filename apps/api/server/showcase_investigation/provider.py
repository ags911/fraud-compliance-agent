"""Optional Groq adapter for bounded, schema-validated showcase output."""

import json
from collections.abc import Sequence
from typing import Any, Protocol

from groq import AsyncGroq
from pydantic import ValidationError

from server.showcase_investigation.errors import (
    InvalidProviderOutput,
    ProviderUnavailable,
)
from server.showcase_investigation.models import (
    EvidenceItem,
    ProviderAssessment,
    ToolName,
    ToolPlan,
)


class InvestigationProvider(Protocol):
    """Define the only two bounded decisions delegated to a live provider."""

    async def select_tools(
        self, facts: dict[str, Any], allowed_tools: Sequence[ToolName]
    ) -> ToolPlan:
        """Choose two or three distinct read-only evidence tools."""

    async def assess(
        self, facts: dict[str, Any], evidence: Sequence[EvidenceItem]
    ) -> ProviderAssessment:
        """Return a cited recommendation using only same-run evidence."""


class GroqInvestigationProvider:
    """Call one server-selected Groq model without retaining raw responses."""

    def __init__(
        self,
        api_key: str,
        model_id: str,
        *,
        client: Any | None = None,
    ) -> None:
        """Create a server-side adapter for one allowlisted model.

        Args:
            api_key: Server-side Groq credential; never exposed or logged.
            model_id: Operator-selected identifier already checked against the
                server-side allowlist.
            client: Optional compatible asynchronous client used by tests.

        Side effects:
            Constructs a Groq client when no client is injected. No request is
            made until ``select_tools`` or ``assess`` is awaited.
        """
        self.model_id = model_id
        self._client = client or AsyncGroq(api_key=api_key, max_retries=0)

    async def _complete_json(self, messages: list[dict[str, str]]) -> dict[str, Any]:
        """Return one decoded JSON object while redacting provider failures.

        Args:
            messages: Server-authored instructions containing synthetic facts
                only. Caller-authored prompts are never accepted.

        Returns:
            Decoded provider JSON, not the raw provider response.

        Raises:
            ProviderUnavailable: If the provider call fails or has no content.
            InvalidProviderOutput: If content is not exactly one JSON object.

        Side effects:
            Makes one external Groq request. It does not log or persist prompts,
            provider output, exceptions, or hidden reasoning.
        """
        try:
            response = await self._client.chat.completions.create(
                model=self.model_id,
                messages=messages,
                response_format={"type": "json_object"},
                include_reasoning=False,
                temperature=0,
                max_completion_tokens=800,
            )
            content = response.choices[0].message.content
            if not content:
                raise ProviderUnavailable("provider returned no validated content")
            decoded = json.loads(content)
            if not isinstance(decoded, dict):
                raise InvalidProviderOutput("provider output is not an object")
            return decoded
        except InvalidProviderOutput:
            raise
        except (json.JSONDecodeError, TypeError, ValueError) as error:
            raise InvalidProviderOutput("provider output is not valid JSON") from error
        except Exception as error:
            # SDK exceptions can contain request and provider internals. The
            # runtime converts every such failure to one stable public reason.
            raise ProviderUnavailable("live provider is unavailable") from error

    async def select_tools(
        self, facts: dict[str, Any], allowed_tools: Sequence[ToolName]
    ) -> ToolPlan:
        """Choose a bounded tool plan from server-supplied synthetic facts.

        Args:
            facts: Accepted S04 synthetic transaction facts.
            allowed_tools: Exact server-owned read-only tool allowlist.

        Returns:
            A validated two- or three-tool plan.

        Raises:
            ProviderUnavailable: If Groq cannot complete the request.
            InvalidProviderOutput: If output does not match ``ToolPlan``.

        Side effects:
            Makes one external provider request and retains no raw response.
        """
        messages = [
            {
                "role": "system",
                "content": (
                    "Select evidence tools for a synthetic payment-risk showcase. "
                    'Return JSON only as {"tools": [...]}. Choose at least two '
                    "distinct names from the supplied allowlist. Do not make a "
                    "payment decision and do not provide reasoning."
                ),
            },
            {
                "role": "user",
                "content": json.dumps(
                    {"synthetic_facts": facts, "allowed_tools": list(allowed_tools)},
                    separators=(",", ":"),
                ),
            },
        ]
        try:
            return ToolPlan.model_validate(await self._complete_json(messages))
        except ValidationError as error:
            raise InvalidProviderOutput(
                "provider returned an invalid tool plan"
            ) from error

    async def assess(
        self, facts: dict[str, Any], evidence: Sequence[EvidenceItem]
    ) -> ProviderAssessment:
        """Produce a typed recommendation grounded only in returned evidence.

        Args:
            facts: Accepted S04 synthetic transaction facts.
            evidence: Validated same-run tool evidence safe for display.

        Returns:
            Validated summary, recommendation, claims and uncertainties.

        Raises:
            ProviderUnavailable: If Groq cannot complete the request.
            InvalidProviderOutput: If output does not match the assessment shape.

        Side effects:
            Makes one external provider request and retains no raw response.
        """
        messages = [
            {
                "role": "system",
                "content": (
                    "Assess a synthetic payment-risk showcase using only supplied "
                    "evidence. Return JSON only with the fields recommendation, "
                    "summary, claims, and uncertainties. recommendation must be "
                    "exactly one of PASS, CHALLENGE, or HOLD in upper case. "
                    "summary is one short sentence. claims is a non-empty list; "
                    "each claim has claim_id, text, and evidence_ids. claim_id "
                    "must start with claim_ followed by lower-case words joined "
                    "by underscores, for example claim_recent_payee. evidence_ids "
                    "must be copied unchanged from the supplied evidence. "
                    "uncertainties is a list of short strings. Do not include "
                    "reasoning, authority, scores, thresholds, or payment actions."
                ),
            },
            {
                "role": "user",
                "content": json.dumps(
                    {
                        "synthetic_facts": facts,
                        "evidence": [item.model_dump() for item in evidence],
                    },
                    separators=(",", ":"),
                ),
            },
        ]
        try:
            return ProviderAssessment.model_validate(
                await self._complete_json(messages)
            )
        except ValidationError as error:
            raise InvalidProviderOutput(
                "provider returned an invalid assessment"
            ) from error
