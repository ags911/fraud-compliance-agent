# Architecture decision records

This index is the repository's decision log. Active ADRs live in this folder
(ADR-020 onward). ADR-000 to ADR-019 are archived under
[`docs/archive/apps/api/docs/adr/`](../../../../docs/archive/apps/api/docs/adr/)
and are listed here too, because several accepted ones still govern.

`Proposed` means reviewable but not authorised; only an accepted ADR and its
versioned contracts may govern implementation. Supersede an accepted ADR with
a new one rather than rewriting it. Read the row for anything you are about to
change, then the ADR itself.

## Active (this folder)

| ADR | Title | Status |
| --- | --- | --- |
| [020](0020-accept-local-case-persistence.md) | Accept local case persistence and the showcase cases contract | Accepted 2026-09-27; supersedes in part ADR-017 |
| [021](0021-allow-a-public-showcase-database.md) | Allow the public showcase one guarded PostgreSQL database | Accepted 2026-09-28; enabled 2026-09-28; supersedes in part ADR-014, 016 and 017 |
| [022](0022-accept-the-sandbox-event-store.md) | Accept the Sandbox event store | Accepted 2026-09-28 |
| [023](0023-accept-the-sandbox-simulation-contract.md) | Accept the Sandbox simulation contract | Accepted 2026-09-28 |
| [024](0024-accept-a-display-only-sparkov-model-score.md) | Accept a display only Sparkov model score on feed cases | Accepted 2026-09-28; supersedes in part ADR-004 |
| [025](0025-route-rule-cleared-payments-by-model-score.md) | Route rule cleared feed payments by model score | Accepted 2026-09-29; supersedes in part ADR-004 |
| [026](0026-allow-an-ai-written-dashboard-overview.md) | Allow an AI written dashboard overview on the public showcase | Accepted 2026-09-29 |

## Archived (`docs/archive/apps/api/docs/adr/`)

Archived files are history, but their status below still stands.

| ADR | Title | Status |
| --- | --- | --- |
| 000 | Template | n/a |
| 001 | Application, SDK and package boundary | Proposed |
| 002 | Canonical domain contract | Proposed |
| 003 | Plaid mapping and feature feasibility | Proposed |
| 004 | Fraud target and corpus | Proposed; corpus precondition superseded in part by ADR-024 and 025 |
| 005 | Model artifact and evaluation contract | Proposed |
| 006 | Routing, authority and oversight | Proposed; sub-decisions accepted 2026-09-20 |
| 007 | Telemetry and signed evidence | Proposed |
| 008 | Inventory, oversight pack linkage | Proposed |
| 009 | PostgreSQL transitions and recovery | Proposed |
| 010 | Identity, roles and deployment | Proposed |
| 011 | Operational acceptance and versioning | Proposed |
| 012 | Freeze the current showcase API contract | Accepted 2026-09-19 |
| 013 | Adopt local-first F3 boundaries | Accepted for F3 preparation only, 2026-09-20 |
| 014 | Adopt public-safe showcase investigation boundary | Accepted for scoped preparation only, 2026-09-20; database free wording superseded in part by ADR-021 |
| 015 | Freeze the public-showcase investigation contract | Accepted 2026-09-20 |
| 016 | Accept public-showcase S01–S08 fixtures | Accepted 2026-09-20; database free wording superseded in part by ADR-021 |
| 017 | Implement public-showcase runtime | Accepted 2026-09-20; "no path persists run state" superseded in part by ADR-020 |
| 018 | Accept Plaid Sandbox-derived showcase fixture enrichment rules | Accepted 2026-09-22; superseded in part by ADR-019 |
| 019 | Accept Plaid Sandbox-derived S04 account-activity evidence | Accepted 2026-09-22 |
