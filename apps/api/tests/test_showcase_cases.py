"""Durable showcase cases (spec 0002): capture, stream pass through and shapes.

These tests need no database. Real recorded showcase streams are run through
the case wrapper against an in memory store, so the frozen stream and the
captured case are both checked from what the API actually emits.
"""

import asyncio
import base64
import json
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from jsonschema import Draft202012Validator

from server.main import create_app
from server.showcase_cases.capture import (
    MAX_CASES_PER_BROWSER,
    RETENTION,
    CapturedEvent,
    CaseCaptureError,
    CaseRecord,
    EventValidator,
    build_case,
)
from server.showcase_cases.repository import (
    InvalidCursor,
    _summary,
    decode_cursor,
    empty_totals,
    encode_cursor,
)
from server.showcase_cases.settings import load_case_settings, valid_browser_id
from server.showcase_cases.stream import CaseRecorder, record_case_stream

BROWSER_ID = "3f2b8c1e-9a4d-4b6e-8f0a-1c2d3e4f5a6b"
PROPOSED_SCHEMA = "docs/proposals/schemas/showcase-cases.v0.proposed.schema.json"
EVENTS_SCHEMA = "docs/contracts/public-showcase-events.v1.schema.json"


class MemoryStore:
    """Record saved cases instead of writing to PostgreSQL."""

    def __init__(self, fail: bool = False) -> None:
        self.saved: list[tuple[CaseRecord, str]] = []
        self.fail = fail

    def save_case(self, record: CaseRecord, browser_id: str) -> None:
        if self.fail:
            raise RuntimeError("database unavailable")
        self.saved.append((record, browser_id))


class TickingClock:
    """Return a new, later time on every call, so ordering is observable."""

    def __init__(self) -> None:
        self.now = datetime(2026, 9, 24, 12, 0, tzinfo=UTC)

    def __call__(self) -> datetime:
        self.now += timedelta(milliseconds=5)
        return self.now


@pytest.fixture(scope="module")
def validator(repository_root: Path) -> EventValidator:
    return EventValidator(repository_root / EVENTS_SCHEMA)


def _frames(scenario_id: str) -> list[str]:
    """Return one recorded run's SSE output split into frames as yielded."""
    response = TestClient(create_app()).post(
        "/showcase/investigations",
        json={"scenario_id": scenario_id, "execution_mode": "recorded"},
    )
    assert response.status_code == 200
    return [chunk + "\n\n" for chunk in response.text.split("\n\n") if chunk]


async def _iterate(frames: list[str]):
    for frame in frames:
        yield frame


def _run(
    frames: list[str], recorder: CaseRecorder | None, browser_id: str | None
) -> list[str]:
    async def collect() -> list[str]:
        return [
            frame
            async for frame in record_case_stream(
                _iterate(frames), browser_id=browser_id, recorder=recorder
            )
        ]

    return asyncio.run(collect())


def _captured(frames: list[str]) -> list[CapturedEvent]:
    clock = TickingClock()
    return [
        CapturedEvent(payload=json.loads(frame[len("data: ") :]), recorded_at=clock())
        for frame in frames
        if frame.startswith("data: ")
    ]


@pytest.mark.parametrize("scenario_id", ["S01", "S02", "S03", "S04", "S05"])
def test_every_completed_run_is_captured_and_the_stream_is_unchanged(
    scenario_id: str, validator: EventValidator
) -> None:
    """AC-1, AC-2: the frames pass through verbatim and one full case is saved."""
    frames = _frames(scenario_id)
    store = MemoryStore()
    output = _run(frames, CaseRecorder(store, validator, TickingClock()), BROWSER_ID)

    assert output == frames
    assert output[-1] == "event: done\ndata: {}\n\n"
    assert len(store.saved) == 1
    record, browser_id = store.saved[0]
    payloads = [
        json.loads(frame[len("data: ") :])
        for frame in frames
        if frame.startswith("data: ")
    ]
    assert browser_id == BROWSER_ID
    assert record.case_id == payloads[0]["run_id"]
    assert record.scenario_id == scenario_id
    assert [event.payload for event in record.events] == payloads
    assert record.event_count == len(payloads)
    assert record.recommendation == payloads[-1]["recommendation"]
    assert record.authority_status == "not_evaluated"
    assert record.expires_at == record.completed_at + RETENTION
    assert record.started_at < record.completed_at


