"""Load only the accepted synthetic public-showcase fixture packet."""

import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from pydantic import ValidationError

from server.showcase_investigation.errors import ShowcaseRuntimeUnavailable
from server.showcase_investigation.models import EvidenceItem, ScenarioId, ToolName

_REPOSITORY_ROOT = Path(__file__).resolve().parents[4]
_FIXTURE_PATH = Path("fixtures/s01-s08/scenarios.v1.json")
_EXPECTED_SCENARIOS = tuple(f"S0{number}" for number in range(1, 9))
# ADR-016 accepted "1.0". ADR-018/019 accept "1.1", which adds one
# Plaid-Sandbox-derived evidence item (S04's account-activity tool) for live
# selection only; the recorded playback script is unchanged. A version this
# loader does not recognise is rejected rather than guessed at.
_ACCEPTED_VERSIONS = ("1.0", "1.1")
_SANDBOX_ENVIRONMENT_LABEL = "plaid_sandbox_test_only"


@dataclass(frozen=True)
class ScenarioFixture:
    """Expose one validated synthetic scenario without granting extra semantics."""

    scenario_id: ScenarioId
    facts: dict[str, Any]
    expected_boundary: dict[str, Any]
    recorded_tool_sequence: tuple[ToolName, ...] = ()
    tool_evidence: dict[ToolName, tuple[EvidenceItem, ...]] | None = None


@dataclass(frozen=True)
class FixturePacket:
    """Expose accepted scenario fixtures indexed by their stable identifiers."""

    version: str
    scenarios: dict[ScenarioId, ScenarioFixture]


def _showcase_root() -> Path:
    """Return the repository or packaged root containing accepted fixtures.

    Returns:
        The configured root, or the repository root for local development.

    Side effects:
        Reads ``FCA_SHOWCASE_ROOT`` from the process environment.
    """
    override = os.getenv("FCA_SHOWCASE_ROOT", "").strip()
    return Path(override) if override else _REPOSITORY_ROOT


def load_fixture_packet(root: Path | None = None) -> FixturePacket:
    """Load and validate the accepted synthetic S01–S08 showcase packet.

    Args:
        root: Optional root used by tests or packaged deployments. It must
            contain ``fixtures/s01-s08/scenarios.v1.json``.

    Returns:
        Immutable packet metadata and scenario objects for API-only use.

    Raises:
        ShowcaseRuntimeUnavailable: If the file, acceptance metadata, scenario
            coverage, evidence, or safety boundary is missing or malformed.

    Side effects:
        Reads one committed, synthetic JSON fixture file.
    """
    path = (root or _showcase_root()) / _FIXTURE_PATH
    try:
        document = json.loads(path.read_text(encoding="utf-8"))
        if (
            document["version"] not in _ACCEPTED_VERSIONS
            or document["status"] != "accepted"
            or document["contract_status"] != "accepted-showcase-fixtures"
            or document["runtime_consumption"] != "allowed-by-showcase-runtime-only"
            or document["source_class"] != "synthetic"
            or document["contains_customer_data"] is not False
        ):
            raise ValueError("fixture acceptance metadata does not match ADR-016")

        # A packet that touched a provider (ADR-018/019) must say so and name
        # exactly the sandbox boundary; one that has not must claim neither.
        contains_provider_data = document["contains_provider_data"]
        provider_data_environment = document.get("provider_data_environment")
        if contains_provider_data is True:
            if provider_data_environment != _SANDBOX_ENVIRONMENT_LABEL:
                raise ValueError("provider data must be labelled as sandbox-only")
        elif contains_provider_data is False:
            if provider_data_environment is not None:
                raise ValueError(
                    "no provider data was declared, but an environment was"
                )
        else:
            raise ValueError("contains_provider_data must be a boolean")

        raw_scenarios = document["scenarios"]
        if [item["scenario_id"] for item in raw_scenarios] != list(_EXPECTED_SCENARIOS):
            raise ValueError("fixture packet must contain ordered S01-S08 coverage")

        scenarios: dict[ScenarioId, ScenarioFixture] = {}
        for item in raw_scenarios:
            boundary = item["expected_boundary"]
            if (
                boundary["model_score"] is not None
                or boundary["payment_action"] != "none"
            ):
                raise ValueError("showcase fixtures cannot contain scores or actions")
            scenario_id: ScenarioId = item["scenario_id"]
            investigation = item.get("investigation_fixture") or {}
            raw_evidence = investigation.get("tool_evidence", {})

            # Evidence is parsed through the accepted field constraints before
            # a tool can return it to the graph or public event stream.
            evidence = {
                tool_name: tuple(EvidenceItem.model_validate(value) for value in values)
                for tool_name, values in raw_evidence.items()
            }
            scenarios[scenario_id] = ScenarioFixture(
                scenario_id=scenario_id,
                facts=dict(item["facts"]),
                expected_boundary=dict(boundary),
                recorded_tool_sequence=tuple(
                    investigation.get("recorded_tool_sequence", [])
                ),
                tool_evidence=evidence,
            )
        return FixturePacket(version=document["version"], scenarios=scenarios)
    except (
        OSError,
        KeyError,
        TypeError,
        ValueError,
        json.JSONDecodeError,
        ValidationError,
    ) as error:
        raise ShowcaseRuntimeUnavailable(
            "accepted public-showcase fixtures are unavailable"
        ) from error
