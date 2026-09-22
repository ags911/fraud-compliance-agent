# Plaid Sandbox-derived showcase fixtures — proposal

Status: **S04's account-activity evidence built and accepted by [ADR-019](../../apps/api/docs/adr/0019-accept-plaid-sandbox-derived-account-activity-evidence.md) (2026-09-22): one Plaid-Sandbox-derived evidence item, live-selectable only, verified against the real API and a live Groq run. S01/S02's facts-derivation rules from [ADR-018](../../apps/api/docs/adr/0018-accept-plaid-sandbox-showcase-fixture-enrichment.md) were found, while building this, to change values the runtime never reads for those two scenarios (their route comes from a hardcoded scenario lookup, not from `facts`) and were not pursued. This document's "What each S01–S05 signal could come from" table and options below are kept as a record of that comparison.**
Decision supported: whether, and how, the S01–S05 showcase may use Plaid Sandbox-derived facts instead of hand-written synthetic ones.

## Question

Can the showcase replace its synthetic scenario data with "real data from the
Plaid sandbox"?

## Short answer

Partly, and only through recorded, sanitised fixtures. Three things limit it:

1. **Sandbox data is test data, not real data.** It must be labelled
   "Plaid Sandbox test data" and never presented as customer, live, or
   production data (project context, safety rules).
2. **The accepted boundary forbids a runtime connector.** The mapping artifact is
   `accepted_for_sandbox_analysis_only`. The PRD register lists a runtime
   connector and a demo dependency as excluded for Plaid Sandbox. The public
   container is also database-free and must not hold Plaid secrets.
3. **Plaid has no source for several scenario signals** (device, session,
   outage, review, replay), and no fraud labels or scores.

## What each S01–S05 signal could come from

| Scenario signal | Plaid Sandbox source | Assessment |
| --- | --- | --- |
| `amount_minor`, `currency` (all) | `amount`, `iso_currency_code` | Possible after a money-normalisation rule. Currency must be checked: the fixtures are GBP and Sandbox commonly returns USD. |
| `direction` (all) | Sign of `amount` | Possible after an approved direction policy (currently a candidate derivation). |
| `payee_history` (S01, S03) | Repeat of `merchant_name` / counterparty across sandbox history | A proxy only. `payee_reference` is unavailable by default, so a rule is needed. |
| `velocity_state` (S02) | Transaction counts per day | Daily granularity only. `date` carries no time of day. |
| `balance_state` (S03, APP drain) | A balance endpoint | Outside the accepted scope, which covers `/transactions/sync` added transactions only. Needs a scope extension. |
| `context_state`, device, session (S04) | None | Not available from Plaid. Stays synthetic and labelled. |
| Account-activity evidence (S04) | Transaction history | The one tool with no S04 payload today. A plausible Plaid-derived section. |
| `dependency_state` (S05) | None | An injected outage, independent of Plaid. Stays synthetic. |

Known Sandbox limits from experiments 01–03: date precision only (no event
time), no established modification or pending-to-posted semantics, and no
per-transaction revision.

## Options

- **A. Hybrid, recorded and sanitised (recommended).** Derive facts locally from
  Sandbox, commit only sanitised values with provenance and a checksum, and let
  the runtime consume the committed fixtures as it does today. Each fact carries
  its own source class (`plaid_sandbox_derived` or `synthetic`), and the UI
  labels which is which.
- **B. Live Plaid calls at runtime.** Rejected: it needs secrets in the public
  image, breaks zero-retention, and is excluded by the PRD register.
- **C. Keep everything synthetic.** Valid and safe, but does not show the Plaid
  integration the project describes.

## What does not change under any option

- **Dashboard figures.** The mixed 30-day portfolio (for example 12,842
  transactions) is not real and cannot become real: there is no runtime score,
  threshold, or routing engine to produce PASS, CHALLENGE or HOLD counts.
  It stays zero, `Unavailable`, or clearly labelled until F3a. Plaid could at
  most supply observed transaction counts, labelled as such, never decisions.
