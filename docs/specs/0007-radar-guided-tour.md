# 0007. Radar guided tour

**Date**: 2026-09-24
**Status**: In Progress

## Summary

Radar (`/radar`) gets an opt in spotlight tour, built the same way as the Overview tour (`useOverviewTour.ts`, driver.js). A help icon in the top bar starts it; it never starts by itself. Six steps cover only what Radar has today: the scenario picker, the live feed switch, Run showcase, the Cases tab, the scenario figures and the recommendations chart. Steps for later stages (F5 human review, F6 Health tab, the S06 to S08 Operations group) are added only when those surfaces ship.

## Requirements

**User stories**:
- As a demo viewer new to Radar, I want a short guided walkthrough, so I understand what each part shows and that the data is synthetic and decided by rules.
- As a returning viewer, I want the tour to stay out of my way until I ask for it.

**Acceptance criteria**:
- **AC-1**: The tour never starts by itself. A help icon button in the top bar ("How this dashboard works") starts it at step 1, from any tab; if another tab is open, Radar switches to the Scenario tab first.
- **AC-2**: Six steps, in this order, each highlighting its target: the scenario picker, the Live switch, Run showcase, the Cases tab, the scenario figures (stat cards), and "Recommendations over time". Progress reads "Step n of 6"; Next and Back move between steps; step 1 has no Back; the last step's button reads "Finish".
- **AC-3**: The copy describes only what exists: the data is synthetic Sandbox data, the feed adds simulated payments, decisions come from the scenario's deterministic rule, no model score decides anything, and cases are read only. No step mentions a planned feature.
- **AC-4**: Escape, the close button and clicking the mask end the tour; the rest of the page is masked while the highlighted control stays usable; animation is off when the viewer prefers reduced motion.
- **AC-5**: The popover uses Radar's own dark palette and passes an automated accessibility check (axe, WCAG 2.1 A and AA).
- **AC-6**: The Overview, decision workspace and investigation tours are unchanged.

## Decision

A new `useRadarTour` hook mirrors the Overview tour's driver.js options (mask, keyboard, reduced motion, progress text) with Radar's steps. `useOverviewTour` is not generalised: it is working and tested, and the project rules forbid rewriting working logic unless a spec asks for it. The tour steps through with Next and Back only; unlike Overview, nothing on Radar has to happen in order. It stays on the Scenario tab and points at the Cases tab label rather than switching tabs under the viewer.

## Feature design

**Entry point**: an icon button (lucide `CircleHelp`) at the end of the top bar actions, labelled "How this dashboard works".

**Targets**: stable ids added to Radar's existing elements: `#radar-scenario-trigger`, `#radar-live-switch`, `#radar-run-showcase`, `#radar-cases-tab`, `#radar-summary`, `#radar-recommendations` (a wrapper around the chart card).

**Styling**: `.driver-popover.radar-tour` rules in `radar-reference.html`, from Radar's tokens; the mask sits below Radix menus so the open scenario picker stays clickable, as on Overview.

**Key invariants**:
- Opt in only; no welcome prompt and no stored "seen" flag.
- A step exists only for a surface that is built.

**Critical test scenarios**: never starts by itself; starts at step 1 of 6 with no Back; Next and Back visit all six targets in order; starting from the Cases tab lands on Scenario; Escape ends it; reduced motion turns animation off; axe finds no violations in the popover.

## Build plan

1. Target ids on Radar's elements and the help button in the top bar, satisfies **AC-1**
2. `src/lib/useRadarTour.ts` with the six steps and copy, satisfies **AC-2**, **AC-3**, **AC-4**
3. Popover styles in `radar-reference.html`, satisfies **AC-5**
4. Playwright `tests/radar-tour.spec.ts`, satisfies **AC-1** to **AC-6**

## Consequences

- One more tour to keep in step with the page: renaming or removing a target breaks its step, which the tests catch.
- Later stages each owe a step (see Follow-up), which keeps the tour honest but means it grows; past about 7 steps, split it per tab.

## Follow-up

- [ ] F5: when human review ships, point at the review queue or case actions.
- [ ] F6: add a step for the Health tab when it ships.
- [ ] S06 to S08: when the picker groups Decisions and Operations scenarios, give Operations scenarios their own steps in place of the feed and Run showcase steps.
