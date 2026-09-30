# 0011. AI operations overview: decision record

## Context

The Risk Console shows a scenario through four figure cards, a recommendations chart, an activity chart, a live routing board and a cases table. Each is accurate, but a visitor has to read them all and join them up to answer the simple question "what is happening in this scenario?". The owner asked for an AI written overview of the dashboard (F4a, scope feature 5).

The project already calls a live model in one place. Run showcase (F4) can ask an allowlisted Groq model to investigate a scenario, behind a server side switch that is off by default, strict per visitor and per window limits, a timeout, structured output validation and a recorded fallback. Its accepted config forbids always on anonymous live use until a reliable provider spending limit exists. The public site runs with that switch off, so most visitors never see a live model.

Three forces shape an overview. It is public and anonymous, so it must not invite prompt injection or run up cost. It describes numbers, and a language model can state numbers that are close but wrong, which on a fraud demo reads as a factual error. And the public site scales to zero, so anything live adds to an already slow first load.

Workspace: the monorepo's `apps/api` (FastAPI) and `apps/web` (React). No new provider or dependency.

## Options considered

### Option 1: Template summary only

The server writes the overview from the figures by fixed sentence rules; no model is involved.

**Pros**:
- Free, instant, always correct, nothing to switch on or limit.

**Cons**:
- It is not an AI overview, which is what the owner asked for, and it reads mechanically.

### Option 2: Server built facts, fact checked model output, template fallback (chosen)

The server gathers the figures; when its own switch is on, the allowlisted Groq model writes a headline and points; every number is checked against the figures; the template is the fallback in every other case.

**Pros**:
- Shows real AI writing when enabled, and a useful answer when not.
- The model sees only server built facts, so there is no injection path, and it cannot put an invented figure on the page.
- Reuses the provider, key and model already approved for Run showcase.

**Cons**:
- The most parts to build: facts builder, template, live call, checks, limits.
- The server must reproduce the dashboard's window and card rules.

### Option 3: Model only, from what the browser sends

The browser posts the figures it shows; the server forwards them to the model and returns its text.

**Pros**:
- Simplest server; the overview matches the screen exactly.

**Cons**:
- Anyone can post invented figures or instructions into the prompt.
- With the switch off (the public default) there is nothing to show.

### Option 4: One shared overview per scenario and day

A single overview per scenario, range and day, cached and shown to every visitor.

**Pros**:
- At most a handful of model calls a day, so almost no cost.

**Cons**:
- It cannot include the visitor's own feed and cases, which the owner wants covered, and it needs storage and invalidation.

## Rationale

Option 2 is the only one that delivers a real AI overview without giving up the project's rules for the public site. The owner chose each part of it directly. The server builds the facts, which removes prompt injection from a public endpoint. Every number is checked, because a plausible wrong figure is the most damaging failure on a fraud demo. The template fallback means the default public site, where live mode is off, still answers usefully and honestly. A separate switch and separate limits keep the overview and Run showcase independent: either can be enabled without the other, and a busy overview cannot block an investigation.

Storing nothing keeps the public database and its privacy note unchanged, and it avoids a table, caps and a sweep for a feature whose output is cheap to regenerate. Marking an old overview out of date, rather than rewriting it automatically, keeps every model call deliberate. A running feed changes the figures every few seconds, and an automatic rewrite would spend the limits within a minute.

Decided by the architect (not asked). Spend is the facts' display format (for example `£10,165.83`), so the fact check compares like with like; the runner up, raw pence, was rejected because the model would convert it and fail the check. The live call uses temperature 0 and at most 400 output tokens, enough for a headline and five points; the runner up, 800, doubles the worst case cost for no benefit. The template has fixed sentence rules in a fixed order; the runner up, a varied phrasing, was rejected because it would make tests brittle and add nothing for the viewer. Live limits are 3 per visitor per 10 minutes and 20 per 30 minute window: a little looser than Run showcase (2 and 10), because an overview is one short call, not a multi step investigation. The template path costs no model call, so it passes only the per visitor read limit that protects the database; the runner up, counting template requests against the live limits, was rejected because it would lock viewers out of a free answer.

The live verification on 2026-09-30 found that `openai/gpt-oss-120b` used more than the overview's 400 token allowance on hidden reasoning before it produced JSON. At 800 tokens it answered but did not reliably keep to the required point count. A scratch request with `reasoning_effort` `low` fitted the 400 token allowance but returned eleven points. This supports testing low effort with the explicit three to five point instruction. It does not yet establish that the revised live overview passes AC-4. Groq documents `low`, `medium`, and `high` as the supported values for `openai/gpt-oss-20b` and `openai/gpt-oss-120b`. This spec chooses `low` only for those short overview calls. It keeps the 400 completion token cap, including reasoning and final output, does not expose reasoning, and leaves every other model and investigation call unchanged. Rejected output uses the template fallback.

The runner up was raising the output allowance to 800 tokens. It doubles the maximum completion token allowance and did not resolve the observed shape failure. A second runner up was changing the configured model. That would change the existing provider selection boundary without evidence that another model is more reliable for this narrow task.

## References

- Project sources: Spec 0011, ADR-026, `config/public-showcase-overview.v1.json`, and the 2026-09-30 verification report.
- Practice: [Groq reasoning documentation](https://console.groq.com/docs/reasoning), checked 2026-09-30. It documents GPT OSS support for `reasoning_effort` and its `low`, `medium`, and `high` values.
