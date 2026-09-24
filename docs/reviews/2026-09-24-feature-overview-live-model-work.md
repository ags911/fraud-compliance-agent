# Review, feature/overview-live-model-work, 2026-09-24

**Reviewed by**: Claude Sonnet 5 (author on Claude Opus 5.5)
**Scope**: 19 files (16 tracked + 6 untracked, 1 deleted), uncommitted working tree vs `main`
**Verdict**: Approve with nits

## Summary

This is spec 0004 slices 1 and 2: every outbound live-feed payment is now decided by a server-side rule table at run start, revealed non-PASS payments become `feed`-origin cases through the existing `build_case`/`EventValidator` path, a new `/sandbox/scenarios/{id}/decisions` endpoint feeds a real "Recommendations over time" chart (replacing the deleted mock generator), and the Cases tab now polls during a live feed from any tab per the same-day AC-9 amendment. The Python side is careful: per-row reveal transactions, an explicit `ON CONFLICT DO NOTHING`, origin-scoped case caps in the same transaction as the insert, and a rerunnable migration with a test that checks it. One real bug: the new "quiet" Cases poll refetches only page 1 and unconditionally overwrites the full list, so a feed running while a user has clicked "Show more" silently drops the extra rows they already loaded. One data-integrity nit: `_reveal_event` discards `insert_case`'s success flag before recording `case_status = "saved"`. Both are pre-existing risk classes rather than novel design flaws, and the rest of the diff (docstrings, Pydantic strictness, parameterised SQL, reuse of spec 0002's storage/case shapes) matches AGENTS.md well.

## Major

### 🟠 Live-feed Cases poll discards already-loaded "Show more" pages, `apps/web/src/lib/useShowcaseCases.ts:40-65`
**Problem**: `pollQuietly()` (called every ~3s during a live feed from `RadarReference.tsx:1263-1271`, on any tab per the amended AC-9) bumps `poll`, which re-runs the same effect that answers the *first* fetch: `fetchShowcaseCases(filters, null, controller.signal)`. When it resolves, `setSettled({ key, state: { items: result.page.items, nextCursor: result.page.next_cursor, ... } })` unconditionally replaces the whole list with just the first `PAGE_SIZE` (20) items — it does not merge with, or preserve, any pages the user already pulled in via `loadMore`.
**Why it matters**: If a demo viewer opens the Cases tab, clicks "Show more" once or twice (easy once a busy S02 feed has produced its 20-case cap plus existing showcase cases), and a live feed is running anywhere in the app, the list will silently shrink back to 20 items within 3 seconds with no loading indicator — exactly the "quiet refetch" this code is meant to provide, except the row count visibly regresses instead of staying stable. This is likely to be hit live in the flagship demo flow the spec's AC-9 and AC-5 both describe (a busy S02 feed producing up to 20 feed cases).
**Suggested fix**: On a `poll` refetch, either only replace `items`/`totals` when `nextCursor` was previously `null` (i.e. the user hasn't paged), or merge the freshly fetched first page with any already-loaded pages beyond it (e.g. keep items whose `case_id` isn't in the new first page, or simply skip the poll refetch while `loadingMore`/`nextCursor` indicates more than one page is loaded).

## Minor

### 🟡 `_reveal_event` records `case_status = "saved"` without checking whether the insert actually happened, `apps/api/server/sandbox_data/service.py:284-288`
**Problem**: `PsycopgCaseRepository.insert_case(cursor, record, event["browser_id"])` returns `False` when its `ON CONFLICT (case_id) DO NOTHING` finds an existing row (i.e., nothing was written), but the caller ignores the return value and always proceeds to set `case_id, case_status = record.case_id, "saved"`.
**Why it matters**: In the normal path this is unreachable, because `case_id` is deterministic per `(run_id, sequence)` and the row is only processed once (`event["case_id"] is not None` already short-circuits a retried reveal, and `appended_at` gates against re-selecting the row at all). It would only matter on an actual `case_id` collision across runs (extremely unlikely, 48-bit run-UUID prefix) — and in that scenario the subsequent `UPDATE ... SET case_id = %s` against the table's `UNIQUE` `case_id` column (migration 0006) would itself raise a `psycopg.Error`, so the failure mode is "the whole sweep raises `SandboxDataUnavailable`," not "a silently wrong `case_status`." Still, the code asserts success it didn't verify.
**Suggested fix**: Check `insert_case`'s boolean return and fall back to a non-`"saved"` status (or skip the case pointer) when it is `False`, so the contract between the two functions is enforced rather than assumed.

