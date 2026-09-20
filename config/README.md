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

`public-showcase-investigation.candidate.json` records the approved-for-
preparation MVP 3 controlled-window limits: live mode defaults off, one live
investigation at a time, two per observed client per 10 minutes, ten per
process enablement window, a 30-minute window, and a 45-second overall timeout.
It explicitly records that process-local counters reset on restart and are not
durable quota enforcement. Runtime consumption remains forbidden until the
investigation contract and implementation are accepted.

The same candidate file records the D9 provider boundary: Groq is the sole live
provider; credentials and allowlisted model selection stay server-side; every
live run records its provider and model identifier; only validated structured
contract fields enter ephemeral run state; and unavailable live execution
falls back to labelled playback rather than another LLM. It also prohibits raw
prompt, raw provider-output and hidden-reasoning logging.

Its D10 migration section keeps the private-SDK A–F workflow local-only until
the new contracts, runtime evaluations, browser acceptance and public-container
checks pass. Cutover is still an explicit decision. Retirement removes the
legacy workflow from active code and dependencies but preserves its
characterization documents and Git history.

`fast-path-model-training.v1.json` is different: it is a live, accepted artifact
that the offline evaluation library in `apps/api/modelling` reads. It holds the
seed, model hyperparameters, threshold-reporting grid, and synthetic-fixture
shape for the mechanics-only benchmark, so those parameters are reviewable
instead of living in notebook cells. It is never read by the served API, holds
no fraud threshold or promotion criterion, and its values describe the recorded
run in `docs/proposals/fast-path-model-release.candidate.json`: changing one
invalidates that report until approved mode is re-run and re-reviewed.
