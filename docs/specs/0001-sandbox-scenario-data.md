# 0001 · Sandbox scenario data

**Status**: Assumed
**Date**: 2026-09-23
**Authorized by**: product owner, during /develop

## Owed decision

The canonical time aware data contract, direct Neon PostgreSQL access
pattern, SQL migration format, and dashboard aggregate API require formal
architecture ratification.

## Assumption built on

Build a Sandbox only, deterministic S04 vertical slice. Use direct,
parameterised PostgreSQL access through `psycopg` and versioned SQL
migrations. The import and enrichment process is an explicit backend command,
not a browser action or scenario run. It accepts only sanitised input records,
creates pseudonymised transactions and a versioned feature snapshot, and
persists scenario scoped daily aggregates.

The product owner has authorised this slice to widen to S01 through S08. One
explicit Plaid Sandbox sync import creates a dated, sanitised common baseline.
The importer derives separate datasets by applying deterministic, versioned
scenario overlays whose inputs come from the accepted S01 through S08 fixture
packet. Every dataset persists one aggregate row for every UTC calendar day in
its declared range, including zero activity days. A separate explicit command
may append idempotent, deterministic simulated events to one scenario only;
it must recompute that scenario's affected feature snapshots and daily
aggregates without contacting Plaid. The API remains read only and internal.

The permitted feature values are category bucket, pseudonymised payee
reference, UTC calendar fields where time precision permits them, historical
account counts and mean amount, relative amount, one day and seven day
velocity, and prior payee and category counts. Missing time precision remains
unavailable. No raw provider payload, description, provider identifier,
access token, fraud label, or numeric risk score is persisted.

Expose a read only API that returns the selected scenario dataset metadata and
daily aggregates. The web dashboard reads that API through a typed hook and
passes typed data to its presentational chart. The migration is Neon ready via
`DATABASE_URL`; no Neon project, credentials, or live Plaid calls are created
or committed by this build.

## Code area

`docs/contracts/`, `apps/api/`, `apps/web/src/`, and supporting tests.

## Requirements

- AC-1: A versioned contract and manifest define the sanitised S01 through S08
  datasets, provenance, time boundary, permitted feature values, and overlay
  version.
- AC-2: A parameterised PostgreSQL repository and SQL migration isolate
  datasets by scenario and fixture version, preserve every calendar day, and
  enforce idempotency for simulated event appends.
- AC-3: An explicit Plaid Sandbox sync importer maps dated provider records to
  a sanitised common baseline without persisting raw provider data, then
  applies deterministic scenario overlays without calling Plaid again.
- AC-4: A deterministic backend command appends simulated events to one
  scenario dataset only and recomputes its affected features and aggregates.
- AC-5: A typed, read only API returns scenario aggregate data and provenance.
- AC-6: The Radar dashboard renders API supplied aggregates and retains a
  safe local fallback when the development API is unavailable.

## Ratify

This decision was recorded by /develop, not deliberated. Run `/architect
Sandbox scenario data` to deliberate and ratify it. Until then it stays
flagged as an owed decision; it does not block the build.