def test_s04_counts_come_from_its_tool_events(validator: EventValidator) -> None:
    """Value sourcing: tool calls, evidence items and fixture version."""
    record = build_case(_captured(_frames("S04")), validator)

    assert record.deterministic_route == "INVESTIGATE"
    assert record.investigation_status == "complete"
    assert record.tool_call_count == 2
    assert record.evidence_count == 2
    assert record.fixture_version is not None
    assert record.failure_reason is None


def test_s05_is_stored_as_an_incomplete_fail_safe_case(
    validator: EventValidator,
) -> None:
    """AC-12 precondition: the failure path keeps its reason and fail safe basis."""
    record = build_case(_captured(_frames("S05")), validator)

    assert record.investigation_status == "incomplete"
    assert record.recommendation == "HOLD"
    assert record.recommendation_basis == "fail_safe"
    assert record.failure_reason is not None


def test_skipped_investigations_have_no_evidence(validator: EventValidator) -> None:
    """Deterministic routes store a short case with no evidence or fixture."""
    record = build_case(_captured(_frames("S01")), validator)

    assert record.investigation_status == "skipped"
    assert record.evidence_count == 0
    assert record.fixture_version is None


def test_no_browser_id_or_no_recorder_stores_nothing(validator: EventValidator) -> None:
    """AC-3: without a valid ID, or with storage off, the run is untouched."""
    frames = _frames("S01")
    store = MemoryStore()

    assert _run(frames, CaseRecorder(store, validator), None) == frames
    assert _run(frames, None, BROWSER_ID) == frames
    assert store.saved == []


def test_a_storage_failure_never_changes_the_stream(validator: EventValidator) -> None:
    """AC-4: the database raising still yields every frame, including done."""
    frames = _frames("S04")
    output = _run(frames, CaseRecorder(MemoryStore(fail=True), validator), BROWSER_ID)

    assert output == frames


def test_a_run_without_run_result_is_not_stored(validator: EventValidator) -> None:
    """AC-5: a stream cut short before run_result saves no case."""
    frames = _frames("S04")
    truncated = [frame for frame in frames if '"event":"run_result"' not in frame]
    store = MemoryStore()

    assert _run(truncated, CaseRecorder(store, validator), BROWSER_ID) == truncated
    assert store.saved == []


def test_an_event_outside_the_contract_is_rejected(validator: EventValidator) -> None:
    """AC-16: validation failure means no case."""
    events = _captured(_frames("S01"))
    events[0].payload["unexpected"] = True

    with pytest.raises(CaseCaptureError):
        build_case(events, validator)


def test_mixed_runs_and_mode_disagreement_are_rejected(
    validator: EventValidator,
) -> None:
    """A case holds exactly one run, whose start and result agree on mode."""
    one, other = _captured(_frames("S01")), _captured(_frames("S01"))
    with pytest.raises(CaseCaptureError):
        build_case([*one, other[0]], validator)

    events = _captured(_frames("S01"))
    events[-1].payload["execution_mode"] = "live"
    with pytest.raises(CaseCaptureError):
        build_case(events, validator)


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        (BROWSER_ID, BROWSER_ID),
        (f"  {BROWSER_ID} ", BROWSER_ID),
        (BROWSER_ID.upper(), None),
        ("3f2b8c1e-9a4d-1b6e-8f0a-1c2d3e4f5a6b", None),
        ("not-a-uuid", None),
        ("", None),
        (None, None),
    ],
)
def test_only_lowercase_version_4_browser_ids_are_accepted(value, expected) -> None:
    """AC-3, AC-17: the scoping key has one accepted form."""
    assert valid_browser_id(value) == expected


