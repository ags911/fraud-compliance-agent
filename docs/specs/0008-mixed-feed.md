# 0008. Mixed feed

**Date**: 2026-09-25
**Status**: In Progress

## Summary

Radar's scenario picker gains a "Mixed feed" option, and it becomes the default that auto-starts. A Mixed run interleaves payments shaped like S01 to S05. Each payment keeps its own scenario's accepted decision (spec 0004), so the routing board (spec 0006) shows a real PASS, CHALLENGE, and HOLD split. No threshold, score, or new rule is introduced. Single-scenario feeds stay available. When a single scenario is selected, the board states that its rule sends every payment to one outcome, so empty lanes are not mistaken for a fault.

## Context

`feed_decision()` gives every outbound payment in a scenario's feed the same decision: S01 PASS, S02 and S03 HOLD, S04 CHALLENGE, S05 HOLD. Radar auto-starts S01, so the routing board fills one lane and never shows a split. A feed that draws from all five payment scenarios shows a split made only of accepted per-scenario decisions.

Runs, their events, case saving, and the Scenario tab overlay all assume one scenario per run. `sandbox_simulation_runs` has a foreign key to one `(scenario_id, fixture_version)` dataset.

## Requirements

**User stories**:
1. As a demo viewer, I want the dashboard to open on a feed whose payments land in different outcomes, so the routing is visible without choosing a scenario.
2. As a reviewer, I want each mixed payment to show which scenario and dataset it came from, so the mix can be audited and nothing is invented.
3. As a viewer of one scenario, I want to be told that one lane is expected, so I don't read empty lanes as a bug.

**Acceptance criteria**:
1. **AC 1**: The picker lists "Mixed feed · S01 to S05" first, and Radar opens on it. `?scenario=` with a scenario the picker lists (S01 to S05) opens that scenario instead. Any other value falls back to Mixed.
2. **AC 2**: `POST /sandbox/scenarios/MIX/simulation-runs` creates a run with `scenario_id` `MIX` and no fixture version. Its 200 payments are in 40 blocks of five, and each block holds one payment from each of S01 to S05 in a seeded order. The same seed and position always give the same payment and scenario.
3. **AC 3**: Each Mixed payment stores its source scenario and that scenario's latest imported fixture version. Its route, recommendation, and basis are that scenario's `feed_decision`. A revealed non-PASS payment saves a feed case under its source scenario.
4. **AC 4**: The run starts only if all five source datasets are imported. Otherwise it fails with the existing 404 `sandbox_scenario_not_found`. The existing limits, ownership rules, cancel, stream, and sweep apply unchanged.
5. **AC 5**: A single scenario's analytics and decisions with a Mixed run add only that run's revealed payments whose source is that scenario and fixture version. Another browser's run, or a scenario outside S01 to S05, still reads as 404 `sandbox_simulation_not_found`.
6. **AC 6**: With Mixed selected, the Scenario tab shows S01 to S05 combined. It requests each scenario's existing analytics and decisions with the Mixed run and adds them up by day. The accepted analytics contract (1.0) and the decisions response are unchanged.
7. **AC 7**: With Mixed selected, Run showcase is disabled with the explanation "Pick one scenario to run the showcase", because an investigation needs one scenario. The Cases filter and summaries list only S01 to S08.
8. **AC 8**: With a single scenario selected and at least one payment routed, the routing board says "Every {scenario} payment follows its rule: {outcome}", using the outcome that was actually routed. With Mixed it says "Payments from S01 to S05, each decided by its own scenario's rule."

## Decision

Add a run-level scenario identifier `MIX`. Make the run's fixture version nullable for `MIX` only, and record source lineage per event. This keeps one run per browser, one stream, and one sweep. The per-scenario analytics contract is unchanged: the browser combines the five scenario reads it already knows how to make. Options rejected: five parallel child runs (the server keeps one live run per browser), and a new combined analytics response (an accepted contract change).

## Feature design

**Migration `0007_mixed_feed.sql`** (rerunnable):
- `sandbox_simulation_runs.fixture_version` drops `NOT NULL`, with the check `(scenario_id = 'MIX') = (fixture_version IS NULL)`. The existing foreign key is not enforced when the version is null.
- `sandbox_simulation_events` gains `source_scenario_id` and `source_fixture_version`. Both are null for a single-scenario run and both are set for a Mixed run. They have a foreign key to `sandbox_datasets`.

**Schedule**: `build_mixed_schedule(latest_days, run_id, seed)`. For block `b`, the order of S01 to S05 is sorted by `sha256(seed:MIX:b:scenario)`. Each payment uses its scenario's reviewed shape, amount variation, and latest day, as `build_scenario_schedule` does.

**Value sourcing**:

| Value | Source |
|---|---|
| Payment decision | `feed_decision(source_scenario_id)` |
| Case scenario | `COALESCE(source_scenario_id, run.scenario_id)` |
| Mixed Scenario tab | the sum by day of the five per-scenario reads with the Mixed run |
| Single-route line | the routed recommendation in the snapshot, not a client copy of the rules |

**Invariants**: no new threshold, score, or rule. Every Mixed payment names its dataset. A single-scenario run behaves exactly as before.

## Build plan

1. Migration, mixed schedule, Mixed run start and reveal, source-filtered overlays, and API tests (AC 2 to AC 5).
2. Picker, default and `?scenario=`, combined Scenario tab, Run showcase and Cases guards (AC 1, AC 6, AC 7).
3. The routing board line (AC 8), with Playwright coverage.

## Consequences

The first screen shows a three-way split. Existing tests that assumed S01 as the default open `?scenario=S01`. Combining the Mixed Scenario tab makes five times as many requests per feed revision, one per source scenario.
