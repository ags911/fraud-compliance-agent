# ADR-026 — Allow an AI written dashboard overview on the public showcase

Status: Accepted  
Date: 2026-09-29  
Owner: Darren Gidado (product owner)  
PRD revision/sections: retired v0.3; `context/` is canonical  
Backlog task: F4a, spec 0011  
Related decisions: ADR-015 (frozen public showcase investigation contract), the owner approved live provider policy in `config/public-showcase-investigation.v1.json` (2026-09-20), ADR-021 (public database guards), ADR-024, ADR-025  
Repository scope: `apps/api/server/sandbox_data/`, `apps/api/server/showcase_investigation/provider.py` (reused), `config/public-showcase-overview.v1.json`, `docs/proposals/schemas/sandbox-overview.v0.proposed.json`, `docs/contracts/`, `apps/web/src/console/`, `infra/azure/main.bicep`

## Context and evidence

The public showcase calls a live model only for Run showcase, under `config/public-showcase-investigation.v1.json`: a server side switch that is off by default, per visitor and per window limits, a timeout, validated structured output and a recorded fallback. That config approves live investigations only, and it forbids always on anonymous live use until a reliable provider spending limit exists. The owner asked for an AI written overview of the dashboard (F4a). Spec 0011 holds the full design.

## Decision to be made

May the public showcase call the live model a second time, to write an overview of the dashboard, and under what controls?

## Decision

1. **Scope.** A new internal route, `POST /sandbox/scenarios/{scenario_id}/overview`, writes a headline and 3 to 5 points about S01 to S05 or the Mixed feed. It is read only: it never changes a route, a recommendation, a case or a feed.
2. **Inputs.** The server builds the facts from stored data only. The browser sends the scenario and, in the body, the range and optionally its own run ID; never figures or text, and never the run ID in a URL. Another browser's run or cases never enter the facts.
3. **Model.** The same allowlisted Groq model and key as Run showcase, with no alternate model and no fallback provider. Temperature 0, JSON output, at most 400 output tokens (the provider helper gains a token limit argument; investigations keep 800).
4. **Fact check.** Live output is shown only when it has the expected shape and every figure in it is a token the facts write, character for character (counts, money, dates); otherwise the template summary is shown.
5. **Switch and limits.** A separate switch, `SHOWCASE_OVERVIEW_LIVE_ENABLED`, off by default in code and in the deployment template. Separate, process local limits in `config/public-showcase-overview.v1.json`: 1 concurrent, 3 per visitor per 10 minutes, 20 per 30 minute window, 20 second timeout. Every request also passes an always on per visitor read limit. The live checks run switch, then provider readiness, then admission, so a refused call never uses a slot. The overview and Run showcase never share counters.
6. **Fallback.** A template summary from the same facts, by fixed rules, labelled "No AI model was used". It is what the public site shows while the switch is off.
7. **Labelling.** Every overview states its source. Live: "Written by an AI model (<model>) from the synthetic figures on this page. It can be wrong and it never decides anything."
8. **Storage and logs.** Nothing is stored. Only fixed category log lines; no facts, prompt or output are logged.
9. **Contract.** `sandbox-overview.v1` is promoted from `docs/proposals/schemas/sandbox-overview.v0.proposed.json` when this record is accepted.

## Consequences and ownership

- The dashboard gains a plain language reading of its figures, and the public site still answers with the model off.
- A second live model use to operate: its switch, limits and config must stay accurate, and the owner decides when to switch it on.
- Before switching it on in production, the owner confirms a Groq spending limit or budget alert, as the showcase config already requires for anonymous live use.
- The owner owns the switch, the limits and any change to the label.

## Acceptance record

Accepted by: Darren Gidado (product owner)  
Date: 2026-09-29  
Notes: Accepted by the owner's explicit choice in a Claude Code session after the /architect design conversation for spec 0011 and a Codex cross check (16 fixes applied); recorded by Claude on that instruction. Switching live overviews on in production remains a separate owner decision, after a Groq spending limit or alert is in place.  