- **Training and thresholds.** Plaid Sandbox is not a labelled training corpus,
  and no score, threshold or model follows from it.
- **Authority.** Recommendation, authority, oversight and action stay separate.
  Payment actions stay simulated.

## Decisions needed before any build

Proposed defaults are given for each; none is approved until the project
owner confirms or overrides it. Defaults are chosen to be the smallest honest
rule available, reusing wording already sitting in the accepted mapping
proposal rather than inventing new policy.

1. **Approve Option A, or choose B or C.**
   Decided by the choice to pursue Plaid alongside Sparkov (2026-09-22):
   **Option A.**
2. **Money normalisation rule** — Plaid's `amount` is a decimal in the
   account's major currency unit (e.g. `42.00`).
   **Default:** `amount_minor = round(amount * 100)`. This assumes a
   2-decimal currency, which covers every currency Sandbox test accounts use;
   it would not hold for a zero-decimal currency like JPY, and that limitation
   is recorded rather than handled.
   **Currency:** use Plaid's `iso_currency_code` as returned, unconverted.
   **Do not force it to GBP.** Sandbox's default test accounts commonly return
   `USD`; if so, the derived fixture's `currency` field says `USD`, honestly,
   rather than silently relabelling Sandbox data as the scenario's original
   currency. If a GBP-labelled fixture is wanted, that means choosing a
   Sandbox custom user configured with GBP accounts, not converting the
   currency code after the fact.
3. **Direction policy** — the accepted mapping proposal already documents
   Plaid's own convention and stops short of adopting it. **Default:** adopt
   it as written: a positive `amount` is money leaving the account
   (`direction: outbound`), negative is money arriving (`inbound`). All five
   scenario facts today are `"direction": "outbound"`, so this only needs to
   hold for outbound test transactions to be usable, though it is stated in
   full for completeness.
4. **Payee-history proxy rule** — the mapping proposal already says not to
   persist merchant or counterparty names. **Default:** never store
   `merchant_name` or `counterparties[].entity_id` in a fixture. Derive only
   the same enum the fixtures already use (`payee_history: "established"` or
   `"new"`) from whether a pseudonymised counterparty identifier repeats more
   than once in the pulled window. No name-shaped value ever reaches a
   committed file.
5. **Day-level timing** — **Default: accepted as sufficient.** No S01–S05
   fact today expresses a time of day (only a `source_revision` string), so
   Plaid's date-only `date` field loses nothing the current fixtures use.
6. **Balance endpoint scope extension (needed for S03)** — **Default: defer,
   do not extend scope now.** Extending the accepted analysis-only boundary to
   a second Plaid product is a bigger step than deriving facts from data
   already in scope, for the benefit of one field on one scenario. S03's
   `balance_state` stays synthetic (`"synthetic-account-drain"`) until this is
   revisited on its own.
7. **Which scenarios move first** — **Default: S01, S02, and the S04
   account-activity evidence section** (the one tool with no accepted payload
   today). S03 stays synthetic per (6). S05 is never Plaid-derived: it is an
   injected outage, independent of any real data source, by design.

## Sequence once approved

1. Record the decisions above in an ADR and update the mapping's scope.
2. Run the local, zero-retention notebook with the Doppler-held Sandbox
   credentials and write a sanitised artifact with a SHA-256. No raw payloads,
   identifiers or secrets are committed.
3. Add versioned fixtures (`scenarios.v2`) with per-fact source class, and
   contract and sanitisation tests written first.
4. Accept the fixture set for runtime consumption in the same change that
   updates the implementation plan.
5. Update UI labels and the Explain preview to name each fact's source.

## Risks

- Sandbox transactions may not produce the intended S02 or S03 shapes. Plaid's
  custom Sandbox users can script them, but scripted data are test cases, not
  independent evidence, and must be described that way.
- Mixing sources in one scenario can read as more real than it is. The
  per-fact label is the control.
