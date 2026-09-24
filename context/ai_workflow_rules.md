# AI Workflow Rules

> Supplementary synthesis — see the authority note at the top of
> [`project_overview.md`](project_overview.md). This file does not replace
> the real instruction chain (`CLAUDE.md` → `AGENTS.md` →
> `docs/project-context.md`); it consolidates working conventions that are
> otherwise scattered across the PRD, ADRs, proposals, and the notebook/
> experiment docs. Root `AGENTS.md` was not modified to point here.

## Core Incremental-Development Rules

1. **Never rewrite existing working logic unless explicitly commanded in a
   feature spec.** Make the smallest cohesive change that satisfies the
   task; avoid opportunistic refactors, new dependencies, or invented
   product semantics (`docs/project-context.md`).
2. **Always reuse existing utility functions, hooks, and UI primitives**
   before writing new ones — the `cn()` utility, the `src/lib/*` hook
   pattern, shadcn primitives in `src/components/ui/`, the `StrictFiniteModel`/
   `StrictShowcaseModel` Pydantic base classes, and the per-feature exception
   hierarchy pattern in `apps/api/server/showcase_investigation/errors.py`.
3. **Work on exactly ONE feature spec at a time.** Do not bundle unrelated
   fixes, refactors, or scope expansions into the same change.

## Zero-Speculative-Logic Constraints (repository-wide, safety-critical)

These are restated, nearly verbatim, across the PRD, `docs/project-context.md`,
every ADR, and every proposal — treat them as hard rules, not style
preferences:

- **A proposal is not a contract.** "Proposed" means reviewable but not
  authorised; only an accepted ADR and its versioned contract artifact may
  govern implementation. A "decided" direction note inside a proposal
  (e.g. "continue with Sparkov," "pursue Option A") is a *direction choice*,
  not a contract acceptance — the underlying proposal remains unpromoted
  until it moves into `docs/contracts/` with a resolving ADR and tests.
- **Never invent a numeric threshold.** No fraud-model score threshold,
  PASS/CHALLENGE/HOLD boundary, or production sample-size requirement exists
  anywhere in the accepted documents; a threshold is "a policy/oversight
  decision, not a notebook default." MVP 3 has no numeric runtime score at
  all — do not add a fabricated placeholder even to make a UI feel complete.
- **Never invent metrics, trends, or figures.** No invented trend, time
  series, accuracy, precision, or false-positive figure — a chart appears
  only from recorded/approved data (the Sparkov benchmark, labelled as such,
  or an approved fixture scored by the decision engine). Zero, empty, and
  `Unavailable` are correct states until real data exists.
- **Unavailable ≠ zero/false.** A missing device/payee/session/timing fact
  is never manufactured from another source or coerced to a default value.
- **Never fabricate evidence, labels, cohorts, thresholds, or rollback
  rules to make a blocked artifact look complete.** Notebooks 09 and 10 are
  explicitly draft/not-run/blocked — "do not replace them with fabricated
  data, labels, observations, or acceptance criteria," and their presence
  is not itself an accepted release or monitoring contract.
- **An accepted experiment is not promotion authority.** Every experiment
  record template instance ends with: "An accepted experiment is not by
  itself approval to promote a model or modify a runtime policy."
- **Never silently turn planned into built.** A ✓ in the implementation
  plan means the screen/route exists in the repo today, not that every
  requirement in its row is met; a ◐ (F-stage) means repository-backed
  preparation that hasn't passed its gate — "a proposal alone can justify ◐
  only when its boundary and next gate are explicit; it can never justify
  ✓." `apps/api/tests/test_plan_status.py` fails when a screen ticked as
  built has no route in the app.
- **Never assume legacy A–F maps to target S01–S08.** Document any mapping
  explicitly before reusing a legacy scenario; a passing legacy
  characterisation test "never approves a risk rule or target scenario
  mapping."
- **If the required contract or approval does not exist, stop before
  inventing its semantics.** Propose the contract or ADR change instead
  (`docs/project-context.md`).

## Agent Tool / RAG Fixture Rules (the public showcase investigation)

- **Allowlist is fixed**: `get_payee_evidence`, `get_account_activity_evidence`,
  `get_device_session_evidence`. Policy, scoring, authority, mutation,
  external-provider, and recalled-case-memory capabilities are never agent
  tools.
