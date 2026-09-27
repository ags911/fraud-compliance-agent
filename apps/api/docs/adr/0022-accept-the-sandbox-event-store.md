# ADR-022 — Accept the Sandbox event store

Status: Proposed  
Date: 2026-09-27  
Owner: Darren Gidado (product owner)  
PRD revision/sections: Candidate v0.3  
Backlog task: F3a deterministic Sandbox event data (spec 0001); Scenario analytics and deterministic live-feed overlay (spec 0003)  
Related decisions: ADR-002, ADR-003, ADR-009, ADR-016, ADR-017, ADR-020 and ADR-021  
Repository scope: `apps/api/server/sandbox_data/`, `apps/api/migrations/0001_sandbox_scenario_data.sql`, `apps/api/migrations/0002_sandbox_baselines_and_appends.sql`, `apps/api/scripts/import_plaid_sandbox_history.py`, `docs/contracts/sandbox-scenario-dataset.v1.schema.json`, `docs/contracts/sandbox-scenario-analytics.v1.schema.json`

## Context and evidence

Spec 0001 is Assumed, not ratified. Its locally activated F3a slice imports a
finite Plaid Sandbox history only through an explicit preparation command,
sanitises it, and stores scenario-isolated data in PostgreSQL. The API and
Risk Console then read that stored data; neither an operator run nor a chart
request calls Plaid.

The 2026-09-24 import stored a 331-event sanitised common baseline from
2026-06-29 through 2026-09-23 and materialised S01–S08. Every scenario has
all 87 UTC calendar days in that boundary, including zero-activity days.
S01–S05 have their deterministic fixture overlay; S06–S08 retain the common
baseline pending controlled scenario facts. This is local Sandbox evidence,
not a fraud corpus, production history, or a claim about a real customer.

The built store has these boundaries:

- `sandbox-scenario-dataset.v1` defines versioned, sanitised dated event
  input; `sandbox-scenario-analytics.v1` defines its read-only, time-aware
  aggregate output. Both include scenario and fixture provenance, a declared
  time boundary, and zero-activity days in the served aggregate series.
- `scripts/import_plaid_sandbox_history.py` reads one complete Sandbox
  `/transactions/sync` history in memory, HMAC-pseudonymises permitted payee
  facts, validates the sanitised records, and derives a shared baseline plus
  deterministic scenario overlays. It never commits raw provider responses.
- Provider transaction, account and customer identifiers, raw descriptions,
  access tokens, merchant names, fraud labels and numeric risk scores are
  excluded. The application store contains only permitted dated facts,
  integer-minor amounts, category buckets, pseudonymised payee references,
  provenance and derived aggregates.
- Migrations `0001_sandbox_scenario_data.sql` and
  `0002_sandbox_baselines_and_appends.sql` supply dataset/event/aggregate
  persistence. They are rerunnable because the migration runner records no
  applied-migration state.
- Spec 0003's live simulation is an overlay, not an import mutation: shown
  scheduled payments are combined with the selected run's base analytics at
  read time. A run therefore starts from the same imported facts, and does
  not append a provider-shaped record to the baseline.

`context/architecture.md` §4 and the F3a record in
`context/progress_tracker.md` describe this as implemented locally but not an
accepted runtime source. They also record that aggregation grain and retention
still need an explicit decision. ADR-021 remains Proposed and separately
governs whether any database-backed feature may be enabled publicly.

## Decision to be made

Should the versioned, sanitised Plaid Sandbox scenario store become the
accepted local and internal runtime source for scenario replay and analytics,
with the time-aware contracts, mapping, retention and overlay model below?

## Constraints

- Plaid is an import-only source. No browser request, scenario run, worker,
  API read, replay or chart may call Plaid.
- The store is Sandbox-only synthetic reference data. It must not become a
  fraud-training corpus, a live provider integration, or evidence of real
  payment activity or fraud performance.
- Raw provider payloads, identifiers, tokens and descriptions stay outside
  Git and outside the application store. Pseudonymised values may not be
  reversed by the API, browser or logs.
- Dataset, scenario and fixture-version isolation is mandatory. A refresh or
  overlay for one scenario must not alter another scenario's imported data.
- This ADR cannot authorise a public database, an operational F3 store, a
  runtime score, a route change, a payment action or a change to frozen
  showcase stream contracts.

## Options considered

1. **Keep the store as an assumed local experiment.** The built importer,
   migrations and analytics remain useful evidence, but no runtime surface may
   represent them as an accepted source.
2. **Accept the sanitised Sandbox store for local and internal runtime use
   (proposed).** Freeze the two v1 schemas, import boundary, retention and
   overlay invariants below; keep public use subject to ADR-021.
