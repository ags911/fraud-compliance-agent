# Scope: Fraud Compliance Agent

The product is a synthetic fraud operations showcase. This scope tracks new delivery work that follows the repository baseline.

**Build approach:** Tracer Bullet (complete a thin working path before expanding it).
**Workflow:** Beta (verify, then test after development).

## At a glance

| # | Feature | Phase | Status |
|---|---|---|---|
| 1 | Live decision routing | Slice 1 | in-progress |
| 2 | Mixed feed | Slice 1 | in-progress |
| 3 | Visible feed lifecycle | Slice 1 | in-progress |

## Slice 1: Live decision routing

### 1. Live decision routing · in-progress
Show individual synthetic feed payments moving from a fixed input stream to their deterministic PASS, CHALLENGE, or HOLD lane on Radar's Cases tab.
**Done when:** the owned live stream replays safe per payment outcomes, the board shows the newest 18 tokens per lane with accurate totals, and quiet plus reduced motion states are clear.
- [x] Design it (spec): [0006](../specs/0006-live-decision-routing.md)
- [ ] Build it: /develop live decision routing
  - [ ] Safe stream event and replay cursor (AC 4, AC 5)
  - [ ] Routing board and existing feed wiring (AC 1, AC 2, AC 3, AC 6)
  - [ ] Motion, accessible narrow layout, and focused coverage (AC 7, AC 8)
  - [x] Hide board disclosure with a remembered preference (AC 6, AC 9)
- [ ] Verify it: /check verify live decision routing
- [ ] Test it: /test live decision routing

### 2. Mixed feed · in-progress
Radar opens on a feed that interleaves S01 to S05 payments. Each payment keeps its own scenario's accepted decision, so the routing board shows a real three-way split. Single-scenario feeds say why they fill one lane.
**Done when:** Mixed is the default that auto-starts, every Mixed payment records its source dataset and decision, the Scenario tab combines S01 to S05, and single-scenario boards explain their one lane.
- [x] Design it (spec): [0008](../specs/0008-mixed-feed.md)
- [x] Build it: /develop mixed feed
  - [x] Migration, mixed schedule, run start, reveal and overlays (AC 2 to AC 5)
  - [x] Picker default, combined Scenario tab, guards (AC 1, AC 6, AC 7)
  - [x] Routing board single-route line (AC 8)
- [ ] Verify it: /check verify mixed feed
- [ ] Test it: /test mixed feed

### 3. Visible feed lifecycle · in-progress
The auto-started feed waits for a visible tab, stops after two hidden minutes without restarting, and is cancelled reliably on tab close.
**Done when:** background tabs never start a run, hidden tabs release theirs, and closing a tab cancels its run with a keepalive request.
- [x] Design it (spec): [0009](../specs/0009-visible-feed-lifecycle.md)
- [x] Build it: /develop visible feed lifecycle
- [ ] Verify it: /check verify visible feed lifecycle
- [ ] Test it: /test visible feed lifecycle

## Legend

The scope retains a small feature level view. The full build details are in each linked specification.