def test_case_storage_is_off_unless_explicitly_enabled(monkeypatch) -> None:
    """AC-15: a database URL alone never switches storage on."""
    monkeypatch.setenv("DATABASE_URL", "postgresql://example/db")
    monkeypatch.delenv("SHOWCASE_CASES_ENABLED", raising=False)
    assert load_case_settings().ready is False

    monkeypatch.setenv("SHOWCASE_CASES_ENABLED", "true")
    assert load_case_settings().ready is True

    monkeypatch.delenv("DATABASE_URL")
    assert load_case_settings().ready is False


def test_cursor_round_trips_and_rejects_garbage() -> None:
    """AC-6: the paging cursor encodes a position and fails loudly when bad."""
    position = datetime(2026, 9, 24, 12, 0, 0, 123456, tzinfo=UTC)
    assert decode_cursor(encode_cursor(position, "run_abc")) == (position, "run_abc")

    garbage = base64.urlsafe_b64encode(b"not a cursor").decode("ascii").rstrip("=")
    no_zone = base64.urlsafe_b64encode(b"2026-09-24T12:00:00|run_abc").decode("ascii")
    for bad in ["", "!!!", "abc@def", garbage, no_zone.rstrip("=")]:
        with pytest.raises(InvalidCursor):
            decode_cursor(bad)


def _row(record: CaseRecord) -> dict:
    return {column: getattr(record, column) for column in record.__dataclass_fields__}


def test_read_shapes_match_the_proposed_contract(
    repository_root: Path, validator: EventValidator
) -> None:
    """AC-6, AC-7: summaries, totals and details validate against the draft schema."""
    schema = json.loads((repository_root / PROPOSED_SCHEMA).read_text(encoding="utf-8"))
    proposed = Draft202012Validator(schema)
    defs = schema["$defs"]
    record = build_case(_captured(_frames("S04")), validator)
    summary = _summary(_row(record))

    list_response = {
        "contract_version": "1.0",
        "items": [summary],
        "next_cursor": None,
        "totals": empty_totals(),
    }
    detail_response = {
        "contract_version": "1.0",
        "case": summary,
        "events": [
            {
                "sequence": event.sequence,
                "event_id": event.payload["event_id"],
                "event_type": event.payload["event"],
                "recorded_at": event.recorded_at.isoformat(),
                "payload": event.payload,
            }
            for event in record.events
        ],
    }
    error_response = {
        "detail": {"code": "case_not_found", "message": "Case not found."}
    }

    for response, definition in [
        (list_response, "caseListResponse"),
        (detail_response, "caseDetailResponse"),
        (error_response, "errorResponse"),
    ]:
        Draft202012Validator({**defs[definition], "$defs": defs}).validate(response)
        proposed.validate(response)
    assert "browser_id" not in summary


def test_proposed_contract_is_not_presented_as_accepted(repository_root: Path) -> None:
    """The draft stays a proposal until an ADR accepts it."""
    schema = json.loads((repository_root / PROPOSED_SCHEMA).read_text(encoding="utf-8"))

    assert schema["x-approval-status"] == "proposed"
    assert not (
        repository_root / "docs/contracts/showcase-cases.v1.schema.json"
    ).exists()


def test_migration_is_rerunnable_and_bounded(repository_root: Path) -> None:
    """The runner re-applies every file, so each statement must be IF NOT EXISTS."""
    sql = (repository_root / "apps/api/migrations/0004_showcase_cases.sql").read_text(
        encoding="utf-8"
    )
    statements = [line for line in sql.splitlines() if line.startswith("CREATE ")]

    assert statements
    assert all("IF NOT EXISTS" in line for line in statements)
    assert "ON DELETE CASCADE" in sql
    assert MAX_CASES_PER_BROWSER == 50


# ---- Routes and stream wiring (spec 0002 slice 1) ---------------------------


