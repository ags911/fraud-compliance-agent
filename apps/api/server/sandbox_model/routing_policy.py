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
        policy_version: Identifier stored on every payment the policy assessed.
        model_version: Packaged model version required to apply the policy.
        challenge: Score that raises a rule PASS to CHALLENGE.
        hold: Score that raises a rule PASS to HOLD.
    """

    policy_version: str
    model_version: str
    challenge: float
    hold: float


def _policy_path() -> Path:
    """Return the shipped policy file: under ``FCA_SHOWCASE_ROOT`` in the image,
    else the repository's ``config/``. Neither path is caller input."""
    root = os.getenv("FCA_SHOWCASE_ROOT", "").strip()
    base = Path(root) if root else Path(__file__).resolve().parents[4]
    return base / "config" / POLICY_FILE


def load_score_routing_policy(
    model: PortableModel | None,
    path: Path | None = None,
) -> ScoreRoutingPolicy | None:
    """Load the pinned generated policy only when it matches the verified model.

    Args:
        model: The verified portable scorer, or ``None`` when it is not loaded.
        path: The policy file; the shipped file when omitted (tests pass one).

    Returns:
        A verified immutable policy, or ``None`` so callers keep the
        deterministic spec 0004 route.

    Side effects:
        Reads the policy file and logs ``sandbox_score_routing_unavailable``
        when the policy itself is missing, invalid, tampered or for another
        model. A missing model returns ``None`` silently: the model loader has
        already logged its own warning (spec 0010 AC-4).
    """
    if model is None:
        return None
    try:
        raw = (path or _policy_path()).read_bytes()
        if hashlib.sha256(raw).hexdigest() != POLICY_SHA256:
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
            policy.model_version != model.model_version
            or not 0 <= policy.challenge < policy.hold <= 1
        ):
            raise ValueError("policy does not match model")
        return policy
    except (KeyError, OSError, TypeError, ValueError):
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
    return load_score_routing_policy(portable_model())


def policy_for_version(version: str | None) -> ScoreRoutingPolicy | None:
    """Return the shipped policy a stored ``routing_policy_version`` names.

    Every published policy version stays shipped (spec 0010), so a saved case
    can always state the thresholds its payment was routed by. Only
    ``score-routing-v1`` exists today.

    Returns:
        The matching verified policy, or ``None`` when that version is not
        loaded (the caller then keeps no case rather than an unexplained one).
    """
    policy = score_routing_policy()
    if policy is None or policy.policy_version != version:
        return None
    return policy


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