## Nits

- ⚪ `apps/web/src/lib/useShowcaseCases.ts:63-65`, the `eslint-disable-next-line react-hooks/exhaustive-deps` comment still only explains `key`; it's worth a word on why `poll` is also safely omitted from the inner closure (it only triggers the effect, `key` supplies all the request inputs), since a future reader has to re-derive that.
- ⚪ `apps/api/server/sandbox_data/decisions.py:43-51`, the S04/S05 `"CHALLENGE"/"evidence_grounded"` and `"HOLD"/"fail_safe"` literals duplicate values that are also inlined in `showcase_investigation/runtime.py` (not imported from a shared constant) — this matches the codebase's existing scattered-literal convention there, so it's not a new pattern, just worth a shared constant if runtime.py's copy ever changes.

## Strengths

- The reveal path is genuinely careful about crash safety: each due event is claimed and revealed in its own `connection.transaction()`, the feed case is written in that same transaction via `ON CONFLICT (case_id) DO NOTHING`, and the migration's `case_id UNIQUE` plus the `event["case_id"] is not None` guard together make a re-run idempotent — matching the spec's "crash safety" acceptance criterion and backed by a dedicated test (`test_an_invalid_feed_case_raises_and_stores_nothing`, `test_a_payment_that_already_has_a_case_never_gets_another`).
- `migrations/0006_feed_decisions.sql` is genuinely rerunnable (`ADD COLUMN IF NOT EXISTS`, unconditional `DROP CONSTRAINT IF EXISTS` + `ADD CONSTRAINT`), and `test_feed_decisions.py::test_the_migration_is_rerunnable` statically enforces the pattern rather than just hoping it holds.
- Per-origin case caps (`MAX_CASES_BY_ORIGIN`) are trimmed inside the same transaction as the insert and scoped by `origin` in the `DELETE`, correctly satisfying AC-5's "a feed case never removes a Run showcase case" without a second round trip.

## Test coverage

Test signal is configured (pytest + Playwright), and coverage here is good: `apps/api/tests/test_feed_decisions.py` exercises the rule table, day-count aggregation, endpoint error codes, the feed case shape/IDs, and every reveal outcome (saved, PASS, storage-off, invalid, already-revealed, already-cased, pre-migration rows) via a scripted cursor — matching the spec's listed critical test scenarios for slices 1–2. `sandbox-feed.spec.ts` and `showcase-cases.spec.ts` cover the chart's real data, the Cases-tab poll firing and stopping, the cross-tab count update, and the feed case's "Live feed" pill / carried route copy / "Not scored yet" states. The one gap: nothing exercises `loadMore` (`useShowcaseCases`) together with a live-feed poll, which is exactly the path the Major finding above breaks — worth a test once that's fixed, to lock the fix in.

## Resolution (2026-09-24, after the review)

- 🟠 Major, fixed: `useShowcaseCases.ts` now folds a quiet poll's first page into the list on screen (`firstPageInto`), keeping rows already loaded with "Show more" and their cursor; it skips a poll result while a "Show more" request is in flight, dedupes rows a later "Show more" returns, and keeps the current list when one poll fails instead of switching to the fallback. Locked by the Playwright test "a feed's quiet refresh keeps the rows already loaded with Show more" (fails without the fix: 20 rows instead of 27).
- 🟡 Minor, fixed: `_reveal_event` marks a payment `saved` and links its case only when `insert_case` actually inserted; otherwise it records `invalid` and leaves `case_id` empty. Locked by `test_a_case_id_that_already_exists_is_not_claimed`.
- ⚪ Nit 1, fixed: the `exhaustive-deps` comment now explains why `poll` is safe.
- ⚪ Nit 2, left as is: the literals match the runtime's existing convention.

