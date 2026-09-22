"""Guard accepted showcase fixtures and the separate proposed F3 ADR packet.

The S01–S08 packet is accepted synthetic showcase input. These tests preserve
its exact safety boundary without treating it as provider data, model output,
operational F3 behavior, or a payment instruction.
"""

import json

FIXTURE_PATH = "fixtures/s01-s08/scenarios.v1.json"
# The ADRs are archived, historical-only records superseded by context/, but
# the packet's own approval_reference (below) still names one by its archived
# path, and these proposed ones must still visibly say so, forever.
ADR_ROOT = "docs/archive/apps/api/docs/adr"
ADR_PATHS = [
    f"{ADR_ROOT}/0001-application-sdk-package-boundary.md",
    f"{ADR_ROOT}/0002-canonical-domain-contract.md",
    f"{ADR_ROOT}/0003-plaid-mapping-feature-feasibility.md",
    f"{ADR_ROOT}/0004-fraud-target-corpus.md",
    f"{ADR_ROOT}/0005-model-artifact-evaluation-contract.md",
    f"{ADR_ROOT}/0006-router-authority-oversight.md",
    f"{ADR_ROOT}/0007-telemetry-signed-evidence.md",
    f"{ADR_ROOT}/0008-inventory-oversight-pack-linkage.md",
    f"{ADR_ROOT}/0009-postgresql-transitions-recovery.md",
    f"{ADR_ROOT}/0010-identity-roles-deployment.md",
    f"{ADR_ROOT}/0011-operational-acceptance-versioning.md",
]


def test_the_f3_packet_covers_each_target_scenario_once(repository_root) -> None:
    """The accepted packet contains exactly S01–S08 with no legacy mapping."""
    packet = json.loads((repository_root / FIXTURE_PATH).read_text(encoding="utf-8"))
    scenarios = packet["scenarios"]

    assert [scenario["scenario_id"] for scenario in scenarios] == [
        "S01",
        "S02",
        "S03",
        "S04",
        "S05",
        "S06",
        "S07",
        "S08",
    ]
    assert all(scenario["legacy_scenario_mapping"] is None for scenario in scenarios)


def test_the_phase_zero_adr_packet_exists_but_remains_proposed(repository_root) -> None:
    """ADR-001–011 are review drafts and cannot look approved by preparation alone."""
    for relative_path in ADR_PATHS:
        text = (repository_root / relative_path).read_text(encoding="utf-8")
        assert "Status: Proposed" in text
        assert "Approval: pending" in text


def test_showcase_fixtures_are_accepted_and_label_their_plaid_sandbox_facts(
    repository_root,
) -> None:
    """Allow runtime use without mistaking fixtures for real customer data.

    ADR-018/019 accept one Plaid-Sandbox-derived evidence item (S04's
    account-activity tool), so the packet honestly says it now touched a
    provider, while still asserting it is sandbox test data, never a
    customer.
    """
    packet = json.loads((repository_root / FIXTURE_PATH).read_text(encoding="utf-8"))

    assert packet["version"] == "1.1"
    assert packet["status"] == "accepted"
    assert packet["source_class"] == "synthetic"
    assert packet["contract_status"] == "accepted-showcase-fixtures"
    assert packet["runtime_consumption"] == "allowed-by-showcase-runtime-only"
    assert packet["contains_provider_data"] is True
    assert packet["provider_data_environment"] == "plaid_sandbox_test_only"
    assert packet["contains_customer_data"] is False
    assert packet["contract_references"] == [
        "docs/contracts/public-showcase-api.v1.openapi.json",
        "docs/contracts/public-showcase-events.v1.schema.json",
    ]
    assert packet["approval_reference"] == (
        "apps/api/docs/adr/0016-accept-public-showcase-scenario-fixtures.md"
    )


def test_legacy_relationships_are_characterised_but_not_approved(
    repository_root,
) -> None:
    """A–F relationships remain explicit candidates, never silent target mappings."""
    packet = json.loads((repository_root / FIXTURE_PATH).read_text(encoding="utf-8"))
    relationships = packet["legacy_candidate_relationships"]

    assert [item["legacy_id"] for item in relationships] == list("ABCDEF")
    assert all(
        "not-approved" in item["status"] for item in relationships if item["target_ids"]
    )


def test_showcase_fixtures_contain_no_score_or_payment_action(repository_root) -> None:
    """Accepted scenarios specify invariants without model output or action."""
    packet = json.loads((repository_root / FIXTURE_PATH).read_text(encoding="utf-8"))

    assert packet["mvp3_runtime_model_policy"] == (
        "deferred-to-f3a-no-score-or-threshold"
    )
    for scenario in packet["scenarios"]:
        assert scenario["expected_boundary"]["model_score"] is None
        assert scenario["expected_boundary"]["payment_action"] == "none"
        assert scenario["expected_boundary"]["simulated_only"] is True


def test_public_investigation_eligibility_matches_adr_014(repository_root) -> None:
    """Keep S04/S05 agent eligibility and every explicit bypass reviewable."""
    packet = json.loads((repository_root / FIXTURE_PATH).read_text(encoding="utf-8"))
    scenarios = {item["scenario_id"]: item for item in packet["scenarios"]}

    assert scenarios["S04"]["expected_boundary"]["investigation_eligibility"] == (
        "eligible"
    )
    assert scenarios["S05"]["expected_boundary"]["investigation_eligibility"] == (
        "eligible-failure-test"
    )
    for scenario_id in ("S01", "S02", "S03", "S06", "S07", "S08"):
        assert scenarios[scenario_id]["expected_boundary"][
            "investigation_eligibility"
        ].startswith("skipped")


