"""Load the ADR-025 score-routing policy without making it a runtime dependency."""

import functools
import hashlib
import json
import logging
import os
from dataclasses import dataclass
from pathlib import Path

from server.sandbox_model.scorer import PortableModel, portable_model

logger = logging.getLogger(__name__)
POLICY_FILE = "sandbox-score-routing.v1.json"
# Updated only when the generated, reviewed policy is intentionally replaced.
POLICY_SHA256 = "a6141f430702aed546dd95b7f31c7fd3bce6098016846f13f69ee035891f3867"


@dataclass(frozen=True)
class ScoreRoutingPolicy:
    """Represent verified thresholds derived from the Sparkov test partition.

    Attributes:
        policy_version: Immutable identifier stored with a routed payment.
        model_version: Packaged model version required to apply the policy.
        challenge: Score that raises a rule PASS to CHALLENGE.
        hold: Score that raises a rule PASS to HOLD.
    """

    policy_version: str
    model_version: str
    challenge: float
    hold: float


def load_score_routing_policy(
    model: PortableModel | None = None,
) -> ScoreRoutingPolicy | None:
    """Load the pinned generated policy only when it matches the verified model.

    Args:
        model: Verified portable scorer; omitted values load the process cache.

    Returns:
        A verified immutable policy, or ``None`` when policy/model verification
        fails so callers retain the deterministic spec-0004 route.

    Side effects:
        Reads a packaged configuration resource and emits a fixed warning on
        failure. It never changes a recommendation itself.
    """
    try:
        active_model = model if model is not None else portable_model()
        if active_model is None:
            raise ValueError("model unavailable")
        # Development reads the committed policy while the image supplies the
        # same file beneath FCA_SHOWCASE_ROOT; neither path is caller input.
        root = os.getenv("FCA_SHOWCASE_ROOT", "").strip()
        policy_path = (
            Path(root) / "config" / POLICY_FILE
            if root
            else Path(__file__).resolve().parents[4] / "config" / POLICY_FILE
        )
        raw = policy_path.read_bytes()
        if POLICY_SHA256 and hashlib.sha256(raw).hexdigest() != POLICY_SHA256:
            raise ValueError("policy digest differs")
        document = json.loads(raw)
        thresholds = document["thresholds"]
        policy = ScoreRoutingPolicy(
            policy_version=str(document["policy_version"]),
            model_version=str(document["model_version"]),
            challenge=float(thresholds["challenge"]["value"]),
            hold=float(thresholds["hold"]["value"]),
        )
        if (
            policy.model_version != active_model.model_version
            or not 0 <= policy.challenge < policy.hold <= 1
        ):
            raise ValueError("policy does not match model")
        return policy
    except (KeyError, OSError, TypeError, ValueError, json.JSONDecodeError):
        logger.warning("sandbox_score_routing_unavailable")
        return None


@functools.cache
def score_routing_policy() -> ScoreRoutingPolicy | None:
    """Return the policy loaded once per process, or deterministic fallback.

    Returns:
        The verified policy or ``None`` for the process lifetime.

    Side effects:
        The first lookup reads and validates the packaged generated policy.
    """
    return load_score_routing_policy()


def route_rule_pass(
    score: float | None, policy: ScoreRoutingPolicy | None
) -> str | None:
    """Return a score escalation for a rule PASS, never a lower recommendation.

    Args:
        score: Rounded portable-model score, if scoring succeeded.
        policy: Verified matching routing policy, if routing is enabled.

    Returns:
        ``HOLD``, ``CHALLENGE``, or ``None`` when no escalation is justified.
    """
    if score is None or policy is None:
        return None
    if score >= policy.hold:
        return "HOLD"
    if score >= policy.challenge:
        return "CHALLENGE"
    return None
