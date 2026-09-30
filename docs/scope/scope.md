# Scope: Fraud Compliance Agent

This is a synthetic fraud operations portfolio showcase. It demonstrates engineering judgement through safe, inspectable flows. It is not a production product plan.

**Build approach:** Tracer Bullet (complete a thin working path before expanding it).
**Workflow:** Beta (verify, then test after development).

## At a glance

| # | Feature | Phase | Status |
|---|---|---|---|
| 1 | Live decision routing | Slice 1 | done |
| 2 | Mixed feed | Slice 1 | done |
| 3 | Visible feed lifecycle | Slice 1 | done |
| 4 | Score routing (F3) | Slice 2 | done |
| 5 | AI operations overview (F4a) | Slice 3 | in-progress |
| 6 | Portfolio release closeout | Slice 3 | planned |

## Slice 1: Live decision routing

### 1. Live decision routing · done
Show individual synthetic feed payments moving from a fixed input stream to their deterministic PASS, CHALLENGE, or HOLD lane on the Risk Console's Cases tab.
**Done when:** the owned live stream replays safe per payment outcomes, the board shows the newest 18 tokens per lane with accurate totals, and quiet plus reduced motion states are clear.
- [x] Design it (spec): [0006](../specs/0006-live-decision-routing.md)
- [x] Build it: /develop live decision routing
  - [x] Safe stream event and replay cursor (AC 4, AC 5)
  - [x] Routing board and existing feed wiring (AC 1, AC 2, AC 3, AC 6)
  - [x] Motion, accessible narrow layout, and focused coverage (AC 7, AC 8)
  - [x] Hide board disclosure with a remembered preference (AC 6, AC 9)
- [x] Verify it: /check verify live decision routing
- [x] Test it: /test live decision routing

### 2. Mixed feed · done
The Risk Console opens on a feed that interleaves S01 to S05 payments. Each payment keeps its own scenario's accepted decision, so the routing board shows a real three-way split. Single-scenario feeds say why they fill one lane.
**Done when:** Mixed is the default that auto-starts, every Mixed payment records its source dataset and decision, the Scenario tab combines S01 to S05, and single-scenario boards explain their one lane.
- [x] Design it (spec): [0008](../specs/0008-mixed-feed.md)
- [x] Build it: /develop mixed feed
  - [x] Migration, mixed schedule, run start, reveal and overlays (AC 2 to AC 5)
  - [x] Picker default, combined Scenario tab, guards (AC 1, AC 6, AC 7)
  - [x] Routing board single-route line (AC 8)
- [x] Verify it: /check verify mixed feed
- [x] Test it: /test mixed feed

### 3. Visible feed lifecycle · done
The auto-started feed waits for a visible tab, stops after two hidden minutes without restarting, and is cancelled reliably on tab close.
**Done when:** background tabs never start a run, hidden tabs release theirs, and closing a tab cancels its run with a keepalive request.
- [x] Design it (spec): [0009](../specs/0009-visible-feed-lifecycle.md)
- [x] Build it: /develop visible feed lifecycle
- [x] Verify it: /check verify visible feed lifecycle
- [x] Test it: /test visible feed lifecycle

## Slice 2: Score routing

### 4. Score routing (F3) · done
The rules decide every feed payment first. When they clear one, the model score (trained on Sparkov synthetic data) can raise it to CHALLENGE or HOLD at two thresholds measured on Sparkov, and never lowers a rule decision. Planted S01 outliers show the model catching what the rules cleared, and the page says they are planted.
**Done when:** model raised payments appear on the routing board with their score, save v2 cases that explain the score and threshold, and a missing model or policy falls back to the rules with one warning.
- [x] Design it (spec): [0010](../specs/0010-score-routing/index.md)
- [x] Build it: /develop score routing
  - [x] Policy file, migration, routing at run start, S01 outliers, board marker (AC 1 to AC 6, AC 9)
  - [x] Events v2, case contracts, drawer story and table mode (AC 7, AC 8, AC 10, AC 11)
  - [x] Chart copy, tour step, image shipping, full tests (AC 12 to AC 14)
- [x] Verify it: /check verify score routing ([verify.md](../specs/0010-score-routing/verify.md))
- [x] Test it: /test score routing (`tests/test_score_routing.py`, four Playwright specs)

## Slice 3: AI overview

### 5. AI operations overview (F4a) · in-progress
On request, an AI model writes a short plain overview of the selected scenario's dashboard: activity, rule and model decisions, the live feed and recent cases. It is labelled as AI written about synthetic data, and it never decides or changes anything.
**Done when:** a "Write overview" button produces a short overview grounded only in the figures on screen, clearly labelled as AI written, within a spending and rate limit, with an honest message when the model is unavailable.
- [x] Design it (spec): [0011](../specs/0011-ai-operations-overview/index.md)
- [x] Build it: /develop AI operations overview (code in `apps/api/server/sandbox_data/overview.py`, `overview_writer.py`, `apps/web/src/console/ConsoleOverviewCard.tsx`)
  - [x] Template overview from real facts: contract, facts builder, route, Overview card (AC 1 to AC 3, AC 5, AC 7, AC 8, AC 10)
  - [x] Live model, checked: config, switch, limits, token cap, fact check, reason lines (AC 4 to AC 6)
  - [x] Finish: out of date detection, deployment checks, full tests (AC 9, AC 11)
- [ ] Verify it: /check verify AI operations overview
- [ ] Test it: /test AI operations overview

### 6. Portfolio release closeout · planned
Finish a polished, truthful public demonstration of the existing synthetic flow. Do not add product operations, live financial screening, authentication, or new data sources in this pass.
**Done when:** Azure shows the tested routing experience and AI overview, the approved visual polish is committed, and the repository explains the simulated data boundary and the architecture choices a reviewer can inspect.
- [ ] Finish the release pass: /develop portfolio release closeout
  - [x] Commit the approved routing glow and preserve its focused desktop and mobile coverage
  - [x] Confirm the AI overview works live when enabled and falls back truthfully when unavailable
  - [x] Add concise portfolio handoff documentation for the architecture, synthetic data and guardrails
- [ ] Verify it: /check verify portfolio release closeout
- [ ] Test it: /test portfolio release closeout
- [ ] Deploy and smoke test the public Azure release

## Deferred after the portfolio release

- External Companies House enrichment
- Sanctions screening
- Authenticated human review workflow
- Health, replay and operational monitoring
- WebSocket transport work
- New model training pipeline

## Legend

The scope retains a small feature level view. The full build details are in each linked specification.
