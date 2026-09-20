"""Load accepted process-local safeguards for the optional live showcase."""

import json
import os
from dataclasses import dataclass
from pathlib import Path

from server.showcase_investigation.errors import ShowcaseRuntimeUnavailable

_REPOSITORY_ROOT = Path(__file__).resolve().parents[4]
_CONFIG_PATH = Path("config/public-showcase-investigation.v1.json")


@dataclass(frozen=True)
class LiveLimits:
    """Hold accepted process-local admission and timeout limits."""

    maximum_concurrent: int
    maximum_per_client: int
    per_client_window_seconds: int
    maximum_per_process_window: int
    maximum_window_seconds: int
    timeout_seconds: int


@dataclass(frozen=True)
class ShowcaseSettings:
    """Hold accepted limits and operator-controlled provider configuration."""

    live_enabled: bool
    groq_api_key: str | None
    groq_model: str | None
    groq_allowed_models: tuple[str, ...]
    limits: LiveLimits

    @property
    def provider_ready(self) -> bool:
        """Return whether a secret and allowlisted model permit a live call."""
        return bool(
            self.groq_api_key
            and self.groq_model
            and self.groq_model in self.groq_allowed_models
        )


def _explicit_boolean(name: str, default: bool = False) -> bool:
    """Parse one explicit operator boolean without accepting ambiguous text.

    Args:
        name: Environment-variable name.
        default: Safe value used when the variable is absent.

    Returns:
        Parsed boolean value.

    Raises:
        ShowcaseRuntimeUnavailable: If a configured value is not explicit.

    Side effects:
        Reads one environment variable.
    """
    raw = os.getenv(name)
    if raw is None:
        return default
    normalised = raw.strip().lower()
    if normalised in {"1", "true", "yes", "on"}:
        return True
    if normalised in {"0", "false", "no", "off"}:
        return False
    raise ShowcaseRuntimeUnavailable(f"{name} must be true or false")


def load_settings(root: Path | None = None) -> ShowcaseSettings:
    """Load accepted limits and server-side live-provider settings.

    Args:
        root: Optional repository/package root containing the accepted config.

    Returns:
        Validated process-local limits plus secret-backed operator settings.

    Raises:
        ShowcaseRuntimeUnavailable: If accepted configuration is absent or
            malformed. A missing provider key/model does not fail startup; it
            keeps live execution unavailable and recorded playback active.

    Side effects:
        Reads one committed JSON file and four process environment variables.
    """
    override = os.getenv("FCA_SHOWCASE_ROOT", "").strip()
    base = root or (Path(override) if override else _REPOSITORY_ROOT)
    try:
        document = json.loads((base / _CONFIG_PATH).read_text(encoding="utf-8"))
        if (
            document["schema_version"] != "1.0"
            or document["status"] != "accepted"
            or document["runtime_consumption"] != "allowed"
        ):
            raise ValueError("showcase safeguard configuration is not accepted")
        live = document["live_mode"]
        client = live["per_observed_client"]
        process = live["per_process_enablement_window"]
        limits = LiveLimits(
            maximum_concurrent=int(live["maximum_concurrent_investigations"]),
            maximum_per_client=int(client["maximum_investigations"]),
            per_client_window_seconds=int(client["window_seconds"]),
            maximum_per_process_window=int(process["maximum_investigations"]),
            maximum_window_seconds=int(process["maximum_duration_seconds"]),
            timeout_seconds=int(live["overall_investigation_timeout_seconds"]),
        )
        if min(limits.__dict__.values()) <= 0:
            raise ValueError("showcase limits must be positive")
    except (OSError, KeyError, TypeError, ValueError, json.JSONDecodeError) as error:
        raise ShowcaseRuntimeUnavailable(
            "accepted public-showcase configuration is unavailable"
        ) from error

    # The model has no repository default: an operator must explicitly select
    # it from an explicit server-side allowlist before live work can begin.
    allowed_models = tuple(
        value.strip()
        for value in os.getenv("SHOWCASE_GROQ_ALLOWED_MODELS", "").split(",")
        if value.strip()
    )
    return ShowcaseSettings(
        live_enabled=_explicit_boolean("SHOWCASE_LIVE_ENABLED", False),
        groq_api_key=os.getenv("GROQ_API_KEY") or None,
        groq_model=os.getenv("SHOWCASE_GROQ_MODEL") or None,
        groq_allowed_models=allowed_models,
        limits=limits,
    )
