"""Exercise opt-in guards required before a public showcase database is enabled."""

from fastapi import Request

from server.client_identity import client_identity
from server.public_database_guards import ClientWindowLimiter


def _request(headers: dict[str, str]) -> Request:
    """Build one request with a deterministic socket peer for identity tests."""
    scope = {
        "type": "http",
        "headers": [
            (key.lower().encode(), value.encode()) for key, value in headers.items()
        ],
        "client": ("socket-peer", 1234),
    }
    return Request(scope)


def test_client_identity_selects_only_the_address_before_a_trusted_ingress() -> None:
    """Ignore a caller's left-most spoof when ingress appends the peer address."""
    request = _request({"X-Forwarded-For": "spoofed, visitor"})

    assert client_identity(request, proxy_hops=1) == "visitor"


def test_client_identity_falls_back_when_the_forwarded_chain_has_too_few_hops() -> None:
    """A caller-only forwarding header never replaces the socket peer."""
    request = _request({"X-Forwarded-For": "spoofed"})

    assert client_identity(request, proxy_hops=2) == "socket-peer"


def test_client_window_limiter_binds_minted_browser_ids_to_one_client_key() -> None:
    """A rate limit is keyed by server identity, not a browser-controlled value."""
    limiter = ClientWindowLimiter(2)

    assert limiter.allow("visitor") is True
    assert limiter.allow("visitor") is True
    assert limiter.allow("visitor") is False


def test_row_estimate_reads_tuple_and_dict_rows(monkeypatch) -> None:
    """The case repository's cursor returns tuples; the feed's returns dicts."""
    from server import public_database_guards as guards

    class Cursor:
        def __init__(self, row) -> None:
            self.row = row

        def execute(self, *_args) -> None:
            return None

        def fetchone(self):
            return self.row

    for relation, row in (
        ("tuple_table", (19_999,)),
        ("dict_table", {"estimated_rows": 19_999}),
    ):
        monkeypatch.setattr(guards, "_row_estimates", {})
        assert guards.table_has_capacity(Cursor(row), relation, 20_000) is True
        monkeypatch.setattr(guards, "_row_estimates", {})
        assert guards.table_has_capacity(Cursor(row), relation, 19_999) is False


def test_client_limiter_forgets_clients_whose_window_emptied() -> None:
    """Many one-off addresses must not grow the limiter's memory forever."""
    from server.public_database_guards import ClientWindowLimiter

    now = [0.0]
    limiter = ClientWindowLimiter(5, clock=lambda: now[0])
    for index in range(100):
        limiter.allow(f"client-{index}")
    now[0] = 61.0
    limiter.allow("late-client")

    assert set(limiter._requests) == {"late-client"}


def test_every_feed_case_status_is_allowed_by_the_migration(repository_root) -> None:
    """A status the CHECK constraint rejects would fail the reveal transaction."""
    import re

    migration = (
        repository_root / "apps/api/migrations/0006_feed_decisions.sql"
    ).read_text(encoding="utf-8")
    allowed = set(
        re.findall(r"'(\w+)'", re.search(r"case_status IN \(([^)]*)\)", migration)[1])
    )
    source = (repository_root / "apps/api/server/sandbox_data/service.py").read_text(
        encoding="utf-8"
    )
    written = set(re.findall(r'case_status = "(\w+)"', source))

    assert written and written <= allowed
