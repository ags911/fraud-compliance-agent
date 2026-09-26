# 0005. Radar live feed on by default, status in the top bar

**Date**: 2026-09-24
**Status**: In Progress

## Summary

Radar's live feed starts by itself when the page loads and on each scenario change, so the Scenario tab looks like a realtime dashboard from the first moment. The top bar Live switch is the only control and the only status: a short word beside it says what the figures are ("Showing history", "25 / 200", "Finished · 200") and a tooltip on it explains more, including the fix when something fails. Switching Live off is remembered for this browser. The history cards and charts stay exactly as specs 0003 and 0004 define them, and the decisions API is unchanged from spec 0004.

## Amendments

**2026-09-24, first amendment.** The first build had a panel with its own Start, Stop, Retry and Start again buttons and a six slot strip of this run's counts. Seen in the browser it was too heavy, so it became one status line with only the counts that apply, and the top bar switch became the only control.

**2026-09-24, second amendment.** The engineer asked for the feed to be on by default so the page reads as a realtime dashboard, and for the status to move into the top bar to save space. With the feed on by default, the per run counts were judged not worth their space: the charts count up as payments land, the top bar shows progress, and saved cases appear in the Cases tab. So the Scenario tab line, its counts and the `run` block on the decisions API were removed. The reasons and fixes that AC-7 of the first build showed on the page now live in the switch's tooltip, which opens on hover and on keyboard focus; the top bar keeps a short visible word for every state. Spec 0003 was amended alongside: automatic starts are allowed, and the per browser start limit rose from 3 to 10 per rolling minute.

## Requirements

**User stories**:
- As a demo viewer opening Radar, I want the dashboard to be live straight away, so it looks and behaves like a realtime dashboard.
- As a demo viewer, I want to see at a glance whether the figures are live or history, without the page giving up space for it.
- As a demo viewer who wants a still page, I want switching Live off to stay off when I come back.
- As a developer running the demo locally, I want a failed start to say why and what to do.