class InMemoryCaseRepository:
    """Stand in for PsycopgCaseRepository with the same scoping rules."""

    def __init__(self, database_url: str) -> None:
        self.cases: dict[str, tuple[CaseRecord, str]] = {}

    def save_case(self, record: CaseRecord, browser_id: str) -> None:
        self.cases[record.case_id] = (record, browser_id)

    def get_case(self, browser_id: str, case_id: str) -> dict:
        from server.showcase_cases.repository import CaseNotFound

        stored = self.cases.get(case_id)
        if stored is None or stored[1] != browser_id:
            raise CaseNotFound(case_id)
        record = stored[0]
        return {
            "contract_version": "1.0",
            "case": _summary(_row(record)),
            "events": [
                {
                    "sequence": event.sequence,
                    "event_id": event.payload["event_id"],
                    "event_type": event.payload["event"],
                    "recorded_at": event.recorded_at.isoformat(),
                    "payload": event.payload,
                }
                for event in record.events
            ],
        }


@pytest.fixture
def cases_enabled(monkeypatch):
    """Create the app with case storage on and an in memory repository."""
    import server.main as main

    monkeypatch.setenv("SHOWCASE_CASES_ENABLED", "true")
    monkeypatch.setenv("DATABASE_URL", "postgresql://example/db")
    repositories: list[InMemoryCaseRepository] = []

    def build(database_url: str) -> InMemoryCaseRepository:
        repository = InMemoryCaseRepository(database_url)
        repositories.append(repository)
        return repository

    monkeypatch.setattr(main, "PsycopgCaseRepository", build)
    client = TestClient(main.create_app())
    return client, repositories[0]


def _run_through_api(client: TestClient, scenario_id: str, browser_id: str | None):
    headers = {"X-Showcase-Browser-Id": browser_id} if browser_id else {}
    return client.post(
        "/showcase/investigations",
        json={"scenario_id": scenario_id, "execution_mode": "recorded"},
        headers=headers,
    )


def _shape(text: str) -> list:
    """Frames with run specific IDs removed, to compare two runs' streams."""
    shaped = []
    for chunk in text.split("\n\n"):
        if chunk.startswith("data: "):
            payload = json.loads(chunk[len("data: ") :])
            shaped.append(
                {k: v for k, v in payload.items() if k not in {"run_id", "event_id"}}
            )
        elif chunk:
            shaped.append(chunk)
    return shaped


def test_a_run_with_a_browser_key_is_saved_and_readable(cases_enabled) -> None:
    """AC-1, AC-7: the API saves the run, and the same browser reads it back."""
    client, repository = cases_enabled
    response = _run_through_api(client, "S04", BROWSER_ID)
    run_id = json.loads(response.text.split("\n\n")[0][len("data: ") :])["run_id"]

    assert response.status_code == 200
    assert list(repository.cases) == [run_id]
    detail = client.get(
        f"/cases/{run_id}", headers={"X-Showcase-Browser-Id": BROWSER_ID}
    )
    assert detail.status_code == 200
    body = detail.json()
    assert body["case"]["case_id"] == run_id
    assert [event["event_type"] for event in body["events"]][-1] == "run_result"
    assert "browser_id" not in body["case"]


def test_the_stream_is_identical_with_and_without_storage(cases_enabled) -> None:
    """AC-2: saving adds no event and changes no field or order."""
    client, _ = cases_enabled
    saved = _run_through_api(client, "S04", BROWSER_ID)
    unsaved = _run_through_api(TestClient(create_app()), "S04", None)

    assert _shape(saved.text) == _shape(unsaved.text)


def test_a_malformed_browser_key_runs_normally_and_is_not_saved(cases_enabled) -> None:
    """AC-3: the frozen endpoint never rejects a caller for a bad key."""
    client, repository = cases_enabled
    response = _run_through_api(client, "S01", "not-a-uuid")

    assert response.status_code == 200
    assert response.text.endswith("event: done\ndata: {}\n\n")
    assert repository.cases == {}


