"""Guard the candidate public-showcase live-access limits against drift.

The candidate remains non-runtime configuration. These checks preserve the
product owner's bounded demonstration-window decision without claiming durable
quota enforcement or deployment readiness.
"""

import json

CONFIG_PATH = "config/public-showcase-investigation.candidate.json"


def test_candidate_live_mode_defaults_off_and_falls_back(repository_root) -> None:
    """Keep recorded playback public while candidate live access defaults off."""
    config = json.loads((repository_root / CONFIG_PATH).read_text(encoding="utf-8"))

    assert config["status"] == "candidate"
    assert config["runtime_consumption"] == "forbidden"
    assert config["recorded_playback"] == {
        "continuously_public": True,
        "fallback_when_live_unavailable": True,
        "label": "recorded",
    }
    assert config["live_mode"]["enabled_by_default"] is False
    assert config["live_mode"]["enablement"] == "server_side_operator_kill_switch"
    assert config["live_mode"]["limit_outcome"] == "labelled_recorded_playback"


def test_candidate_controlled_window_uses_the_approved_limits(repository_root) -> None:
    """Fix the initial concurrency, client, window, ceiling and timeout values."""
    config = json.loads((repository_root / CONFIG_PATH).read_text(encoding="utf-8"))
    live = config["live_mode"]

    assert live["maximum_concurrent_investigations"] == 1
    assert live["per_observed_client"] == {
        "maximum_investigations": 2,
        "window_seconds": 600,
        "client_key_boundary": "trusted_ingress_metadata_only",
    }
    assert live["per_process_enablement_window"] == {
        "maximum_investigations": 10,
        "maximum_duration_seconds": 1800,
        "durability": "process_local_resets_on_restart",
    }
    assert live["overall_investigation_timeout_seconds"] == 45


def test_candidate_rejects_always_on_anonymous_live_mode(repository_root) -> None:
    """Require durable or provider-side cost control before always-on live access."""
    config = json.loads((repository_root / CONFIG_PATH).read_text(encoding="utf-8"))

    assert config["always_on_anonymous_live_mode"] == {
        "allowed": False,
        "required_before_enablement": (
            "reliable_provider_spending_limit_or_durable_distributed_quota"
        ),
    }


def test_candidate_provider_policy_is_server_side_and_traceable(
    repository_root,
) -> None:
    """Require one configured provider and traceable model identity per live run."""
    config = json.loads((repository_root / CONFIG_PATH).read_text(encoding="utf-8"))
    provider = config["provider_policy"]

    assert provider["live_provider"] == "groq"
    assert provider["credential_boundary"] == "server_side_secret_only"
    assert provider["model_selection"] == "server_side_allowlisted_configuration"
    assert provider["model_identifier_required"] is True
    assert provider["record_provider_and_model_with_run"] is True
    assert provider["output_boundary"] == "validated_structured_output_only"


def test_candidate_provider_policy_has_no_second_llm_or_raw_logging(
    repository_root,
) -> None:
    """Keep failures redacted and route unavailable live runs to playback."""
    config = json.loads((repository_root / CONFIG_PATH).read_text(encoding="utf-8"))
    provider = config["provider_policy"]

    assert provider["alternate_llm_fallback"] == "forbidden"
    assert provider["unavailable_outcome"] == "labelled_recorded_playback"
    assert provider["public_error_boundary"] == "stable_redacted_reason_code_only"
    assert provider["raw_prompt_logging"] is False
    assert provider["raw_provider_output_logging"] is False
    assert provider["hidden_reasoning_logging"] is False
    assert provider["record_boundary"] == "validated_contract_fields_only_ephemeral"


def test_candidate_migration_keeps_legacy_local_until_all_gates_pass(
    repository_root,
) -> None:
    """Require contract, runtime, browser and image evidence before cutover."""
    config = json.loads((repository_root / CONFIG_PATH).read_text(encoding="utf-8"))
    migration = config["migration_policy"]

    assert migration["legacy_private_sdk_pipeline"] == (
        "local_only_compatibility_reference"
    )
    assert migration["public_runtime_dependency"] == "forbidden"
    assert migration["coexistence_until"] == [
        "accepted_s01_s08_contracts",
        "public_runtime_evaluations_pass",
        "browser_acceptance_pass",
        "public_container_boundary_pass",
    ]
    assert migration["cutover_requires_explicit_decision"] is True


def test_candidate_retirement_removes_active_dependency_but_preserves_evidence(
    repository_root,
) -> None:
    """Retire active legacy code without deleting its reviewable history."""
    config = json.loads((repository_root / CONFIG_PATH).read_text(encoding="utf-8"))
    retirement = config["migration_policy"]["retirement"]

    assert retirement == {
        "remove_from_active_application": True,
        "remove_from_active_dependency_path": True,
        "preserve_characterisation_documents": True,
        "preserve_git_history": True,
    }
