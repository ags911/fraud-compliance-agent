"""Safety-boundary tests for record metadata exposed to the console."""

from server.records import _sanitise_record


def test_sanitise_record_omits_reasoning_inputs_and_signature() -> None:
    """Only display metadata crosses the current demo SSE boundary."""
    result = _sanitise_record(
        {
            "record_id": "record-1",
            "schema_version": "AARF-0.2",
            "agent_id": "agent-1",
            "action_type": "DECISION",
            "policy_reference": [{"policy_id": "p", "version": "v1"}],
            "human_oversight_status": "AUTOMATED",
            "record_hash": "abc123",
            "signature": "sensitive-signature",
            "reasoning_chain": [{"description": "hidden"}],
            "input_context": {"account_id": "sensitive"},
            "customer_reference": "sensitive-customer",
        }
    )

    assert result == {
        "record_id": "record-1",
        "schema_version": "AARF-0.2",
        "agent_id": "agent-1",
        "action_type": "DECISION",
        "policy_reference": [{"policy_id": "p", "version": "v1"}],
        "human_oversight_status": "AUTOMATED",
        "record_hash": "abc123",
        "signature_present": True,
        "verification_status": "not_performed",
    }
