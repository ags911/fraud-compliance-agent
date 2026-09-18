# Experiment: Plaid Sandbox source inventory

| Field | Value |
| --- | --- |
| Status | Completed — observation ready; mapping decision pending |
| Owner | Data/integration lead (to assign) |
| Date | 2026-09-16 |
| Git commit | Unavailable — monorepo has no initial commit yet |
| Code/config revision | `notebooks/01-plaid-sandbox-source-inventory.ipynb` |
| Dataset or fixture manifest | Local Plaid Sandbox observation; no raw dataset in Git |
| Source class | Sanitised provider sandbox observation |
| Time boundary | Plaid Sandbox observation completed 2026-09-16T01:03:51Z |
| Feature/schema version | `0.1-draft` canonical contract |
| Artifact URI + checksum | `docs/proposals/plaid-source-inventory.observation.json` · `57993b24987cb5012b69df26264484494606bdbc337ef1a984481ba1b980fdf1` |

## Question and decision boundary

Which transaction/source field names, types, nullability, and timestamp-format
observations are available from the selected Plaid Sandbox flow? The result may
inform ADR-003 and the mapping draft; it cannot approve a canonical mapping,
feature, policy, model, or production integration.

## Method

Run the notebook using the ignored local `apps/api/.env`, which contains Plaid
Sandbox credentials. The notebook uses a fresh Sandbox test item and writes
only a field/type/count inventory to
`docs/proposals/plaid-source-inventory.observation.json`. Raw responses remain
in memory and are neither printed nor committed.

## Results

The bounded probe reached `HISTORICAL_UPDATE_COMPLETE` in 11.54 seconds. It
read six Sync pages, restarted pagination once after the documented mutation
condition, and observed 331 added Sandbox transactions. The sanitised report
contains 83 field paths and schema metadata only; it contains no raw provider
values, account identifiers, tokens, or credentials.

The observation establishes provider field availability in this specific
Sandbox flow only. It does not establish field meaning, production freshness,
canonical mapping, correction semantics, or feature eligibility.

## Decision

- Decision: Observation accepted as input to the P0-03 mapping review; no
  canonical field or feature is approved yet.
- Approver: Unassigned
- Follow-up / rollback: Review the sanitised report, complete notebook 02’s
  lifecycle probes, then use notebook 03 to propose field mappings.
