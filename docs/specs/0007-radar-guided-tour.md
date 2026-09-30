# 0007. Radar guided tour

**Date**: 2026-09-24
**Status**: In Progress

## Summary

> **Updated 2026-09-27, Risk Console consolidation.** Radar is now the Risk Console at `/`. The Overview page and `useOverviewTour.ts` were removed, so this tour is the only one. Its hook is `src/lib/useConsoleTour.ts`, its targets use the `console-` prefix, its popover styles are `.driver-popover.console-tour` in `apps/web/index.html`, and its tests are `tests/console-tour.spec.ts`. The spec keeps its original title and file name as its identity; the build plan below is the historical record.

> **Amended 2026-09-30, owner decision: first visit tour.** The tour now starts by itself once per browser, and every step but the last offers "Skip tour" (AC-1 revised, AC-7 added). Reason: a portfolio reviewer lands on the console cold, and an opt in tour behind a small help icon was easy to miss; running it on every load would nag returning visitors. The seen flag is `console-tour-seen` in localStorage, set when the tour starts. The "opt in only, no seen flag" constraint below is superseded.

The Risk Console (`/`, Radar at `/radar` when written) gets an opt in spotlight tour, built the same way as the Overview tour (`useOverviewTour.ts`, driver.js). A help icon in the top bar starts it; it never starts by itself. Six steps cover only what the console has today: the scenario picker, the live feed switch, Run showcase, the Cases tab, the scenario figures and the recommendations chart. Steps for later stages (F5 human review, F6 Health tab, the S06 to S08 Operations group) are added only when those surfaces ship.

## Requirements

**User stories**:
- As a demo viewer new to Radar, I want a short guided walkthrough, so I understand what each part shows and that the data is synthetic and decided by rules.
- As a returning viewer, I want the tour to stay out of my way until I ask for it.

**Acceptance criteria**:
- **AC-1** (revised 2026-09-30): A browser that has not seen the tour gets it once, automatically, when the API has answered its health check, on the Scenario tab, unless the link opens a case (`?case=`). Starting the tour marks it seen, so a reload does not repeat it; if storage is blocked it counts as not seen. A help icon button in the top bar ("How this dashboard works") starts it at step 1, from any tab; if another tab is open, the console switches to the Scenario tab first.
- **AC-2**: Six steps, in this order, each highlighting its target: the scenario picker, the Live switch, Run showcase, the Cases tab, the scenario figures (stat cards), and "Recommendations over time". Progress reads "Step n of 6"; Next and Back move between steps; step 1 has no Back; the last step's button reads "Finish".
- **AC-3**: The copy describes only what exists: the data is synthetic Sandbox data, the feed adds simulated payments, decisions come from the scenario's deterministic rule, no model score decides anything, and cases are read only. No step mentions a planned feature.
- **AC-4**: Escape, the close button and clicking the mask end the tour; the rest of the page is masked while the highlighted control stays usable; animation is off when the viewer prefers reduced motion.
- **AC-5**: The popover uses the console's own dark palette and passes an automated accessibility check (axe, WCAG 2.1 A and AA).
- **AC-7** (added 2026-09-30): Every step except the last shows a "Skip tour" button that ends the tour; the last step has Finish instead.
- **AC-6** (retired 2026-09-27: the Overview, decision workspace and investigation pages and their tours were removed): The Overview, decision workspace and investigation tours are unchanged.

## Decision

A new `useRadarTour` hook mirrors the Overview tour's driver.js options (mask, keyboard, reduced motion, progress text) with Radar's steps. `useOverviewTour` is not generalised: it is working and tested, and the project rules forbid rewriting working logic unless a spec asks for it. The tour steps through with Next and Back only; unlike Overview, nothing on Radar has to happen in order. It stays on the Scenario tab and points at the Cases tab label rather than switching tabs under the viewer.

## Feature design

**Entry point**: an icon button (lucide `CircleHelp`) at the end of the top bar actions, labelled "How this dashboard works".

**Targets**: stable ids on the console's existing elements: `#console-scenario-trigger`, `#console-live-switch`, `#console-run-showcase`, `#console-cases-tab`, `#console-summary`, `#console-recommendations` (a wrapper around the chart card).

**Styling**: `.driver-popover.console-tour` rules in `apps/web/index.html`, from the console's tokens; the mask sits below Radix menus so the open scenario picker stays clickable.

**Key invariants**:
- ~~Opt in only; no welcome prompt and no stored "seen" flag.~~ Superseded 2026-09-30: first visit auto start with a stored seen flag (AC-1).
- A step exists only for a surface that is built.

**Critical test scenarios**: never starts by itself; starts at step 1 of 6 with no Back; Next and Back visit all six targets in order; starting from the Cases tab lands on Scenario; Escape ends it; reduced motion turns animation off; axe finds no violations in the popover.

## Build plan

1. Target ids on Radar's elements and the help button in the top bar, satisfies **AC-1**
2. `src/lib/useRadarTour.ts` with the six steps and copy, satisfies **AC-2**, **AC-3**, **AC-4**
3. Popover styles in `radar-reference.html`, satisfies **AC-5**
4. Playwright `tests/radar-tour.spec.ts`, satisfies **AC-1** to **AC-6** (AC-6 since retired)

## Consequences

- One more tour to keep in step with the page: renaming or removing a target breaks its step, which the tests catch.
- Later stages each owe a step (see Follow-up), which keeps the tour honest but means it grows; past about 7 steps, split it per tab.

## Follow-up

- [ ] F5: when human review ships, point at the review queue or case actions.
- [ ] F6: add a step for the Health tab when it ships.
- [ ] S06 to S08: when the picker groups Decisions and Operations scenarios, give Operations scenarios their own steps in place of the feed and Run showcase steps.
