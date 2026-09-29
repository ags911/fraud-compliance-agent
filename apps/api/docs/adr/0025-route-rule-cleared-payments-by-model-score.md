# ADR-025 — Route rule cleared feed payments by model score

Status: Accepted  
Date: 2026-09-29  
Owner: Darren Gidado (product owner)  
PRD revision/sections: retired v0.3; `context/` is canonical  
Backlog task: F3, spec 0010  
Related decisions: ADR-004 (corpus, archived, Proposed), ADR-005 (model artifact and evaluation, archived, Proposed), ADR-006 (routing, authority and oversight), ADR-012 and ADR-015 (frozen event stream), ADR-020, ADR-023, ADR-024  
Repository scope: `apps/api/server/sandbox_data/`, `apps/api/server/sandbox_model/`, `apps/api/scripts/derive_score_routing_policy.py`, `apps/api/migrations/0008_score_routing.sql`, `config/sandbox-score-routing.v1.json`, `docs/contracts/`, `apps/web/src/console/`

## Context and evidence

ADR-024 made the Sparkov trained score display only evidence. The owner decided the demo may route by score and that Sparkov is its corpus. Measured on the dev dataset, normal S01 feed payments score below 0.03 and planted large payments to a familiar payee score 0.52 to 0.95. Spec 0010 holds the full design and measurements.

## Decision to be made

May a model score change a live feed payment's route, in which direction, at which thresholds, and how is that recorded?

## Decision

1. **Corpus.** Sparkov is the demo corpus for routing as well as display. This supersedes ADR-004's licensed corpus precondition for this synthetic demo only; any claim stays "Sparkov synthetic mechanics".
2. **Direction.** Deterministic controls stay first (ADR-006). The score may only raise a rule PASS to CHALLENGE or HOLD; it never lowers a rule decision. A database check enforces it.
3. **Thresholds (amends ADR-005's threshold protocol for this demo).** CHALLENGE at the lowest threshold with Sparkov test precision of at least 0.50; HOLD at the lowest with at least 0.90, else the top 0.1% alert rate. Derived by a local script from the committed model on the chronological test partition, written to `config/sandbox-score-routing.v1.json` (`policy_version` `score-routing-v1`), pinned by SHA256 in server code.
4. **Fallback.** Without the verified model and a matching policy, behaviour is exactly spec 0004's, with one warning.
5. **Outliers.** Every 20th S01 feed payment (offset 10) is a planted, labelled synthetic outlier (5 to 20 times S01's typical amount, familiar payee). This amends spec 0003's S01 schedule; S01's rule meaning (deterministic clear route) is unchanged. The page says the outliers are planted.
6. **Contracts.** Adds `public-showcase-events.v2` (basis `model_threshold` and a `model_routing` object on `run_result`) for model raised feed cases only; v1 stays frozen and is still what Run showcase emits (ADR-012, ADR-015 unchanged). `showcase-cases` becomes v1.1 and `sandbox-simulation` v1.1 with additive, optional fields.

## Consequences and ownership

- The demo shows a model catching what the rules cleared, with every decision explained, and cannot use the model to relax a control.
- The outliers are planted, so this proves mechanics, not detection; Sparkov to Sandbox domain shift remains.
- The owner owns the thresholds and any future policy version.

## Acceptance record

Accepted by: Darren Gidado (product owner)  
Date: 2026-09-29  
Notes: Accepted by the owner's explicit choice in a Claude Code session after the /architect design conversation for spec 0010 and a Codex cross check (fixes applied); recorded by Claude on that instruction.  
