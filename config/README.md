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

`decisioning-policy.candidate.json` and `model-release.candidate.json` are
starter artifacts that establish the format while Phase 0 resolves their
semantics.

`fast-path-model-training.v1.json` is different: it is a live, accepted artifact
that the offline evaluation library in `apps/api/modelling` reads. It holds the
seed, model hyperparameters, threshold-reporting grid, and synthetic-fixture
shape for the mechanics-only benchmark, so those parameters are reviewable
instead of living in notebook cells. It is never read by the served API, holds
no fraud threshold or promotion criterion, and its values describe the recorded
run in `docs/proposals/fast-path-model-release.candidate.json`: changing one
invalidates that report until approved mode is re-run and re-reviewed.
