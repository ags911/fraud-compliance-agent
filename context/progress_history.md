# Progress History

> Dated history moved out of [`progress_tracker.md`](progress_tracker.md) on
> 2026-11-10 so the tracker can stay a short current-state record. Nothing here
> is current status: read it for what shipped when, never for what is true now.
> Where a later decision overtook a line, a bracketed note says so.

## Active phase as of 2026-09-22 (superseded)

**Brownfield documentation-consolidation baseline established.** This
`/context/` directory synthesizes the PRD (v0.3, candidate), the
implementation plan, all 20 ADR files, all 14 proposal docs, all 10
experiment records, the design-system docs, the two point-in-time audits,
and the vendored SDK's reference architecture, as of branch
`feature/overview-live-model-work`, 2026-09-22.

## MVP Completion Detail (progress dated 2026-09-21)

> **Retired 2026-09-27.** Every screen listed in the MVP 1–3 tables below
> (Overview, Benchmark Insights, Not Found, the Rules Performance reference,
> New transaction, Decision workspace, Showcase investigation) was removed
> when the Risk Console became the only page (branch `refactor/risk-console`).
> The APIs they used remain. The ticks record what was delivered and
> verified at the time; the MVP gates' web checks now run against the
> console (`make acceptance-mvp1`/`-mvp2` = lint, build, Playwright; the
> MVP 2/3 local browser matrix scripts were deleted with their pages).

### MVP 0 — Local engineering foundation

No screens (infra-only). 9/9 ✓: monorepo separation; `make check`/CI (3
jobs: web, API+SDK, API-no-SDK); FastAPI health/scenario/model-summary/
streamed-run endpoints; web SSE consumers; documented data-governance
boundaries; model training/eval moved to `apps/api/modelling` (2026-09-19,
API suite 89→209 tests); frozen v1 API contract (2026-09-19, ADR-012);
browser-to-local-API E2E for A–F+outage; API error redaction/CORS verified
locally.

### MVP 1 — Guided product walkthrough

| Status | Screen | Route | Notes |
|---|---|---|---|
| ✓ | Overview | `/overview` | Shared app shell, zero state, guided tour, KPI strip; synthetic demo data labelled as representative. |
| ✓ | Benchmark Insights | `/insights` | Read-only Sparkov benchmark evidence; cannot score a transaction, show drift, or make a production claim. |
| ✓ | Not Found | `*` | Branded recovery screen for any unavailable route, no invented data. |
| ✓ | Rules Performance reference | `/references/rules-performance-reference.html` | Frozen design reference only, not a product screen or data source. |

6/6 automated ✓ (manual assistive-technology review pending): zero state/
welcome dialog/tour/labelling; mechanics-only benchmark; recovery;
visual-only reference; axe passes both widths; welcome-dialog/tour behavior
decided 2026-09-19 (on-page checklist removed, driver.js 4-step opt-in
tour).

### MVP 2 — Live decision demonstration

| Status | Screen | Route | Notes |
|---|---|---|---|
| ✓ | New transaction / decision run | `/transactions/new` | Streams validated SSE events from `POST /run`/`POST /run/preset/{scenario_id}`; every action simulated. |
| ✓ | Decision workspace | `/transactions/run/:runId` or an in-place run result | Node status, model/rule outputs, counterfactual result, signed-record state, outage/fail-safe path. |
| ✓ | Overview | `/overview` | Continues as entry point; must not manufacture aggregate history from a transient run. |

6/6 ✓: scenario/run/SSE consumption; preset/custom-run + LLM-outage routes;
dashboard merged into Overview route (2026-09-19, standalone `dashboard.html`
removed); loading/cancellation/error/outage verification; simulated-outcome
labelling; decision-workspace tour added.

### MVP 3 — Azure public showcase

| Status | Surface | Notes |
|---|---|---|
| ✓ | Web console | Azure Static Web Apps Free, verified at the public URL by workflow run `35611121637`. |
| ✓ | Demo API | Azure Container Apps Consumption, 0–1 replicas. |
| ✓ | Public-safe investigation | 3rd live-only tool `get_account_activity_evidence` added (ADR-018/019); budget 3 total/1 per tool. |
| ✓ | Delivery | GitHub Actions, Azure OIDC, run `35611121637`, commit `942f92b`. |
| ◐ | Cost/safety | Doppler config prepared but unused; budget-alert delivery unexercised. |
| ◐ | Screens | MVP 1–2 screens remain; manual keyboard/screen-reader review pending. |

9/12 ✓ + 3 ◐ (Doppler config, budget-alert delivery unexercised, tour
API-status step).

**Deliberate MVP 3 scope exclusions (not gaps)**: dashboard trends/
sparklines/Plaid-scored history → F3a/F6; "what would change the outcome?"
counterfactual → F3a; S06–S08 stateful behavior → F3–F6 (503 is expected
today); real Groq execution optional/unclaimed (recorded playback is
default).

## Delivery records

