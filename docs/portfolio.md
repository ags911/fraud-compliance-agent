# Reviewer guide

Fraud Compliance Agent is a portfolio showcase. It shows how a payment-risk
console can route payments, explain its routing and use an AI model without
letting that model decide anything. Every payment, customer and outcome is
synthetic. It is not a production service and makes no fraud-performance or
compliance claim.

Live demo: <https://thankful-grass-0e239cb1e.4.azurestaticapps.net>

## What to look at

The web app is one page, the Risk Console.

| Tab | What it shows | Where the data comes from |
|---|---|---|
| Scenario | Figure cards, a recommendations chart and an **Overview** card for S01 to S05 or the Mixed feed | Sanitised Plaid Sandbox history stored in PostgreSQL, plus the viewer's own live feed |
| Cases | The **Live decision routing** board and the saved cases drawer | Payments revealed by the viewer's live feed, each decided when the run starts |
| Model | The Sparkov benchmark summary | A recorded, mechanics-only evaluation report |

Three flows show the design:

1. **Deterministic routing.** Each feed payment is decided when its run
   starts, by its scenario's fixed rule (PASS, CHALLENGE or HOLD). A model
   score may only raise a rule PASS to CHALLENGE or HOLD, never lower an
   outcome (ADR-025). The routing board replays those fixed decisions and
   cannot change them.
2. **Bounded investigation.** "Run showcase" streams a typed investigation
   trace over SSE. It has at most three allowlisted evidence tools, every
   claim must cite evidence returned in that run, and any failure resolves to
   a labelled fail-safe HOLD with no action.
3. **Fact-checked overview.** "Write overview" returns a headline and three
   to five points. The server builds the figures itself. When its live switch
   is on, a Groq model may write the text, and every number in it must match
   those figures exactly. Otherwise, or when the check fails, the viewer gets
   a template summary built from the same figures, labelled as written
   without a model.

## Architecture

- `apps/web`: React and Vite, deployed to Azure Static Web Apps. It uses only
  the accepted API contracts and imports nothing from the backend.
- `apps/api`: a FastAPI modular monolith, deployed to Azure Container Apps
  (scale to zero). It owns the rules, contracts, limits and data access.
- PostgreSQL (Neon): stores the sanitised Sandbox datasets, feed runs and
  saved cases, behind per-client limits, an expiry sweep and a
  least-privilege role (ADR-021).
- Contracts in `docs/contracts/` and fixtures in `fixtures/` are versioned.
  An ADR accepts each one, and contract tests cover it.

Diagrams: [`docs/architecture/diagrams/`](architecture/diagrams/). Full
detail: [`context/architecture.md`](../context/architecture.md).

## The data boundary

- **Synthetic scenarios.** S01 to S08 come from one accepted fixture packet
  (ADR-016). They are not real customers or payments.
- **Plaid Sandbox.** Plaid's test environment is read once by an explicit
  import job. The results are pseudonymised, and the app never calls Plaid
  while it runs. Raw responses, tokens and account IDs never reach Git or
  the database.
- **Sparkov.** A public synthetic card-fraud corpus, used only to test the
  model pipeline end to end. Its scores are evidence on a case and never a
  performance claim.
- **Nothing real.** No real payment is executed, no account is blocked and
  no personal data is collected.

## Guardrails

- Deterministic rules decide. A model can only escalate, never clear a
  payment.
- Every live AI path is off by default in code and in the deployment
  template. The deployment verifier fails the release if that default
  changes.
- Live AI calls have their own concurrency, per-visitor and window limits
  and a timeout. There is no fallback to a second model.
- AI output is shown only when it passes its schema and a fact check.
  Everything else falls back to a labelled template or recorded playback.
- Public reads are rate limited. Errors are redacted to stable codes, and
  CORS allows only the deployed origin.

## What is deliberately not built

These are deferred after the portfolio release, not missing by accident:
Companies House enrichment, sanctions screening, an authenticated human
review workflow, health, replay and operational monitoring, WebSocket
transport, and a new model training pipeline. See
[`docs/scope/scope.md`](scope/scope.md).

## How it was built

Each feature starts as a spec under [`docs/specs/`](specs/) with acceptance
criteria and a verification plan. Architectural decisions are recorded as
ADRs (see [`context/progress_tracker.md`](../context/progress_tracker.md)).
The work is checked by API tests, Playwright browser tests at desktop and
mobile widths (including axe accessibility checks) and a pre-deploy gate in
CI.

## Run it locally

```bash
make check      # lint, build, browser tests and API tests
```

See the [README](../README.md) for setup and the optional private SDK.
