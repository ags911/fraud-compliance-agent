"""Validate the accepted public-showcase HTTP and SSE contract.

These tests make the accepted request, error, event, ordering, citation and
safety boundaries executable before and after runtime implementation.
"""

import copy
import json

from fastapi.testclient import TestClient
from jsonschema import Draft202012Validator

from server.main import create_app

OPENAPI_PATH = "docs/contracts/public-showcase-api.v1.openapi.json"
EVENTS_PATH = "docs/contracts/public-showcase-events.v1.schema.json"
EXAMPLES_PATH = "fixtures/contracts/public-showcase-api.v1.examples.json"


def _load_json(repository_root, relative_path: str) -> dict:
    """Load one repository-owned accepted contract or synthetic example.

    Args:
        repository_root: Pytest fixture pointing at the repository root.
        relative_path: Repository-relative path to a JSON object.

    Returns:
        Parsed JSON used only by contract-review tests.

    Side effects:
        Reads one committed repository file.
    """
    return json.loads((repository_root / relative_path).read_text(encoding="utf-8"))


def _openapi_component_schema(openapi: dict, component_name: str) -> dict:
    """Return one OpenAPI component as a standalone Draft 2020-12 schema.

    Args:
        openapi: Proposed OpenAPI 3.1 document with local component references.
        component_name: Name from ``components.schemas`` to validate.

    Returns:
        A deep copy whose local references resolve through ``$defs``.

    Side effects:
        None. The input OpenAPI object is not mutated.
    """
    components = copy.deepcopy(openapi["components"]["schemas"])

    # OpenAPI 3.1 uses JSON Schema but stores reusable definitions under its
    # components path, so translate those local references for standalone use.
    encoded = json.dumps(components).replace("#/components/schemas/", "#/$defs/")
    return {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "$defs": json.loads(encoded),
        "$ref": f"#/$defs/{component_name}",
    }


def _event_payloads(transcript: list[dict]) -> list[dict]:
    """Return non-terminal JSON payloads from one accepted SSE transcript.

    Args:
        transcript: Ordered decoded SSE data objects ending in ``{}``.

    Returns:
        All event payloads before the named terminal ``done`` event.

    Side effects:
        None.
    """
    return [event for event in transcript if event]


def test_accepted_http_contract_is_narrow_and_versioned(repository_root) -> None:
    """Expose one scenario-only stream without prompts, models or mutations."""
    openapi = _load_json(repository_root, OPENAPI_PATH)

    assert openapi["openapi"] == "3.1.0"
    assert openapi["info"]["x-contract-version"] == "1.0"
    assert openapi["info"]["x-approval-status"] == "accepted"
    assert openapi["info"]["x-runtime-consumption"] == "allowed"
    assert set(openapi["paths"]) == {"/showcase/investigations"}
    operation = openapi["paths"]["/showcase/investigations"]["post"]
    assert set(operation["responses"]) == {"200", "422", "503"}
    assert "text/event-stream" in operation["responses"]["200"]["content"]

    request = openapi["components"]["schemas"]["ShowcaseInvestigationRequest"]
    assert request["required"] == ["scenario_id", "execution_mode"]
    assert request["additionalProperties"] is False
    assert set(request["properties"]) == {"scenario_id", "execution_mode"}


def test_accepted_requests_and_http_errors_validate(repository_root) -> None:
    """Accept bounded requests and the two stable redacted HTTP errors."""
    openapi = _load_json(repository_root, OPENAPI_PATH)
    examples = _load_json(repository_root, EXAMPLES_PATH)
    request_validator = Draft202012Validator(
        _openapi_component_schema(openapi, "ShowcaseInvestigationRequest")
    )
    error_validator = Draft202012Validator(
        _openapi_component_schema(openapi, "ShowcaseError")
    )

    for request in examples["requests"].values():
        request_validator.validate(request)
    for error in examples["http_errors"].values():
        error_validator.validate(error)

    assert list(request_validator.iter_errors(examples["invalid"]["free_text_request"]))
    assert list(
        request_validator.iter_errors(examples["invalid"]["request_selected_model"])
    )


def test_accepted_event_schema_and_transcripts_are_valid(repository_root) -> None:
    """Validate each payload and require one ordered terminal result and done."""
    schema = _load_json(repository_root, EVENTS_PATH)
    examples = _load_json(repository_root, EXAMPLES_PATH)
    validator = Draft202012Validator(schema)

    Draft202012Validator.check_schema(schema)
    assert schema["x-contract-version"] == "1.0"
    assert schema["x-approval-status"] == "accepted"
    assert schema["x-runtime-consumption"] == "allowed"

    for transcript in examples["transcripts"].values():
        for event in transcript:
            validator.validate(event)

        # The named done event has `{}` data, appears once, and follows the one
        # run_result. This semantic ordering is intentionally stricter than the
        # shape-only JSON Schema.
        assert transcript[-1] == {}
        assert transcript.count({}) == 1
        payloads = _event_payloads(transcript)
        assert [event["sequence"] for event in payloads] == list(
            range(1, len(payloads) + 1)
        )
        assert sum(event["event"] == "run_result" for event in payloads) == 1
        assert payloads[-1]["event"] == "run_result"
        assert len({event["run_id"] for event in payloads}) == 1
        assert len({event["scenario_id"] for event in payloads}) == 1


