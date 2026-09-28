"""Load and evaluate a pinned XGBoost JSON booster with only the stdlib."""

from __future__ import annotations

import functools
import hashlib
import importlib.resources
import json
import logging
import math
import struct
from dataclasses import dataclass
from typing import Any

from server.sandbox_model.features import FEATURE_NAMES, model_input_sha256

logger = logging.getLogger(__name__)
MODEL_FILE = "model.json"
MANIFEST_FILE = "manifest.json"
# These exact bytes are the ADR-024 reviewed artifact, not values supplied by
# a manifest. A swapped pair therefore fails closed before it can be scored.
MODEL_SHA256 = "8fb7909ad5192993eabbffd6e014ffb95626af0457a6c9aefc48bdfe3afcb576"
MANIFEST_SHA256 = "411a4aadbcc2a98d73fe9d383f0f2ae9f4eba6d1281570db8f25027fb57f532d"


def _float32(value: float) -> float:
    """Round one comparison operand to XGBoost's float32 representation."""
    return struct.unpack("f", struct.pack("f", value))[0]


def _base_score(raw: Any) -> float:
    """Parse XGBoost's scalar or bracketed base score as a raw margin.

    XGBoost JSON stores a logistic classifier's base score as a probability;
    the tree walker sums raw margins, so that probability is converted to its
    logit before adding leaves.
    """
    text = str(raw).strip().strip("[]").split(",")[0]
    value = float(text)
    if 0 < value < 1:
        return math.log(value / (1 - value))
    return value


@dataclass(frozen=True)
class PortableModel:
    """Evaluate one verified display-only booster and its Platt calibration."""

    booster: dict[str, Any]
    model_version: str
    platt_a: float
    platt_b: float

    def score(self, values: tuple[float | None, ...]) -> tuple[float, str]:
        """Return the calibrated display score and its canonical input digest.

        Args:
            values: ADR-024's eight ordered values; ``None`` takes a missing
                branch and is never substituted with an invented value.

        Returns:
            A score in zero-to-one range and the vector's SHA-256 digest.

        Raises:
            ValueError: If the supplied vector does not match the artifact.

        Side effects:
            None. The score is evidence only and never selects a route.
        """
        if len(values) != len(FEATURE_NAMES):
            raise ValueError("portable model vector has an unexpected feature count")
        margin = _base_score(
            self.booster["learner"]["learner_model_param"]["base_score"]
        )
        trees = self.booster["learner"]["gradient_booster"]["model"]["trees"]
        for tree in trees:
            node = 0
            while True:
                left = tree["left_children"][node]
                if left == -1:
                    margin += float(tree["split_conditions"][node])
                    break
                index = tree["split_indices"][node]
                value = values[index]
                if value is None or (isinstance(value, float) and math.isnan(value)):
                    node = (
                        left
                        if tree["default_left"][node]
                        else tree["right_children"][node]
                    )
                elif _float32(value) < _float32(tree["split_conditions"][node]):
                    node = left
                else:
                    node = tree["right_children"][node]
        calibrated = 1 / (1 + math.exp(-(self.platt_a * margin + self.platt_b)))
        return calibrated, model_input_sha256(values)


def load_portable_model() -> PortableModel | None:
    """Load exactly the packaged model and manifest, otherwise safely disable scoring.

    Returns:
        The verified display-only model, or ``None`` if files are absent,
        malformed, or disagree. Startup intentionally remains available.

    Side effects:
        Reads package resources and emits one fixed warning category on failure.
    """
    try:
        package = importlib.resources.files("server.sandbox_model")
        model_raw = package.joinpath(MODEL_FILE).read_bytes()
        manifest_raw = package.joinpath(MANIFEST_FILE).read_bytes()
        manifest = json.loads(manifest_raw)
        if tuple(manifest["feature_order"]) != FEATURE_NAMES:
            raise ValueError("feature order differs")
        if hashlib.sha256(model_raw).hexdigest() != MODEL_SHA256:
            raise ValueError("model digest differs")
        if hashlib.sha256(manifest_raw).hexdigest() != MANIFEST_SHA256:
            raise ValueError("manifest file digest differs")
        if manifest["model_sha256"] != MODEL_SHA256:
            raise ValueError("manifest model digest differs")
        # The manifest records a digest of its canonical content excluding this
        # self-referential field, so its own verification remains deterministic.
        unsigned_manifest = dict(manifest)
        expected_manifest_hash = unsigned_manifest.pop("manifest_sha256")
        if (
            hashlib.sha256(
                json.dumps(
                    unsigned_manifest, sort_keys=True, separators=(",", ":")
                ).encode()
            ).hexdigest()
            != expected_manifest_hash
        ):
            raise ValueError("manifest digest differs")
        return PortableModel(
            booster=json.loads(model_raw),
            model_version=str(manifest["model_version"]),
            platt_a=float(manifest["platt"]["a"]),
            platt_b=float(manifest["platt"]["b"]),
        )
    except (KeyError, OSError, TypeError, ValueError, json.JSONDecodeError):
        logger.warning("sandbox_portable_model_unavailable")
        return None


@functools.cache
def portable_model() -> PortableModel | None:
    """Return the packaged model, loaded and verified once per process.

    Returns:
        The same verified model on every call, or ``None`` for the whole process
        when the artifact is missing or does not match its pinned digests.

    Side effects:
        The first call reads and hashes the package files and, on failure, logs
        one fixed warning; later calls reuse that result (spec 0004 AC-12).
    """
    return load_portable_model()