def test_showcase_scenarios_preserve_visible_agent_boundaries(repository_root) -> None:
    """Require a non-trivial S04, deterministic S05, and immutable S06 input."""
    packet = json.loads((repository_root / FIXTURE_PATH).read_text(encoding="utf-8"))
    scenarios = {item["scenario_id"]: item for item in packet["scenarios"]}

    approved_tools = [
        "get_payee_evidence",
        "get_account_activity_evidence",
        "get_device_session_evidence",
    ]
    assert packet["mvp3_agent_tool_allowlist"] == approved_tools
    assert packet["mvp3_agent_tool_budget"] == {
        "maximum_total_calls": 3,
        "maximum_calls_per_tool": 1,
        "limit_exhaustion_state": "incomplete-investigation-no-action",
    }
    assert packet["mvp3_agent_failure_contract"] == {
        "investigation_status": "incomplete",
        "recommendation": "HOLD",
        "recommendation_basis": "fail_safe",
        "authority_status": "not_evaluated",
        "simulated_action": "none",
        "stable_reason_codes": [
            "provider_unavailable",
            "tool_failed",
            "invalid_output",
            "timeout",
            "tool_budget_exhausted",
        ],
    }
    assert scenarios["S04"]["expected_boundary"]["allowed_agent_tools"] == (
        approved_tools
    )
    assert (
        scenarios["S04"]["expected_boundary"]["minimum_distinct_read_only_tool_calls"]
        >= 2
    )
    assert scenarios["S05"]["expected_boundary"]["failure_injection"] == (
        "deterministic-provider-unavailable"
    )
    assert scenarios["S05"]["expected_boundary"]["failure_reason"] == (
        "provider_unavailable"
    )
    assert scenarios["S05"]["expected_boundary"]["external_provider_call"] == (
        "forbidden-for-this-fixture"
    )

    # S06 consumes an immutable recorded prerequisite; it never invokes the
    # agent merely to manufacture state for a future review-conflict test.
    upstream = scenarios["S06"]["facts"]["upstream_recommendation_snapshot"]
    assert upstream == {
        "source_scenario_id": "S04",
        "execution_mode": "recorded",
        "snapshot_status": "required-not-yet-specified",
        "immutable": True,
    }


def test_s04_recorded_playback_stays_the_originally_accepted_two_tools(
    repository_root,
) -> None:
    """ADR-016's recorded script is unchanged by ADR-018/019's live-only addition."""
    packet = json.loads((repository_root / FIXTURE_PATH).read_text(encoding="utf-8"))
    scenarios = {item["scenario_id"]: item for item in packet["scenarios"]}
    investigation = scenarios["S04"]["investigation_fixture"]

    assert investigation["recorded_tool_sequence"] == [
        "get_payee_evidence",
        "get_device_session_evidence",
    ]
    recorded_evidence = [
        item
        for tool_name in investigation["recorded_tool_sequence"]
        for item in investigation["tool_evidence"][tool_name]
    ]
    assert {item["evidence_id"] for item in recorded_evidence} == {
        "ev_payee_relationship",
        "ev_device_familiarity",
    }
    assert all(
        item["source_class"] == "synthetic_fixture" for item in recorded_evidence
    )
    assert all(item["fixture_version"] == "s04-r1" for item in recorded_evidence)


def test_s04_account_activity_evidence_is_plaid_sandbox_derived_and_labelled(
    repository_root,
) -> None:
    """ADR-018/019 add a third, live-only tool's evidence, clearly labelled."""
    packet = json.loads((repository_root / FIXTURE_PATH).read_text(encoding="utf-8"))
    scenarios = {item["scenario_id"]: item for item in packet["scenarios"]}
    investigation = scenarios["S04"]["investigation_fixture"]

    assert set(investigation["tool_evidence"]) == {
        "get_payee_evidence",
        "get_device_session_evidence",
        "get_account_activity_evidence",
    }
    account_activity = investigation["tool_evidence"]["get_account_activity_evidence"]
    assert all(
        item["source_class"] == "plaid_sandbox_derived" for item in account_activity
    )
    assert all("Plaid Sandbox" in item["display_value"] for item in account_activity)
    # It is available for a live agent to choose, but the recorded script above
    # never calls it, so it never appears in recorded_tool_sequence.
    assert (
        "get_account_activity_evidence" not in investigation["recorded_tool_sequence"]
    )


def test_operational_scenarios_remain_deferred_despite_accepted_facts(
    repository_root,
) -> None:
    """Do not imply review, idempotency or replay exists in the MVP 3 runtime."""
    packet = json.loads((repository_root / FIXTURE_PATH).read_text(encoding="utf-8"))
    scope = packet["mvp3_runtime_scope"]

    assert scope["scenario_value_status"] == "accepted-synthetic"
    assert scope["public_investigation_ready"] == [
        "S01",
        "S02",
        "S03",
        "S04",
        "S05",
    ]
    assert scope["deferred_operational_behavior"] == ["S06", "S07", "S08"]


def test_correction_retry_and_review_scenarios_keep_their_safety_invariants(
    repository_root,
) -> None:
    """Accepted facts preserve deferred conflict, idempotency, and replay limits."""
    packet = json.loads((repository_root / FIXTURE_PATH).read_text(encoding="utf-8"))
    scenarios = {item["scenario_id"]: item for item in packet["scenarios"]}

    assert scenarios["S06"]["expected_boundary"]["invariant"] == (
        "stale-review-version-is-rejected"
    )
    assert scenarios["S07"]["expected_boundary"]["invariant"] == (
        "same-idempotency-key-never-creates-a-second-run-or-action"
    )
    assert scenarios["S08"]["expected_boundary"]["invariant"] == (
        "correction-creates-a-new-revision-and-replay-never-executes-an-action"
    )