def test_s04_transcript_obeys_tool_budget_and_same_run_citations(
    repository_root,
) -> None:
    """Require two distinct allowlisted tools and evidence-grounded claims."""
    examples = _load_json(repository_root, EXAMPLES_PATH)
    payloads = _event_payloads(examples["transcripts"]["s04_recorded_complete"])
    tool_calls = [event for event in payloads if event["event"] == "tool_call"]
    tool_results = [event for event in payloads if event["event"] == "tool_result"]
    investigation = next(
        event for event in payloads if event["event"] == "investigation_result"
    )

    called_names = [event["tool_name"] for event in tool_calls]
    assert 2 <= len(called_names) <= 3
    assert len(called_names) == len(set(called_names))
    assert {(event["call_index"], event["tool_name"]) for event in tool_calls} == {
        (event["call_index"], event["tool_name"]) for event in tool_results
    }

    returned_ids = {
        evidence["evidence_id"]
        for event in tool_results
        for evidence in event["evidence"]
    }
    cited_ids = {
        evidence_id
        for claim in investigation["claims"]
        for evidence_id in claim["evidence_ids"]
    }
    assert cited_ids <= returned_ids


def test_s05_is_a_no_provider_call_incomplete_failure(repository_root) -> None:
    """Keep the outage deterministic, incomplete and free of tool/provider work."""
    examples = _load_json(repository_root, EXAMPLES_PATH)
    payloads = _event_payloads(examples["transcripts"]["s05_recorded_outage"])
    investigation = next(
        event for event in payloads if event["event"] == "investigation_result"
    )

    assert not any(event["event"] in {"tool_call", "tool_result"} for event in payloads)
    assert investigation["investigation_status"] == "incomplete"
    assert investigation["recommendation"] == "HOLD"
    assert investigation["recommendation_basis"] == "fail_safe"
    assert investigation["failure_reason"] == "provider_unavailable"
    assert investigation["claims"] == []


def test_invalid_safety_events_fail_schema_validation(repository_root) -> None:
    """Reject score leakage and any failure presented as completed work."""
    schema = _load_json(repository_root, EVENTS_PATH)
    invalid = _load_json(repository_root, EXAMPLES_PATH)["invalid"]
    validator = Draft202012Validator(schema)

    assert list(validator.iter_errors(invalid["event_with_model_score"]))
    assert list(validator.iter_errors(invalid["incomplete_reported_as_complete"]))


def test_contract_contains_no_runtime_score_threshold_or_action(
    repository_root,
) -> None:
    """Keep model policy and payment authority outside the MVP 3 contract."""
    artifacts = [
        _load_json(repository_root, OPENAPI_PATH),
        _load_json(repository_root, EVENTS_PATH),
    ]
    contract_text = json.dumps(artifacts).lower()

    assert '"model_score"' not in contract_text
    assert '"threshold"' not in contract_text
    assert '"simulated_action": {"const": "none"}' in contract_text


def test_the_application_accepts_every_contract_request_value(repository_root) -> None:
    """Bind the accepted request enums to what the served route really accepts.

    The route is deliberately absent from the served OpenAPI document, so no
    schema-equality check covers it. This drives the real application with each
    contract-declared value instead: an accepted value never yields the
    ``invalid_request`` error, and a value outside the contract always does.
    """
    openapi = _load_json(repository_root, OPENAPI_PATH)
    request_schema = openapi["components"]["schemas"]["ShowcaseInvestigationRequest"]
    client = TestClient(create_app())

    for scenario_id in request_schema["properties"]["scenario_id"]["enum"]:
        for execution_mode in request_schema["properties"]["execution_mode"]["enum"]:
            response = client.post(
                "/showcase/investigations",
                json={"scenario_id": scenario_id, "execution_mode": execution_mode},
            )
            # Deferred S06-S08 answer with the contract's other declared status,
            # never by rejecting a value the accepted contract permits.
            assert response.status_code in {200, 503}, (
                f"{scenario_id}/{execution_mode} is in the accepted contract but "
                "the application refused it"
            )

    outside_contract = client.post(
        "/showcase/investigations",
        json={"scenario_id": "S04", "execution_mode": "streaming"},
    )
    assert outside_contract.status_code == 422


def test_the_application_errors_match_the_accepted_error_contract(
    repository_root,
) -> None:
    """Validate both served error bodies against the accepted error schema.

    Without this, the redacted envelope in the application and the one in the
    accepted contract could drift apart while both sides' own tests still pass.
    """
    openapi = _load_json(repository_root, OPENAPI_PATH)
    operation = openapi["paths"]["/showcase/investigations"]["post"]
    error_validator = Draft202012Validator(
        _openapi_component_schema(openapi, "ShowcaseError")
    )
    client = TestClient(create_app())

    served = {
        "422": client.post("/showcase/investigations", json={"scenario_id": "S04"}),
        "503": client.post(
            "/showcase/investigations",
            json={"scenario_id": "S06", "execution_mode": "recorded"},
        ),
    }

    for status_code, response in served.items():
        assert response.status_code == int(status_code)
        error_validator.validate(response.json())
        documented = operation["responses"][status_code]["content"]["application/json"][
            "example"
        ]
        assert response.json() == documented


def test_the_showcase_route_stays_out_of_the_frozen_demo_contract() -> None:
    """Pin the decision to keep the streaming route out of the served schema.

    ``docs/contracts/demo-api.v1.openapi.json`` is asserted as an exact match of
    the generated document, so publishing this route there would silently widen
    that frozen legacy contract. The route is described by its own accepted
    OpenAPI file and verified by the two conformance tests above instead.
    """
    assert "/showcase/investigations" not in create_app().openapi()["paths"]
