# Architecture decision records

ADRs describe consequential backend and cross-application decisions. `Proposed`
means reviewable but not authorised; only an accepted ADR and its versioned
contracts may govern implementation. Supersede accepted records rather than
rewriting their history.

| ADR | Subject | Status |
| --- | --- | --- |
| [001](0001-application-sdk-package-boundary.md) | Application, SDK and package boundary | Proposed |
| [002](0002-canonical-domain-contract.md) | Canonical domain contracts | Proposed |
| [003](0003-plaid-mapping-feature-feasibility.md) | Plaid mapping and feature feasibility | Proposed |
| [004](0004-fraud-target-corpus.md) | Fraud target and corpus | Proposed |
| [005](0005-model-artifact-evaluation-contract.md) | Model artifact and evaluation contract | Proposed |
| [006](0006-router-authority-oversight.md) | Routing, authority and oversight | Proposed |
| [007](0007-telemetry-signed-evidence.md) | Telemetry and signed evidence | Proposed |
| [008](0008-inventory-oversight-pack-linkage.md) | Inventory, oversight and pack linkage | Proposed |
| [009](0009-postgresql-transitions-recovery.md) | PostgreSQL transitions and recovery | Proposed |
| [010](0010-identity-roles-deployment.md) | Identity, roles and deployment | Proposed |
| [011](0011-operational-acceptance-versioning.md) | Operational acceptance and versioning | Proposed |
| [012](0012-freeze-showcase-api-contract.md) | Current showcase API contract | Accepted |
| [013](0013-adopt-local-first-f3-boundaries.md) | Local-first F3 preparation boundary | Accepted for preparation only |
| [014](0014-adopt-public-safe-showcase-investigation-boundary.md) | Public-safe showcase investigation boundary | Accepted for scoped preparation only |
| [015](0015-freeze-public-showcase-investigation-contract.md) | Public-showcase investigation HTTP and SSE contract | Accepted |
| [016](0016-accept-public-showcase-scenario-fixtures.md) | Public-showcase S01–S08 synthetic fixtures | Accepted |
| [017](0017-implement-public-showcase-runtime.md) | SDK-free public-showcase runtime and safeguards | Accepted |

The proposed ADRs deliberately retain unassigned specialist owners and pending
acceptance records. ADR-013 authorises F3 preparation, ADR-014 authorises the
narrower public-investigation preparation, and ADR-015 accepts only its
cross-application HTTP/SSE contract. ADR-016 accepts only the synthetic
showcase fixture values and preserves the deferred S06–S08 operational
boundary. None approves the detailed operational semantics in ADR-001–011 or
the deferred operational runtime.

ADR-017 implements the narrower database-free public runtime for S01–S05. It
does not approve F3/F4 operations, browser cutover, Azure deployment, or a Groq
model identifier.
