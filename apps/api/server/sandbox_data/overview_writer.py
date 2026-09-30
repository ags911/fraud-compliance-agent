"""Write a scenario overview: the live model when allowed, else the template (spec 0011).

The live call has its own switch (``SHOWCASE_OVERVIEW_LIVE_ENABLED``, off by
default), its own accepted limits (``config/public-showcase-overview.v1.json``)
and its own admission controller, so it never shares counters with Run
showcase. The model sees only server built facts, and its output is shown
only when its shape is right and every figure in it is a fact's token.
"""

import asyncio
import json
import logging
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal, Protocol

from server.sandbox_data.overview import (
    OverviewFacts,
    is_grounded,
    template_overview,
    valid_overview_shape,
)
from server.showcase_investigation.admission import LiveAdmissionController
from server.showcase_investigation.errors import (
    InvalidProviderOutput,
    ProviderUnavailable,
    ShowcaseRuntimeUnavailable,
)
from server.showcase_investigation.provider import GroqInvestigationProvider
from server.showcase_investigation.settings import LiveLimits, _explicit_boolean

logger = logging.getLogger(__name__)

_REPOSITORY_ROOT = Path(__file__).resolve().parents[4]
_CONFIG_PATH = Path("config/public-showcase-overview.v1.json")

FallbackReason = Literal[
    "live_disabled",
    "admission_limited",
    "provider_unavailable",
    "timeout",
    "invalid_output",
    "ungrounded",
]

SYSTEM_PROMPT = (
    "Summarise only the facts given. Copy every figure and date exactly as "
    "written; never round, convert, abbreviate or compute. Do not give advice, "
    "predict, or recommend any action on a payment. Reply as JSON: "
    "{headline, points}, with exactly 3 to 5 points."
)

_LOW_EFFORT_MODEL_IDS = frozenset({"openai/gpt-oss-20b", "openai/gpt-oss-120b"})


@dataclass(frozen=True)
class OverviewSettings:
    """Hold the overview's switch, accepted limits and provider configuration."""

    live_enabled: bool
    groq_api_key: str | None
    groq_model: str | None
    groq_allowed_models: tuple[str, ...]
    limits: LiveLimits
    max_completion_tokens: int
    reasoning_effort: Literal["low"]

    @property
    def provider_ready(self) -> bool:
        """Return whether a key and an allowlisted model permit a live call."""
        return bool(
            self.groq_api_key
            and self.groq_model
            and self.groq_model in self.groq_allowed_models
        )


def load_overview_settings(root: Path | None = None) -> OverviewSettings:
    """Load the accepted overview limits and the server side provider settings.

    Args:
        root: Optional root holding ``config/public-showcase-overview.v1.json``.

    Returns:
        The switch (default off), limits, token cap and provider settings.

    Raises:
        ShowcaseRuntimeUnavailable: If the accepted config is absent or
            malformed, or the switch is not an explicit boolean.

    Side effects:
        Reads one committed JSON file and four environment variables.
    """
    override = os.getenv("FCA_SHOWCASE_ROOT", "").strip()
    base = root or (Path(override) if override else _REPOSITORY_ROOT)
    try:
        document = json.loads((base / _CONFIG_PATH).read_text(encoding="utf-8"))
        if (
            document["schema_version"] != "1.0"
            or document["status"] != "accepted"
            or document["runtime_consumption"] != "allowed"
        ):
            raise ValueError("overview configuration is not accepted")
        live = document["live_mode"]
        client = live["per_observed_client"]
        process = live["per_process_enablement_window"]
        limits = LiveLimits(
            maximum_concurrent=int(live["maximum_concurrent_overviews"]),
            maximum_per_client=int(client["maximum_overviews"]),
            per_client_window_seconds=int(client["window_seconds"]),
            maximum_per_process_window=int(process["maximum_overviews"]),
            maximum_window_seconds=int(process["maximum_duration_seconds"]),
            timeout_seconds=int(live["overall_overview_timeout_seconds"]),
        )
        max_tokens = int(live["maximum_completion_tokens"])
        reasoning_effort = str(live["reasoning_effort"])
        if min(limits.__dict__.values()) <= 0 or max_tokens <= 0:
            raise ValueError("overview limits must be positive")
        if reasoning_effort != "low":
            raise ValueError("overview reasoning effort must be low")
    except (OSError, KeyError, TypeError, ValueError, json.JSONDecodeError) as error:
        raise ShowcaseRuntimeUnavailable(
            "accepted overview configuration is unavailable"
        ) from error
    allowed_models = tuple(
        value.strip()
        for value in os.getenv("SHOWCASE_GROQ_ALLOWED_MODELS", "").split(",")
        if value.strip()
    )
    return OverviewSettings(
        # Off unless an operator explicitly switches it on (AC-11).
        live_enabled=_explicit_boolean("SHOWCASE_OVERVIEW_LIVE_ENABLED", False),
        groq_api_key=os.getenv("GROQ_API_KEY") or None,
        groq_model=os.getenv("SHOWCASE_GROQ_MODEL") or None,
        groq_allowed_models=allowed_models,
        limits=limits,
        max_completion_tokens=max_tokens,
        reasoning_effort=reasoning_effort,
    )


