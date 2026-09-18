"""
Read back the real signed AARF record a pipeline node just wrote.

SimAResult/SimBResult/CounterfactualResult (the pipeline's own dataclasses)
don't carry schema_version/agent_id/reasoning_chain/signature — those live
only in the JSON file @_client.record() already wrote via JSONWriter, named
"..._{record_id[:8]}.json" (arbiris/writers/json_writer.py). This mirrors the
lookup shape in evidence_pack.py's _load_pipeline_records, scoped to one
record_id instead of a whole pipeline run's worth.
"""

import json
from pathlib import Path

OUTPUT_DIR = Path("examples/outputs/fraud_compliance_agent_v2")


def _sanitise_record(record: dict) -> dict:
    """Return the minimum signed-record metadata permitted in the demo stream.

    Args:
        record: Parsed local AARF record. It may contain sensitive input,
            reasoning, customer, and cryptographic-signature fields.

    Returns:
        A display-only metadata summary. Signature presence is reported, but
        cryptographic verification is explicitly not claimed or performed.

    Side effects:
        None. The source dictionary is not modified.
    """
    signature = record.get("signature") or record.get("cryptographic_signature")
    return {
        "record_id": record.get("record_id"),
        "schema_version": record.get("schema_version"),
        "agent_id": record.get("agent_id"),
        "action_type": record.get("action_type"),
        "policy_reference": record.get("policy_reference", []),
        "human_oversight_status": record.get("human_oversight_status"),
        "record_hash": record.get("record_hash"),
        "signature_present": bool(signature),
        "verification_status": "not_performed",
    }


def read_record(record_id: str) -> dict | None:
    """Read a local record and return only display-safe metadata.

    Args:
        record_id: Record identifier emitted by the in-process demo pipeline.

    Returns:
        Sanitised metadata for the matching record, or ``None`` when no valid
        JSON record can be found. Raw inputs, reasoning, customer references,
        and signature bytes are never returned.

    Side effects:
        Reads matching JSON files from the demo output directory.
    """
    if not OUTPUT_DIR.is_dir():
        return None
    short_id = record_id[:8]
    for json_file in OUTPUT_DIR.glob(f"*{short_id}.json"):
        if "evidence_pack" in json_file.name:
            continue
        try:
            record = json.loads(json_file.read_text())
            return _sanitise_record(record)
        except (OSError, json.JSONDecodeError):
            continue
    return None
