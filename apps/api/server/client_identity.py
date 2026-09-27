"""Derive an in-memory client identity from an explicitly trusted proxy chain."""

import os

from fastapi import Request


def trusted_proxy_hops() -> int:
    """Read how many right-most X-Forwarded-For addresses are trusted proxies.

    Returns:
        A non-negative proxy-hop count. Zero keeps the local socket-peer
        identity and ignores forwarded headers.

    Raises:
        RuntimeError: If the configured value is not a non-negative integer.

    Side effects:
        Reads ``SHOWCASE_TRUSTED_PROXY_HOPS`` from the process environment.
    """
    raw = os.getenv("SHOWCASE_TRUSTED_PROXY_HOPS", "0")
    try:
        value = int(raw)
    except ValueError as error:
        raise RuntimeError(
            "SHOWCASE_TRUSTED_PROXY_HOPS must be a non-negative integer"
        ) from error
    if value < 0:
        raise RuntimeError("SHOWCASE_TRUSTED_PROXY_HOPS must be a non-negative integer")
    return value


def client_identity(request: Request, *, proxy_hops: int | None = None) -> str:
    """Return a server-derived client address without trusting caller-supplied hops.

    Args:
        request: Incoming FastAPI request with socket peer and optional ingress
            ``X-Forwarded-For`` chain.
        proxy_hops: Number of trusted right-most proxy addresses. When omitted,
            reads ``SHOWCASE_TRUSTED_PROXY_HOPS``.

    Returns:
        The address immediately before the trusted proxy chain, or the socket
        peer when forwarding is disabled or malformed.

    Raises:
        RuntimeError: If ``proxy_hops`` is negative or its environment setting
            is invalid.

    Side effects:
        Reads request headers and process configuration only. The returned
        identity is for in-memory admission/rate limiting and is never logged
        or persisted.

    Assumptions:
        Azure Container Apps ingress appends the source address it observed to
        ``X-Forwarded-For``. Staging must confirm this before setting a non-zero
        hop count.
    """
    hops = trusted_proxy_hops() if proxy_hops is None else proxy_hops
    if hops < 0:
        raise RuntimeError("SHOWCASE_TRUSTED_PROXY_HOPS must be a non-negative integer")
    fallback = request.client.host if request.client else "unknown"
    if hops == 0:
        return fallback
    forwarded = request.headers.get("X-Forwarded-For", "")
    addresses = [value.strip() for value in forwarded.split(",") if value.strip()]
    # A configured hop count makes the right-most appended address trustworthy;
    # earlier caller-supplied values remain outside the trusted suffix.
    if len(addresses) < hops:
        return fallback
    return addresses[-hops]
