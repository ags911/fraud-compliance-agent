"""Validate the six proposed canonical domain schemas and review fixtures.

These tests exercise contract-only artifacts. Passing them proves structural
agreement with a proposal; it does not accept the schemas, approve a data
source, release a model, or authorise runtime consumption.
"""

import json

from jsonschema import Draft202012Validator, FormatChecker

SCHEMA_PATH = "docs/proposals/schemas/canonical-domain.v0.proposed.schema.json"
VALID_PATH = "fixtures/contracts/canonical-domain.v0.proposed.valid.json"
INVALID_PATH = "fixtures/contracts/canonical-domain.v0.proposed.invalid.json"
ENTITY_NAMES = {
    "SourceEvent",
    "CanonicalTransaction",
    "FeatureSnapshot",
    "Prediction",
    "RunContext",
    "OutcomeLabel",
}


def _load_json(repository_root, relative_path: str) -> dict:
    """Load one repository-owned, non-sensitive JSON contract artifact."""
    return json.loads((repository_root / relative_path).read_text(encoding="utf-8"))


def test_the_proposed_schema_is_well_formed_and_non_runtime(repository_root) -> None:
    """The schema is valid Draft 2020-12 and cannot look accepted or runtime-ready."""
    schema = _load_json(repository_root, SCHEMA_PATH)

    Draft202012Validator.check_schema(schema)
    assert schema["x-approval-status"] == "proposed"
    assert schema["x-runtime-consumption"] == "forbidden"
    assert set(schema["$defs"]) == ENTITY_NAMES


def test_every_valid_entity_fixture_matches_its_proposed_schema(
    repository_root,
) -> None:
    """One sanitised synthetic example validates for each proposed entity."""
    schema = _load_json(repository_root, SCHEMA_PATH)
    fixtures = _load_json(repository_root, VALID_PATH)

    assert set(fixtures) == ENTITY_NAMES
    for entity_name, instance in fixtures.items():
        validator = Draft202012Validator(
            schema["$defs"][entity_name], format_checker=FormatChecker()
        )
        assert list(validator.iter_errors(instance)) == []


def test_every_invalid_fixture_fails_for_its_declared_reason(repository_root) -> None:
    """Each entity has a negative case that falsifies a named contract invariant."""
    schema = _load_json(repository_root, SCHEMA_PATH)
    cases = _load_json(repository_root, INVALID_PATH)["cases"]

    assert {case["entity"] for case in cases} == ENTITY_NAMES
    for case in cases:
        validator = Draft202012Validator(
            schema["$defs"][case["entity"]], format_checker=FormatChecker()
        )
        errors = list(validator.iter_errors(case["instance"]))
        assert errors, case["case_id"]
        assert case["expected_keyword"] in {error.validator for error in errors}


def test_prediction_schema_separates_recommendation_from_action(
    repository_root,
) -> None:
    """A prediction may recommend only PASS, CHALLENGE, or HOLD—not RELEASE."""
    schema = _load_json(repository_root, SCHEMA_PATH)
    recommendation = schema["$defs"]["Prediction"]["properties"]["recommendation"]

    assert recommendation["enum"] == ["PASS", "CHALLENGE", "HOLD"]