class OverviewProvider(Protocol):
    """The one call an overview delegates to a live provider."""

    model_id: str

    async def complete_json(
        self,
        messages: list[dict[str, str]],
        *,
        max_completion_tokens: int,
        reasoning_effort: Literal["low"] | None = None,
    ) -> dict[str, Any]:
        """Return one decoded JSON object for server authored messages.

        Args:
            messages: Server authored messages containing synthetic facts only.
            max_completion_tokens: The caller's output budget.
            reasoning_effort: Optional low effort request for a supported GPT
                OSS overview call. It is omitted for every other model.
        """


@dataclass(frozen=True)
class WrittenOverview:
    """An overview's text and where it came from."""

    source: Literal["live", "template"]
    model_id: str | None
    headline: str
    points: list[str]
    fallback_reason: FallbackReason | None


class OverviewWriter:
    """Write overviews under the overview's own switch, limits and fact check."""

    def __init__(
        self,
        settings: OverviewSettings,
        *,
        provider: OverviewProvider | None = None,
        admission: LiveAdmissionController | None = None,
    ) -> None:
        """Create the writer and its own process local admission counters.

        Args:
            settings: The overview's switch, limits and provider settings.
            provider: Injected provider for tests; otherwise a Groq provider
                is built only when the settings are ready.
            admission: Optional controller for tests.

        Side effects:
            Creates in-memory counters. No provider call is made.
        """
        self.settings = settings
        self.admission = admission or LiveAdmissionController(settings.limits)
        if provider is not None:
            self.provider: OverviewProvider | None = provider
        elif settings.provider_ready and settings.groq_api_key and settings.groq_model:
            self.provider = GroqInvestigationProvider(
                settings.groq_api_key, settings.groq_model
            )
        else:
            self.provider = None

    def _template(
        self, facts: OverviewFacts, reason: FallbackReason
    ) -> WrittenOverview:
        headline, points = template_overview(facts)
        return WrittenOverview("template", None, headline, points, reason)

    async def write(self, facts: OverviewFacts, client_key: str) -> WrittenOverview:
        """Return a live, fact checked overview when allowed, else the template.

        The checks run in a fixed order (AC-6): the switch, then provider
        readiness, neither of which takes a slot; only then an admission
        slot, which is always released.

        Args:
            facts: Server built facts; the only content the model sees.
            client_key: Server derived client identity for the visitor limit.

        Returns:
            The overview, labelled with its source and any fallback reason.

        Side effects:
            May reserve one admission slot and make one provider request.
            Logs one fixed category line; never the facts, prompt or output.
        """
        overview = await self._write(facts, client_key)
        logger.info(
            "overview_written source=%s reason=%s",
            overview.source,
            overview.fallback_reason or "none",
        )
        return overview

    async def _write(self, facts: OverviewFacts, client_key: str) -> WrittenOverview:
        if not self.settings.live_enabled:
            return self._template(facts, "live_disabled")
        if self.provider is None or not self.settings.provider_ready:
            return self._template(facts, "provider_unavailable")
        decision = await self.admission.acquire(client_key)
        if not decision.allowed:
            return self._template(facts, "admission_limited")
        try:
            async with asyncio.timeout(self.settings.limits.timeout_seconds):
                output = await self.provider.complete_json(
                    [
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {
                            "role": "user",
                            "content": json.dumps(facts.written, separators=(",", ":")),
                        },
                    ],
                    max_completion_tokens=self.settings.max_completion_tokens,
                    reasoning_effort=(
                        self.settings.reasoning_effort
                        if self.settings.groq_model in _LOW_EFFORT_MODEL_IDS
                        else None
                    ),
                )
        except TimeoutError:
            return self._template(facts, "timeout")
        except ProviderUnavailable:
            return self._template(facts, "provider_unavailable")
        except InvalidProviderOutput:
            return self._template(facts, "invalid_output")
        finally:
            await self.admission.release()
        shaped = valid_overview_shape(output)
        if shaped is None:
            return self._template(facts, "invalid_output")
        headline, points = shaped
        if not is_grounded([headline, *points], facts):
            return self._template(facts, "ungrounded")
        return WrittenOverview("live", self.provider.model_id, headline, points, None)
