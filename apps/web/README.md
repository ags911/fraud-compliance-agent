# Averlynx

A live console for operating [arbiris-sdk](https://github.com/ags911/arbiris-sdk)'s
`fraud_compliance_agent_v2` LangGraph agent — submit a transaction (or pick a
preset scenario) and watch it flow through Data Ingest → Sim A (deterministic
fraud scoring) → Sim B (deterministic + LLM-assessed APP scam risk) →
Counterfactual (GDPR Article 22) → Evidence Pack, node by node, in real time.
Each completed node shows the real signed AARF v0.2 intent record it produced
— schema version, reverse-domain agent id, signature, and the full plain-English
reasoning chain — not a mocked summary.

Talks to the [Fraud Compliance Agent API](https://github.com/ags911/fraud-compliance-agent-api)
over Server-Sent Events. This repo has no Python dependency at all — it's a
pure React/TypeScript client.

Includes a "simulate LLM outage" toggle that forces Sim B's Stage 2 model
call to fail on demand, so you can watch the pipeline's fail-safe HOLD
behaviour trigger live instead of just being told it exists.

## Stack

Vite + React + TypeScript + Tailwind CSS v4 + [shadcn/ui](https://ui.shadcn.com/).

## Setup

```bash
npm install
cp .env.example .env   # point VITE_API_BASE_URL at your backend
npm run dev
```

Requires the [API](../api) running (locally or deployed) at that URL.

## Deploying

The public showcase targets Azure Static Web Apps (see the hosting section of
the [PRD](../../docs/product/prd.md)); it is not configured yet.
`public/staticwebapp.config.json` provides the single-page-app fallback that the
host needs. `VITE_API_BASE_URL` is a public, non-secret build-time setting: set
it to the deployed API's origin.
