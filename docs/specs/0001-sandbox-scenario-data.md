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

- AC-1: A versioned contract and manifest define the sanitised S04 dataset,
  provenance, time boundary, and permitted feature values.
- AC-2: A parameterised PostgreSQL repository and SQL migration isolate
  datasets by scenario and fixture version.
- AC-3: A deterministic backend importer maps sanitised dated records to
  persisted events, feature snapshots, and daily aggregates without calling
  Plaid.
- AC-4: A typed, read only API returns S04 aggregate data and its provenance.
- AC-5: The Radar dashboard renders API supplied aggregates and retains a
  safe local fallback when the development API is unavailable.

## Ratify

This decision was recorded by /develop, not deliberated. Run `/architect
Sandbox scenario data` to deliberate and ratify it. Until then it stays
flagged as an owed decision; it does not block the build.