def test_case_reads_are_scoped_and_reveal_nothing(cases_enabled) -> None:
    """AC-7: another browser, a missing case and a malformed ID get one 404."""
    client, _ = cases_enabled
    response = _run_through_api(client, "S01", BROWSER_ID)
    run_id = json.loads(response.text.split("\n\n")[0][len("data: ") :])["run_id"]
    other = "7c9e6679-7425-40de-944b-e07fc1f90ae7"

    for case_id, browser in [
        (run_id, other),
        ("run_missing123", BROWSER_ID),
        ("DROP TABLE", BROWSER_ID),
    ]:
        reply = client.get(
            f"/cases/{case_id}", headers={"X-Showcase-Browser-Id": browser}
        )
        assert reply.status_code == 404
        assert reply.json() == {
            "detail": {"code": "case_not_found", "message": "Case not found."}
        }


def test_case_errors_follow_the_fixed_order(cases_enabled, monkeypatch) -> None:
    """Error order: storage off (503) before a bad key (400)."""
    client, _ = cases_enabled
    missing_key = client.get("/cases/run_missing123")
    assert missing_key.status_code == 400
    assert missing_key.json()["detail"]["code"] == "invalid_browser_id"

    monkeypatch.delenv("SHOWCASE_CASES_ENABLED")
    disabled = TestClient(create_app()).get("/cases/run_missing123")
    assert disabled.status_code == 503
    assert disabled.json()["detail"]["code"] == "cases_unavailable"


def test_storage_off_means_no_repository_is_ever_built(monkeypatch) -> None:
    """AC-15: with the flag unset, no database client is created at all."""
    import server.main as main

    monkeypatch.delenv("SHOWCASE_CASES_ENABLED", raising=False)
    monkeypatch.setenv("DATABASE_URL", "postgresql://example/db")

    def forbidden(database_url: str) -> None:
        raise AssertionError("case storage must stay off")

    monkeypatch.setattr(main, "PsycopgCaseRepository", forbidden)
    response = _run_through_api(TestClient(main.create_app()), "S01", BROWSER_ID)
    assert response.status_code == 200


# ---- GET /cases (spec 0002 slice 2) -----------------------------------------


class ListingCaseRepository(InMemoryCaseRepository):
    """Adds list_cases with the real paging, filter and totals rules."""

    def list_cases(
        self,
        browser_id,
        *,
        limit=20,
        cursor=None,
        scenario_id=None,
        recommendation=None,
    ):
        from server.showcase_cases.repository import (
            CasePage,
            _summary,
            decode_cursor,
            empty_totals,
            encode_cursor,
        )

        position = decode_cursor(cursor) if cursor else None
        mine = sorted(
            (record for record, owner in self.cases.values() if owner == browser_id),
            key=lambda record: (record.completed_at, record.case_id),
            reverse=True,
        )
        totals = empty_totals()
        for record in mine:
            totals["total"] += 1
            totals["by_recommendation"][record.recommendation] += 1
            totals["by_scenario"][record.scenario_id][record.recommendation] += 1
            totals["deterministic_passes"] += record.deterministic_route == "PASS"
            totals["fail_safe_holds"] += record.recommendation_basis == "fail_safe"
            totals["completed_investigations"] += (
                record.investigation_status == "complete"
            )
        rows = [
            record
            for record in mine
            if (not scenario_id or record.scenario_id == scenario_id)
            and (not recommendation or record.recommendation == recommendation)
            and (not position or (record.completed_at, record.case_id) < position)
        ][: limit + 1]
        page = rows[:limit]
        next_cursor = (
            encode_cursor(page[-1].completed_at, page[-1].case_id)
            if len(rows) > limit
            else None
        )
        return CasePage(
            [_summary(_row(record)) for record in page], next_cursor, totals
        )


@pytest.fixture
def listing_cases(monkeypatch):
    import server.main as main

    monkeypatch.setenv("SHOWCASE_CASES_ENABLED", "true")
    monkeypatch.setenv("DATABASE_URL", "postgresql://example/db")
    repositories: list[ListingCaseRepository] = []

    def build(database_url: str) -> ListingCaseRepository:
        repositories.append(ListingCaseRepository(database_url))
        return repositories[-1]

    monkeypatch.setattr(main, "PsycopgCaseRepository", build)
    return TestClient(main.create_app()), repositories[0]


