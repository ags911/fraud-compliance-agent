# Configuration

This directory holds reviewable, versioned configuration artifacts—not secrets
and not unapproved production policy.

## Rules

- Keep secrets and environment-specific credentials in a local `.env` or the
  deployment secret manager, never here.
- Every artifact declares a `schema_version`, `status`, owner, and effective
  scope.
- `candidate` files document a proposed decision only. Runtime code must not
  consume them until an ADR and contract explicitly promote them.
- Do not add fraud thresholds, model promotion criteria, or action limits
  without an approved decision.
- When runtime configuration is approved, validate it at process start and log
  its version/checksum with each decision. Do not log secret values.

The two starter artifacts establish the format while Phase 0 resolves their
semantics.
