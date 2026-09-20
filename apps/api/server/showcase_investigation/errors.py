"""Stable internal failures for the bounded showcase investigation."""


class ShowcaseRuntimeUnavailable(RuntimeError):
    """Signal that accepted runtime inputs cannot be loaded safely."""


class ProviderUnavailable(RuntimeError):
    """Signal that the optional live provider cannot complete a request."""


class InvalidProviderOutput(RuntimeError):
    """Signal that provider output does not match the accepted safe shape."""


class ToolExecutionFailed(RuntimeError):
    """Signal that an allowlisted tool has no accepted evidence result."""