def _key(browser_id: str = BROWSER_ID) -> dict[str, str]:
    return {"X-Showcase-Browser-Id": browser_id}


def test_list_returns_this_browsers_cases_newest_first_with_totals(
    listing_cases, repository_root: Path
) -> None:
    """AC-6: scoped, newest first, totals over everything, valid against the draft."""
    client, _ = listing_cases
    for scenario in ["S01", "S04", "S05"]:
        _run_through_api(client, scenario, BROWSER_ID)
    _run_through_api(client, "S02", "7c9e6679-7425-40de-944b-e07fc1f90ae7")

    reply = client.get("/cases", headers=_key())
    body = reply.json()
    schema = json.loads((repository_root / PROPOSED_SCHEMA).read_text(encoding="utf-8"))
    Draft202012Validator(
        {**schema["$defs"]["caseListResponse"], "$defs": schema["$defs"]}
    ).validate(body)

    assert reply.status_code == 200
    assert [item["scenario_id"] for item in body["items"]] == ["S05", "S04", "S01"]
    assert body["next_cursor"] is None
    assert body["totals"]["total"] == 3
    assert body["totals"]["by_scenario"]["S02"] == {
        "PASS": 0,
        "CHALLENGE": 0,
        "HOLD": 0,
    }
    assert body["totals"]["fail_safe_holds"] == 1
    assert body["totals"]["deterministic_passes"] == 1


def test_list_pages_and_filters_without_changing_totals(listing_cases) -> None:
    """AC-6: 20 per page, a cursor for the rest, filters leave totals alone."""
    client, _ = listing_cases
    for _ in range(21):
        _run_through_api(client, "S01", BROWSER_ID)
    _run_through_api(client, "S04", BROWSER_ID)

    first = client.get("/cases", headers=_key()).json()
    second = client.get(
        "/cases", params={"cursor": first["next_cursor"]}, headers=_key()
    ).json()
    filtered = client.get(
        "/cases",
        params={"scenario_id": "S04", "recommendation": "CHALLENGE"},
        headers=_key(),
    ).json()

    assert len(first["items"]) == 20
    assert len(second["items"]) == 2
    assert second["next_cursor"] is None
    assert {item["case_id"] for item in first["items"]}.isdisjoint(
        item["case_id"] for item in second["items"]
    )
    assert [item["scenario_id"] for item in filtered["items"]] == ["S04"]
    assert filtered["totals"]["total"] == 22


@pytest.mark.parametrize(
    ("params", "code"),
    [
        ({"cursor": "abc@def"}, "invalid_cursor"),
        ({"limit": "0"}, "invalid_parameters"),
        ({"limit": "21"}, "invalid_parameters"),
        ({"limit": "ten"}, "invalid_parameters"),
        ({"scenario_id": "S09"}, "invalid_parameters"),
        ({"recommendation": "RELEASE"}, "invalid_parameters"),
    ],
)
def test_list_rejects_bad_parameters_without_echoing_them(
    listing_cases, params, code
) -> None:
    """Bad cursor 400, other bad parameters 422, never echoing the input."""
    client, _ = listing_cases
    reply = client.get("/cases", params=params, headers=_key())

    assert reply.status_code == (400 if code == "invalid_cursor" else 422)
    assert reply.json()["detail"]["code"] == code
    for value in params.values():
        assert value not in reply.text


def test_list_error_order_puts_storage_and_key_before_parameters(
    listing_cases, monkeypatch
) -> None:
    """503 first, then 400 for the key, then parameter errors."""
    client, _ = listing_cases
    assert (
        client.get("/cases", params={"limit": "ten"}).json()["detail"]["code"]
        == "invalid_browser_id"
    )

    monkeypatch.delenv("SHOWCASE_CASES_ENABLED")
    disabled = TestClient(create_app()).get("/cases", params={"limit": "ten"})
    assert disabled.status_code == 503
    assert disabled.json()["detail"]["code"] == "cases_unavailable"