- **Budget is fixed**: at most 3 tool calls per investigation, at most 1
  call per tool; S04 requires ≥2 distinct calls. Budget exhaustion is an
  incomplete investigation with no action — never a valid recommendation.
- **Every visible claim must cite an evidence ID returned by an
  allowlisted tool during that same run**; an unknown or missing citation is
  `invalid_output`. Never request or store hidden chain-of-thought.
- **Tools are bound server-side to the current scenario.** Tool results are
  untrusted input and can never inject a new tool, instruction, or authority
  claim.
- **Failures always resolve to one shape**: `investigation_status=incomplete`,
  fail-safe `HOLD`, `authority_status=not_evaluated`, no simulated action,
  one stable redacted `failure_reason` (`provider_unavailable | tool_failed
  | invalid_output | timeout | tool_budget_exhausted`). Never render this as
  a successfully completed HOLD.
- **Recorded vs. live is always visibly distinct** in the trace; recorded
  playback is the continuously public default, live Groq access is
  off-by-default and time/count/window-limited (see
  [`architecture.md`](architecture.md#5-accepted-architecture-invariants-from-accepted-adrs--these-are-built-rules)
  for the exact limits). Never fail over to a second LLM.

## Scenario / Fixture Testing Isolation Rules

- The accepted `fixtures/s01-s08/scenarios.v1.json` packet is the **sole**
  canonical synthetic fixture source for the database-free public-showcase
  runtime (ADR-016). The API may consume it only through a validating
  loader; the web app must receive contract events from the API, never
  import the fixture directly.
- `fixtures/contracts/*.examples.json` and `*.proposed.{valid,invalid}.json`
  are **contract-test evidence only**, not canonical runtime fixtures — a
  narrower acceptance than "canonical."
- Every fixture set needs a small manifest stating schema version, scenario
  IDs, source class (`synthetic` or sanitised provider sandbox), creation
  revision, and intended consumers. "A fixture is not canonical until its
  contract and scenario mapping are approved."
- Plaid-Sandbox-derived fixture facts must carry `source_class:
  "plaid_sandbox_derived"`, distinct from `synthetic` — currently accepted
  for exactly one item (S04's `get_account_activity_evidence`, ADR-019); no
  other scenario's facts are Plaid-derived, and S05's outage is
  provider-independent by design (never Plaid-derived).
- The deterministic Sandbox store does not change that accepted scope. The
  S04-only Neon proof was activated locally on 2026-09-23, and on 2026-09-24
  one explicit Plaid Sandbox sync import materialised a sanitised common
  baseline and isolated S01–S08 datasets through a Doppler-injected
  `DATABASE_URL`. The served API, scenario execution and chart reads still do
  not call Plaid. This must not be represented as an accepted runtime contract
  until a resolving ADR and versioned contract are accepted.
- Once approved, Sandbox import is a setup or refresh operation only.
  Scenario execution and chart reads must use a versioned, sanitised database
  dataset, never call Plaid directly. Every dataset needs a manifest with its
  scenario ID, fixture version, source class, seed or creation revision, time
  boundary, permitted fields, aggregate grain and intended consumers.
- A proposed live scenario display is driven only by a deterministic,
  scenario-scoped stored schedule. It must record the dataset revision, seed,
  run ID, sequence and append idempotency key before an event can become
  visible. Browser SSE is read only. It must not become a browser-owned timer,
  a path to call Plaid, or a way to inject an event body. A reconnect resumes
  from the durable sequence; it must not repeat events.
- A simulation reset is explicit and auditable. It creates a new run or
  declared reset lineage rather than deleting or overwriting an existing
  timeline. S06–S08 must retain their workflow-only semantics until their
  operational contracts provide relevant event facts.
- Raw Plaid responses, access tokens, provider IDs and transaction
  descriptions must never be committed or stored in the application dataset.
  Pseudonymised event and aggregate records must preserve event time,
  availability time and time precision rather than fabricating intraday time
  from a date-only value.
- Scenario datasets must be isolated. A run, refresh or replay for one
  scenario must not change another scenario's history, aggregates or expected
  result.
- The first selected design target is the S04 Sandbox-only proof on Neon
  PostgreSQL, with a 180-day historical baseline. Its permitted deterministic
  feature set is: sanitised category bucket, pseudonymised payee reference,
  UTC day and weekend values, UTC hour only when present, account-history
  counts and mean amount, relative amount, one-day and seven-day count and
  amount velocity, and prior payee and category counts. New fields require a
  versioned contract change and approval.
- Test-data isolation extends to notebooks: `apps/api/tests/sparkov_fixtures.py`
  generates seeded Sparkov-shaped synthetic data (plus 7 deliberately broken
  variants) so a test never reads the real Sparkov corpus.

## Single-Spec Scope Bounds (how proposals get promoted)

1. A change starts in `docs/proposals/` (or a numbered notebook +
   `docs/experiments/NN-*.md` record) with an explicit decision question and
   decision boundary — what the result IS allowed to influence and what it
   CANNOT authorise.
2. It is reviewed against the experiment-record template
   (`docs/experiments/experiment-record-template.md`): Metadata (status,
   owner, date, git commit, code/config revision, dataset/fixture manifest,
   **source class**: Synthetic / Sanitised provider sandbox / Approved
   secure dataset, time boundary, feature/schema version, artifact URI +
   checksum) → Question and decision boundary → Method → Results → Decision
   (accepted/rejected/needs follow-up, approver, follow-up/rollback, and the
   closing safety clause above).
3. Only once an ADR resolves it does it become a versioned artifact under
   `docs/contracts/`, `fixtures/`, or `config/*.v1.json` (dropping the
   `.proposed`/`.candidate` suffix) — with contract tests added in the same
   change. The draft and an accepted copy must never coexist as competing
   sources of truth.
4. Application code must never import `docs/proposals/` content at runtime.

## Notebook and Experiment Conventions

Every notebook (01–10) and its matching `docs/experiments/NN-*.md` record
begins with: purpose, decision owner, status, non-goals, input sources +
time boundary + permitted data class, required env-var **names only** (never
values), expected sanitised outputs, and a reproduction command + current
Git revision. It ends with: findings and limitations, availability/unknowns
(never inferred values), links to the generated proposal/fixture manifest/
experiment record, and a decision recommendation explicitly marked
`proposed` — "no notebook self-approves a contract, policy, or model."
Never commit: access tokens, secrets, PII, live account exports, raw
provider payloads, downloaded corpora, trained model weights, or committed
cell outputs on source notebooks.

Cross-doc correspondence: each experiment doc 01–10 in `docs/experiments/`
corresponds 1:1 to the like-numbered notebook. Current status: 01–08
completed/proposal-prepared (Sparkov mechanics benchmark run and reported);
**09 and 10 are draft/not run**, blocked pending accepted fixtures/protocol/
release contracts.

## Document Lifecycle (how the docs tree itself is governed)

| Material | Authority | Lifecycle |
|---|---|---|
| `docs/project-context.md` | Canonical repository guidance | Keep current; link to it, don't repeat it |
| `docs/product/prd.md` | Candidate product baseline | Promote once its approval record (§12) is complete |
| `docs/contracts/` | Accepted integration contracts only | Change through an ADR + matching tests |
| `docs/product/implementation-plan.md` | Candidate delivery planning | One active plan; cannot approve PRD/contract/post-gate scope |
| `docs/proposals/` | Non-binding review material | Promote accepted decisions; archive closed proposals |
| `docs/experiments/`, `notebooks/` | Reproducibility evidence | Retain as evidence; never product authority |
| `docs/architecture/` | Structural description | Keep in step with PRD/plan; approves nothing |
| `docs/audits/`, generated inventories | Point-in-time control evidence | Keep the current standard; date-stamp audit snapshots |

"Do not add another planning document when an existing canonical or active
plan can be updated." "Approval status, owner, and supersession should be
visible in the document itself."

## Data Governance Promotion Boundary

"No notebook result, candidate configuration, or locally trained artifact is
a runtime model by default." Every experiment/candidate model needs
recorded lineage (git commit, dataset/fixture manifest + source class + time
boundary, feature/schema version, metrics/limitations/decision, artifact
checksum, named owner/approval state) before promotion. Plaid access
tokens, raw Sandbox payloads, account identifiers, and enrichment outputs
stay outside Git; a notebook may produce a sanitised fixture only after
documenting the exact mapping and removing identifying fields, and must
never silently substitute generic provider data for an operator-selected
scenario. See [`architecture.md`](architecture.md#10-data-governance-rules-docsdata-governancemd-current-policy-not-proposed)
for the full storage-class table.