3. **Accept it as a public or operational data source now.** This would need
   ADR-021 acceptance and guards, an operational persistence decision, and a
   privacy and hosting decision. None is resolved here.

## Proposed decision

Option 2.

1. Accept `sandbox-scenario-dataset.v1.schema.json` and
   `sandbox-scenario-analytics.v1.schema.json` as the authoritative schemas
   for the sanitised, time-aware Sandbox source and its aggregate read model.
2. Accept the explicit importer as the only Plaid boundary. It may persist
   only the permitted, sanitised fields and HMAC-pseudonymised payee
   references; it must not retain a provider identifier or raw response.
3. Accept migrations 0001 and 0002 as the local/internal persistence basis.
   A dataset remains available until it is explicitly replaced by a validated,
   scenario-local import; replacement removes its dependent stored data in
   child-first order. A referenced dataset is not replaced while foreign keys
   preserve simulation-run history.
4. Retain only the declared finite time boundary of each active imported
   dataset and its derived aggregates. Import manifests must record the
   boundary, fixture/baseline/overlay/enrichment versions and permitted
   fields; a new duration, field, precision or aggregation grain requires a
   versioned successor and ADR review.
5. Accept the spec 0003 overlay model: scheduled, shown simulation payments
   are read-time additions to a run's analytics only. They never mutate the
   imported baseline or cause a provider call.
6. Keep the public deployment database-free unless ADR-021 is accepted and
   its guards are verified. This record does not supersede ADR-016 or
   ADR-017's public boundary.

## Contracts and invariants

- **Time-aware and complete.** Event and available times preserve their
  documented precision; every served UTC day in `time_boundary` has one
  aggregate row, including zero activity.
- **Sanitised by construction.** Events have no raw provider identifier,
  description, merchant name, account/customer ID or access token.
  `payee_reference` is pseudonymised; provider identities never leave the
  importer process.
- **Versioned provenance.** Every dataset and analytics response identifies
  the scenario, fixture version, baseline, overlay, enrichment and declared
  time boundary needed to reproduce its display.
- **Minimum retention.** The runtime store retains only the active,
  sanitised dataset and derived aggregates within that declared boundary; it
  holds no raw import archive. Replacement is explicit and validated, never a
  side effect of viewing or running a scenario.
- **Scenario isolation.** Reads and writes are constrained by scenario and
  fixture version. A deterministic overlay is scoped to its simulation run;
  one run's shown payments cannot change another run or the baseline.
- **Read-only consumers.** API analytics, charts and replay consume stored
  facts and derived aggregates. The browser cannot upload events, choose a
  Plaid record, alter an overlay or force a refresh.
- **No decision authority.** Data from the store may support truthful
  analytics and deterministic replay only. It cannot introduce a model
  score, alter the existing deterministic feed recommendation, or approve or
  execute a payment.

## Verification

Before acceptance:

- `make api-lint`, `make api-docstring-lint` and `make api-test` pass without
  a database or Doppler-injected credentials.
- Schema and repository tests prove permitted-field validation, pseudonymised
  payees, scenario isolation, zero-day aggregates, child-first replacement,
  and that the API serves the newest validated dataset only.
- The importer is exercised only with authorised Sandbox setup credentials;
  its output is inspected to confirm it contains no raw provider identifiers,
  payloads, descriptions or tokens.
- Both migrations apply twice without error to an isolated local database.
- A local scenario run proves the overlay changes only its requested
  analytics response and leaves the imported baseline unchanged.

After acceptance, contract-drift tests must read the two v1 schema paths and
fail if an API or importer payload changes without a versioned successor.

## Consequences and ownership

- F3a gains an approved local/internal source for deterministic time-series
  charts and scenario replay, rather than relying on per-run Plaid calls.
- The repository takes ownership of the importer, migrations, schema
  compatibility and explicit replacement process for this narrow source.
- This does not accept a general PostgreSQL operational store (ADR-009),
  public database use (ADR-021), or any new fraud-model claim.
- Owner: the product owner accepts or rejects this record and owns future
  changes to the data boundary, retention, aggregation grain and schemas.

## Open questions

- Is retaining only an active declared dataset sufficient for replay needs,
  or should a future accepted design retain superseded sanitised versions and
  define a longer retention schedule?
- Which manifest format and review process should record a new imported time
  boundary before an explicit refresh?
- If ADR-021 is accepted, do its public storage ceiling and sweep requirements
  need dataset-specific values in addition to this record's active-dataset
  retention boundary?

## Acceptance record

Accepted by:  
Date:  
Notes:  