**Delivery record, 2026-10-01 (first visit experience and cost).** The
Risk Console tour now starts once per browser (spec 0007 AC-1 amended,
AC-7 "Skip tour" added; PR #42). Five measured cold starts of the hosted
API took 15.5, 16.9, 17.4, 18.6 and 22.4 s to answer `/health`, and the
first Neon read after that about 0.14 s, because the feed worker reads
Neon every second and so wakes it with the API. The wake notice now says
"about 15 to 25 seconds" and shows an estimated progress bar that never
fills early, switching to "Taking longer than usual" after 25 s (PR #44).
A cron scale rule keeps one replica warm 09:00 to 16:00 Europe/London on
weekdays (PR #43): 161 replica hours in a 23 weekday month against Azure's
200 hour free grant, and about 40 of Neon's 100 free CU hours at 0.25 CU;
the deployment verifier pins the window. The deploy reuses a passed
Verify run on the same commit instead of repeating `make check` (PR #45).
Deploy run `36792565898` from `e28e574` was smoke tested: the rule is live
on Azure, and a cold load showed the bar until the API answered at 18.6 s
with no page errors. Done 2026-10-01 by the owner: the public Neon project
(`polished-base`) is fixed at 0.25 CU minimum and maximum, so autoscaling
cannot exhaust its free CU hours. It sits in a different Neon organisation
from the local `dev` project. The Cases tab's stat cards now say they count
saved cases, not the routing board's run (PR #47), and the untracked local
agent files are ignored (PR #48).

**Delivery record, 2026-09-30 (portfolio release).** Scope feature 6, the
portfolio release closeout, is done: the routing board's whole lane glow
(replacing the comet sweep), the reviewer guide
[`docs/portfolio.md`](../docs/portfolio.md), and `urllib3` 2.8.0 plus an
`npm audit fix` for new advisories (PR #39). Deploy run `36780805289` from
`f517afd` passed its smoke test: site and API `/health` 200, the overview
answers `template`/`live_disabled`, CORS grants only the site origin, and
Chrome loaded the console with no errors. A local check against Groq
(`openai/gpt-oss-120b`) returned grounded live overviews and fell back at
the 3 per 10 minute limit. Companies House, sanctions screening, human
review, monitoring, WebSockets and new model training are deferred (see
[`docs/scope/scope.md`](../docs/scope/scope.md)).

**Delivery record, 2026-09-27.** Specs 0002, 0006, 0008 and 0009 are
Accepted; spec 0003 is verified 28/28. ADR-022 is Proposed [later accepted 2026-09-28]. Codex's fresh
model review is recorded at
[`docs/reviews/2026-09-27-refactor-risk-console.md`](../docs/reviews/2026-09-27-refactor-risk-console.md)
with an Approve verdict. Public-database guards remain on
`feat/public-db-guards`, pending ADR-021 [later accepted 2026-09-28 and enabled].

## Audit History (point-in-time evidence, not living status)

### 2026-09-18 repository audit — remediated

Findings at audit time, all subsequently remediated per the doc's own
update note: **P1** — UI claimed "Signature verified" without verifying
anything (`RecordPanel.tsx`) → fixed, now shows signed-not-verified;
**P1** — SDK submodule declared at the wrong path (`apps/api/.gitmodules`
instead of root) → fixed, SDK now a real root gitlink pinned at
`27844250f926fe0ade2250dd99975c7283defc80`; **P1** — repository inventory
generation was machine-state-dependent (leaked `__pycache__`) → fixed, now
based on tracked files, local/git-ignored, removed from CI; **P1** —
`/run`/`/run/preset` were unauthenticated and unbounded → acceptable only
for isolated local demo, addressed by the later public-showcase boundary
design (recorded playback default, live mode gated); **P2** — invalid
financial inputs accepted (negative amounts, `NaN`) → addressed via
`StrictFiniteModel` bounds; **P2** — HTTP/stream failures could report as
success → addressed in `useAgentRun.ts`; **P2** — a Stripe dashboard capture
with a real account identifier was candidate commit material → removed;
**P2** — web quality gates (`npm run check:payments-design`) not enforced
and one check was failing → promoted into `make check`/CI. Verified 2026-09-18:
`make check` passed, 43 Playwright tests (1 mobile-only skip), 21 API tests,
no known dependency vulnerabilities.

### 2026-09-21 MVP 3 Azure release — verified

Recorded-only public showcase deployed and verified. Full detail (URLs,
commit, image digest, verification checks, residual/deferred items) is in
[`architecture.md`](architecture.md#9-deployment-architecture-azure--verified-2026-09-21)
and the source record,
[`docs/archive/docs/audits/2026-09-21-mvp3-azure-release.md`](../docs/archive/docs/audits/2026-09-21-mvp3-azure-release.md)
(archived, historical only).
"This record captures the first successful Azure release of the synthetic,
database-free recruiter showcase. It is deployment evidence, not a
production readiness, fraud-performance, zero-cost, or live-provider
claim."