**Acceptance criteria**:
- **AC-1**: For S01 to S05, the feed starts automatically when the page loads and each time the scenario changes, unless this browser switched Live off earlier; the switch then shows on. A start is requested once per load or scenario change, never twice for the same one.
- **AC-2**: The top bar Live switch is the only control. Switching it off stops the run and remembers "off" for this browser, so a reload or scenario change does not start a feed; switching it on clears that and starts a fresh run from the imported history. If this browser's storage is blocked, the default (on) applies.
- **AC-3**: The short status beside the switch reads: "Showing history" when no run is on; "Starting…" while starting; "n / m" while live; "Finished · n" or "Stopped · n" when a run ends. A tooltip on it, opened by hover or keyboard focus, explains the state: history ("The figures show this scenario's imported Sandbox history. Switch Live on to add simulated payments."), live ("Simulated payments added so far, one every 3 seconds, on top of the imported history. Saved cases appear in the Cases tab."), finished ("Payments added by the last feed. Switch Live on again to start a fresh run from the imported history.").
- **AC-4**: An automatic start that fails (busy, unavailable, or no browser ID) is quiet: the switch is off, the status reads "Showing history" with no warning colour, and the tooltip gives the reason. A start the viewer asked for that fails shows "Busy" or "Unavailable" with the reason and the fix in the tooltip (the texts of the first build's AC-7).
- **AC-5**: A live run with no payments after 6 seconds shows "Worker not running", with the fix ("Start the API with `SIMULATION_WORKER_ENABLED=true`, or run `scripts/run_sandbox_simulation_worker.py`.") in the tooltip.
- **AC-6**: A finished run stays finished; nothing restarts it automatically. Its payments stay on the charts (unchanged spec 0003 behaviour).
- **AC-7**: For S06 to S08 the switch is disabled and nothing starts; the tooltip reads "Workflow scenarios have no payment schedule to simulate." (unchanged).
- **AC-8**: A browser may start at most 10 runs per rolling minute (spec 0003 AC-11, amended); the site cap of 20 live runs is unchanged.
- **AC-9**: The Scenario tab has no feed panel or line; the decisions API is unchanged from spec 0004 (no `run` block).
- **AC-10**: The cards, charts, Cases and Model tabs are unchanged.

## Decision

**Chosen option**: history kept and always visible, with the live feed on by default and its state shown only in the top bar.

The feed hook starts a run on load and on scenario change unless the viewer switched it off; the switch's short status and tooltip carry every state, including failures. Nothing is added to the Scenario tab and the API gains nothing.

## Rationale

Context, options and reasoning: see [rationale.md](rationale.md). The two amendments above record why the design moved from the original Option 1 panel to this.

## Feature design

**Switch states** (driven by `SandboxFeedState` from `useSandboxFeed.ts`; the hook gains automatic start, a remembered "off", and an `auto` flag on failures):

| Feed state | Status word | Dot | Tooltip |
|---|---|---|---|
| `idle` | Showing history | grey | history text (AC-3) |
| `starting` | Starting… | grey | "Starting the live feed." |
| `live` | n / m | green, pulsing | live text (AC-3) |
| `live`, waiting for worker | Worker not running | amber | worker fix (AC-5) |
| `finished` | Finished · n, or Stopped · n | grey | finished text (AC-3) |
| `busy`, automatic | Showing history | grey | "The live feed is at its limit right now, so this shows the imported history." |
| `unavailable`, automatic | Showing history | grey | "The live feed isn't available here, so this shows the imported history." |
| `busy`, asked for | Busy | amber | "The live feed is at its limit. Try again in a minute." |
| `unavailable`, asked for | Unavailable | red | "The live feed needs the API with the Sandbox store configured, and site data allowed in this browser." |
| `unsupported` | (none) | grey, switch disabled | unchanged (AC-7) |

**Remembered off**: `localStorage` key `radar-live-feed`, value `off`, written when the viewer switches off and removed when they switch on; every read and write is wrapped so blocked storage falls back to on.

**Automatic start**: one effect keyed on the scenario; a ref remembers the last scenario it started so React's development double run doesn't start twice. A scenario change still stops the old run first (unchanged); the server also cancels the browser's other live run when a new one starts (spec 0003 AC-10).

**Value sourcing**:

| Action | Value produced / displayed | Source |
|---|---|---|
| Automatic start | whether to start | `FEED_SCENARIOS` includes the scenario, and `radar-live-feed` is not `off` |
| Status word and tooltip | which state | `SandboxFeedState.status`, `waitingForWorker`, and `auto` on busy or unavailable |
| Status "n / m" | progress | run `appended_event_count` and `scheduled_event_count` (spec 0003 progress stream, unchanged) |
| Finished or stopped | label | run `state` (`completed` versus `cancelled` or `failed`) |

**Key invariants**:
- One control: only the switch starts, stops or retries the feed.
- A viewer's "off" is never overridden by an automatic start.
- An automatic failure never shows a warning; only a start the viewer asked for does.
- A finished run is never restarted automatically.
- The history cards and charts never change meaning.

**Security model**: unchanged from spec 0003. Every start still carries this browser's ID and passes the same limits; the remembered "off" is a local display preference, not a security control.

**Accessibility**: the status stays a polite live region (unchanged). Its tooltip opens on hover and on keyboard focus (the status is focusable), so the explanation and fixes are reachable without a pointer. Reduced motion stops the dot's pulse (unchanged).

**Critical test scenarios**:
- Load with no preference: the switch turns on by itself and the status counts up, verifies **AC-1**
- Switch off, reload: no start request, status "Showing history", verifies **AC-2**
- Scenario change while on: a fresh start for the new scenario, verifies **AC-1**
- Automatic start answered 429 or 503: switch off, "Showing history", no warning, verifies **AC-4**
- Asked for start answered 429: "Busy" with the reason in the tooltip, verifies **AC-4**
- Stuck at zero: "Worker not running" with the fix in the tooltip, verifies **AC-5**
- Finished run: stays finished, no new start, verifies **AC-6**
- API: the start limit allows 10 starts a minute, verifies **AC-8**

## Build plan

1. Raise `MAX_SIMULATION_STARTS_PER_MINUTE` to 10 and cover it in `tests/test_sandbox_scenario_data.py`, satisfies **AC-8**
2. Remove the `run` block from the decisions API (model, query, helper, tests) and its web type, and restore `RadarReference.tsx`'s decisions state, satisfies **AC-9**
3. Remove `RadarFeedPanel.tsx`, its CSS and its tests, satisfies **AC-9**
4. `useSandboxFeed.ts`: automatic start on load and scenario change, the remembered "off", and `auto` on busy or unavailable, satisfies **AC-1**, **AC-2**, **AC-4**, **AC-6**
5. `RadarLiveSwitch.tsx`: the status words and a focusable tooltip for every state, satisfies **AC-3**, **AC-4**, **AC-5**, **AC-7**
6. Playwright tests in `tests/sandbox-feed.spec.ts`: existing feed tests start from "off" via the remembered preference; new tests for automatic start, remembered off, quiet and asked for failures, worker, finished, satisfies **AC-1** to **AC-7**, **AC-10**
7. Update `context/` (Scenario tab and live feed descriptions, spec 0003 limit) through `/sync` once built

## Consequences

**Positive**:
- The page is live from the first moment, with nothing added to the Scenario tab.
- One control and one status, in one place, on every tab.
- No API change, and less code than the first build.

**Negative / tradeoffs**:
- Every visit to S01 to S05 starts a run and, for S02 to S05, saves feed cases without the viewer asking (bounded by the 20 feed cases per browser and 30 days).
- Visitors share the site cap of 20 live runs, and a closed tab holds its run for up to 10 minutes; past the cap, new visitors quietly see history.
- Explanations and fixes are in a tooltip, not on the page; the short status word is the only always visible signal.
- The public deployment has no feed, so there the status always reads "Showing history".

**Neutral**:
- A reload starts a fresh run; the earlier run keeps going on the server until it ends or the new start cancels it (spec 0003 AC-10).

## Follow-up

- [ ] Resume an earlier run after a reload instead of starting a fresh one: needs a "current run for this browser" API route (spec 0003 amendment).
- [ ] Consider showing the run's payments as a distinct layer on "Recommendations over time" (spec 0004 chart) rather than merged into the history.
- [ ] If per run counts are wanted again, bring back the `run` block from the first build (see the amendments).
