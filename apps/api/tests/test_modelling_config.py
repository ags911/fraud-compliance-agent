"""The versioned evaluation configuration is the only source of parameters.

A seed or hyperparameter that lives in a cell cannot be reviewed, so these tests
pin the committed configuration and the loader's refusal to invent a value.
"""

import json

import pytest

from modelling.config import (
    BASELINE_MODEL_ID,
    CANDIDATE_MODEL_ID,
    config_path,
    load_training_config,
)


@pytest.fixture
def document(repository_root) -> dict:
    """Return the committed configuration as a plain document."""
    return json.loads(config_path(repository_root).read_text(encoding="utf-8"))


def write_config(root, document: dict) -> None:
    """Write a configuration document into a temporary repository root."""
    destination = config_path(root)
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(document), encoding="utf-8")


def test_the_committed_configuration_loads(repository_root) -> None:
    """Every section the library needs is present and typed."""
    config = load_training_config(repository_root)

    assert config.config_version
    assert config.random_seed > 0
    assert config.baseline.max_iter > 0
    assert config.candidate.n_estimators > 0
    assert config.evaluation.reliability_bins > 0
    assert config.synthetic_fixture.rows > 0


def test_the_configuration_declares_its_scope_and_holds_no_policy_threshold(
    document,
) -> None:
    """It is an evaluation harness, not a policy or promotion artifact."""
    assert document["status"] == "accepted"
    assert "never read by the served API" in document["effective_scope"]
    assert "selects no operating threshold" in document["effective_scope"]
    assert "threshold" not in json.dumps(document["models"])


def test_a_missing_configuration_is_refused(tmp_path) -> None:
    """A run cannot fall back to built-in defaults."""
    with pytest.raises(RuntimeError, match="Missing evaluation configuration"):
        load_training_config(tmp_path)


def test_invalid_json_is_refused(tmp_path) -> None:
    """A half-edited file fails with a readable message, not a traceback."""
    config_path(tmp_path).parent.mkdir(parents=True)
    config_path(tmp_path).write_text("{not json", encoding="utf-8")

    with pytest.raises(RuntimeError, match="not valid JSON"):
        load_training_config(tmp_path)


def test_an_unsupported_schema_version_is_refused(tmp_path, document) -> None:
    """A future schema must not be read with today's assumptions."""
    write_config(tmp_path, {**document, "schema_version": "99.0"})

    with pytest.raises(RuntimeError, match="unsupported schema_version"):
        load_training_config(tmp_path)


@pytest.mark.parametrize("field", ["random_seed", "models", "evaluation"])
def test_a_missing_required_field_is_refused(tmp_path, document, field) -> None:
    """The loader names the missing field rather than guessing it."""
    incomplete = {key: value for key, value in document.items() if key != field}
    write_config(tmp_path, incomplete)

    with pytest.raises(RuntimeError, match=field):
        load_training_config(tmp_path)


@pytest.mark.parametrize("model_id", [BASELINE_MODEL_ID, CANDIDATE_MODEL_ID])
def test_a_missing_model_is_refused(tmp_path, document, model_id) -> None:
    """Both compared models must be configured for the comparison to mean anything."""
    models = {
        name: value for name, value in document["models"].items() if name != model_id
    }
    write_config(tmp_path, {**document, "models": models})

    with pytest.raises(RuntimeError, match=model_id):
        load_training_config(tmp_path)


def test_an_unknown_hyperparameter_is_refused(tmp_path, document) -> None:
    """A renamed or stray parameter fails loudly instead of being ignored."""
    models = dict(document["models"])
    models[CANDIDATE_MODEL_ID] = {**models[CANDIDATE_MODEL_ID], "max_dept": 3}
    write_config(tmp_path, {**document, "models": models})

    with pytest.raises(RuntimeError, match="expected configuration shape"):
        load_training_config(tmp_path)
