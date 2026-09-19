# System architecture

How the payment-risk engine is put together, from a provider event to an
operator's screen, and what part of it exists today.

This document describes structure. It does not approve anything: the product
baseline is the [PRD](../product/prd.md), delivery order is the
[implementation plan](../product/implementation-plan.md), and the rules every
contributor follows are in [project context](../project-context.md). Where those
disagree with a picture here, they win and this file is wrong.

## How to read the diagrams

Every node carries its build state, because a diagram that mixes what runs with
what is planned is how a demo becomes a false claim.

| State | Meaning |
| --- | --- |
| **Built** | Implemented in this repository and covered by tests. |
| **Planned** | Approved in the PRD or the delivery plan, not built. |
| **Proposed** | Under review; no contract, no implementation, no commitment. |

One rule runs through all of it: **everything here is synthetic**. No real
payment is approved, released, or executed anywhere in this system, and no
score, model, or language model may make that decision. Deterministic controls
come first; a model recommends; authority, oversight, and human review decide.

## 1. System context

Who uses the system and what it talks to.

```mermaid
flowchart TB
    classDef built fill:#e8f5ee,stroke:#0b7a45,color:#07331f
    classDef planned fill:#fdf5e3,stroke:#946000,color:#3d2a00
    classDef proposed fill:#f2f2f5,stroke:#6b7280,color:#30323a,stroke-dasharray:4 3
    classDef system fill:#eef1ff,stroke:#4b41c9,color:#1b1745

    subgraph people["People"]
        direction LR
        operator["Fraud operator"]:::built
        reviewer["Fraud reviewer"]:::planned
        admin["Administrator /<br/>model approver"]:::planned
        visitor["Recruiter or engineer"]:::built
    end

    engine["<b>Payment risk engine</b><br/>decision engine + operator console<br/>synthetic showcase"]:::system

    subgraph inputs["Data sources"]
        direction LR
        provider["Payment provider<br/>no adapter selected"]:::proposed
        plaid["Plaid Sandbox<br/>notebooks only"]:::built
        sparkov["Sparkov corpus<br/>offline benchmark"]:::built
    end

    subgraph services["Services"]
        direction LR
        groq["Groq API<br/>bounded investigation"]:::built
        arbiris["Arbiris<br/>signed records"]:::built
        azure["Azure<br/>SWA + Container Apps"]:::planned
    end

    people --> engine
    provider -. "not connected" .-> engine
    plaid -. "sanitised evidence" .-> engine
    sparkov -. "offline only" .-> engine
    engine -- "eligible cases" --> groq
    engine -- "evidence" --> arbiris
    engine --> azure
```

The dotted edges matter as much as the solid ones. Plaid informs the canonical
mapping through sanitised notebooks and never serves a request. Sparkov feeds a
mechanics-only benchmark and never a runtime score. No provider adapter is
selected, so the system's decision input today is a deterministic fixture.

## 2. Containers

What is deployed, and what is deliberately absent.

```mermaid
flowchart TB
    classDef built fill:#e8f5ee,stroke:#0b7a45,color:#07331f
    classDef planned fill:#fdf5e3,stroke:#946000,color:#3d2a00
    classDef proposed fill:#f2f2f5,stroke:#6b7280,color:#30323a,stroke-dasharray:4 3

    subgraph browser["Browser"]
        console["<b>Operator console</b><br/>React 19 + Vite<br/>Overview, Analyse a transaction, Benchmark insights"]:::built
    end

    subgraph service["Application service"]
        api["<b>Demo API</b><br/>FastAPI + Uvicorn, Python 3.13<br/>health, scenarios, runs over SSE, model summary"]:::built
        pipeline["<b>Decision pipeline</b><br/>LangGraph, in process<br/>deterministic stage then bounded investigation"]:::built
        store[("Operational store<br/>PostgreSQL")]:::planned
    end

    subgraph offline["Offline, never in a request path"]
        notebooks["<b>Notebooks 01-10</b><br/>sanitised, reproducible evidence"]:::built
        modelling["<b>modelling library</b><br/>apps/api/modelling<br/>data, features, training, evaluation"]:::built
        evidence["<b>Evidence artifacts</b><br/>benchmark report + training contract"]:::built
    end

    contracts["<b>Versioned contracts</b><br/>docs/contracts"]:::built

    console -- "HTTP + SSE" --> api
    api --> pipeline
    api -- "reads, read-only" --> evidence
    api -. "no database today" .-> store
    console -- "types generated from" --- contracts
    api --- contracts
    notebooks -- "runs" --> modelling
    modelling -- "writes in approved mode" --> evidence
```

The API is a modular monolith on purpose. The PRD keeps the deterministic tier
and the investigation tier in one process until profiling shows a real need to
split them, so a safety decision never waits on a network hop.

There is no database. Run state is ephemeral, which is why the console must not
present anything as durable history, and why idempotency and replay remain
planned rather than claimed.

## 3. The pipeline

Ingestion, intelligence, orchestration, action, monitoring — and what guards
each stage.

```mermaid
flowchart TB
    classDef built fill:#e8f5ee,stroke:#0b7a45,color:#07331f
    classDef planned fill:#fdf5e3,stroke:#946000,color:#3d2a00

    subgraph ingestion["1 · Ingestion"]
        direction LR
        i3["Scenario fixtures<br/>S01-S08"]:::built --> i1["Validate and<br/>canonicalise"]:::planned --> i2["Point-in-time<br/>feature snapshot"]:::planned
    end

    subgraph intelligence["2 · Intelligence"]
        direction LR
        m1["Deterministic fraud<br/>and APP controls"]:::built
        m2["Calibrated<br/>model score"]:::planned
        m3["Bounded<br/>investigation"]:::built
        m4["Recommendation<br/>PASS / CHALLENGE / HOLD"]:::built
        m1 -- "hard control<br/>stops here" --> m4
        m1 --> m2 --> m4
        m2 -- "ambiguous or<br/>APP concern only" --> m3 --> m4
    end

    subgraph orchestration["3 · Orchestration"]
        direction LR
        o1["Authority check"]:::planned --> o2["Oversight<br/>requirement"]:::planned --> o3["Human review<br/>where required"]:::planned
    end

    subgraph action["4 · Action"]
        direction LR
        a1["Simulated action,<br/>idempotent"]:::planned --> a2["History and<br/>read-only replay"]:::planned --> a3["Signed evidence<br/>record"]:::built
    end

    subgraph monitoring["5 · Monitoring"]
        direction LR
        n1["Run and health<br/>state"]:::built --> n2["Benchmark evidence,<br/>mechanics-only"]:::built --> n3["Drift and<br/>champion/challenger"]:::planned
    end

    ingestion --> intelligence --> orchestration --> action --> monitoring
```

Monitoring feeds back into the next *model decision* — a promotion, a threshold,
a retrain — through the release gate in section 4. There is no live path from an
evaluation result into a running score, which is why the chain above is a line
rather than a loop.

Stage by stage, with the constraint that defines it:

| Stage | What it does | Guardrail |
| --- | --- | --- |
| **Ingestion** | Turns a provider event into a versioned canonical transaction and a point-in-time feature snapshot. | Unavailable stays unavailable. A missing device, payee, or session fact is never manufactured from another source, and `unavailable` is not `zero` or `false`. |
| **Intelligence** | Runs deterministic fraud and APP controls, then a model score, then a bounded investigation only for cases that qualify. | Deterministic controls run **before** any model-assisted assessment. A low score cannot bypass a hard control, and the investigation is typed, allowlisted, and time-bounded. |
| **Orchestration** | Separates recommending from deciding: authority, then oversight, then review where required. | A recommendation is not an action. The browser never supplies authority; the server derives actor and tenant context. |
| **Action** | Produces a simulated outcome, durable history, replay, and a linked evidence record. | Every payment action is simulated. Duplicate processing never creates a second action, and replay repeats lineage, not effects. |
| **Monitoring** | Shows truthful run, health, and evaluation state; later, drift and champion/challenger. | No invented trend, accuracy, or false-positive figure. Zero, empty, and `Unavailable` are correct answers until recorded data exists. |

### What actually runs today

The current demo exercises a real slice of that pipeline end to end, in process,
over Server-Sent Events:

```mermaid
sequenceDiagram
    autonumber
    participant U as Operator
    participant W as Console
    participant A as Demo API
    participant D as Deterministic stage
    participant I as Investigation stage
    participant E as Evidence

    U->>W: choose a scenario, run it
    W->>A: POST /run/preset/{id}
    A->>D: canonical facts from the fixture
    D-->>A: score and reason codes
    Note over D: a hard control ends the run here
    A->>I: only if the case is eligible
    I-->>A: typed recommendation, or fail-safe HOLD
    Note over I: provider unavailable is a HOLD, never a silent PASS
    A->>E: signed record, verification not performed
    A-->>W: one event per completed node, then done
    W-->>U: route, reasons, record id, states
```

The console renders loading, unavailable, error, and outage states from that
stream rather than inventing a completed decision. With the LLM provider
unconfigured — the default — the investigation stage fails safe to HOLD, and the
screen says so.

## 4. Data and model lifecycle

The path from a data source to a number on a screen, and the gate in the middle
that nothing crosses today.

```mermaid
flowchart TB
    classDef built fill:#e8f5ee,stroke:#0b7a45,color:#07331f
    classDef planned fill:#fdf5e3,stroke:#946000,color:#3d2a00
    classDef proposed fill:#f2f2f5,stroke:#6b7280,color:#30323a,stroke-dasharray:4 3

    subgraph sources["Sources"]
        plaid["Plaid Sandbox"]:::built
        sparkov["Sparkov simulated corpus<br/>local, git-ignored, checksum-pinned"]:::built
        partner["Partner corpus with<br/>mature labels"]:::proposed
    end

    subgraph offline["Offline workflow"]
        nb["Notebooks 01-07<br/>inventory, mapping, features,<br/>corpus and leakage design"]:::built
        adapter["Build adapter<br/>scripts/build_sparkov_mechanics_dataset.py"]:::built
        lib["modelling library<br/>config, datasets, features,<br/>training, evaluation, report"]:::built
        nb08["Notebook 08<br/>thin runner"]:::built
    end

    subgraph artifacts["Reviewable artifacts"]
        contract["Training contract<br/>target, features, partitions, checksum"]:::built
        report["Benchmark report<br/>metrics, sweeps, slices, digest"]:::built
        fixtures["Canonical scenario fixtures"]:::planned
    end

    gate{{"Release gate:<br/>approved target, corpus, features,<br/>calibration, thresholds, review"}}:::proposed
    runtime["Runtime scoring"]:::planned
    console["Benchmark insights<br/>read-only in the console"]:::built

    plaid --> nb --> fixtures
    sparkov --> adapter --> contract
    contract --> nb08
    nb08 --> lib --> report
    report --> console
    partner -.-> gate
    report -.-> gate
    gate -. "not passed: no model is promoted" .-> runtime
```

Three properties make this reproducible rather than decorative:

- **The dataset is pinned, not described.** The training contract names the
  local CSV and its SHA-256; an approved run refuses anything else, and the
  corpus itself is never committed.
- **The parameters are reviewable.** Seed, hyperparameters, threshold grid, and
  fixture shape live in `config/fast-path-model-training.v1.json`, not in a
  notebook cell.
- **The output is a signed-off artifact.** The report records its git revision,
  seed, configuration version, and a digest of its own payload, and only an
  approved-mode run may write the reviewed copy. The API serves that report
  read-only, after checking its status, feature list, and dataset checksum.

What the gate blocks is the whole point: there is no path from a trained model
to a payment decision. The benchmark is labelled Sparkov mechanics wherever it
appears.

## 5. Trust boundaries

```mermaid
flowchart TB
    classDef built fill:#e8f5ee,stroke:#0b7a45,color:#07331f
    classDef planned fill:#fdf5e3,stroke:#946000,color:#3d2a00

    subgraph untrusted["Browser — never an authority"]
        ui["Console: renders state,<br/>sends requests"]:::built
    end

    subgraph server["Service — owns operational facts"]
        validate["Typed request validation"]:::built
        deterministic["Deterministic controls"]:::built
        authority["Authority and oversight"]:::planned
        redact["Error redaction:<br/>stable categories only"]:::built
        cors["Explicit CORS origins,<br/>no wildcard"]:::built
    end

    subgraph external["External — untrusted, bounded"]
        llm["Language model:<br/>may recommend, never decides"]:::built
        provider["Provider data:<br/>sensitive, redacted"]:::planned
    end

    ui --> cors --> validate --> deterministic --> authority
    deterministic -. "eligible cases only" .-> llm
    llm -. "typed result or fail-safe HOLD" .-> authority
    provider -. "raw errors never reach the UI" .-> redact --> ui
```

- The browser carries no authority. Roles, tenancy, and permissions are
  server-derived, and authentication is a prerequisite for the first mutable
  non-local endpoint rather than a later hardening step.
- The language model is treated as an untrusted, optional contributor: bounded
  tools, a timeout, and a fail-safe HOLD if it is unavailable.
- Provider data, tokens, raw errors, personal data, and model reasoning are
  sensitive. The stream emits stable error categories (`processing_timeout`,
  `processing_failed`), never a provider's message.

## 6. Deployment

```mermaid
flowchart TB
    classDef built fill:#e8f5ee,stroke:#0b7a45,color:#07331f
    classDef planned fill:#fdf5e3,stroke:#946000,color:#3d2a00

    dev["Developer<br/>make check"]:::built --> gh["GitHub"]:::built --> ci["Actions: web build, API tests,<br/>notebook policy, container build,<br/>dependency audit, CodeQL"]:::built

    ci --> image["API image<br/>digest-pinned, non-root,<br/>no private SDK"]:::built
    ci --> swa["Azure Static Web Apps<br/>console"]:::planned
    image --> aca["Azure Container Apps<br/>scale-to-zero API"]:::planned
    aca -. "cold start is a<br/>visible state" .-> swa
```

The image exists and is built and smoke-tested in CI; the Azure resources are
not configured yet, and nothing in this repository should be described as
deployed until the Bicep, OIDC, budget alert, and runbook are reviewed. Free
hosting is suitable only for a synthetic demo, never as a production
reliability decision.

## 7. Where each piece lives

| Concern | Location |
| --- | --- |
| Browser UI, routing, accessibility, browser tests | `apps/web` |
| Operational facts, routes, domain behaviour, API tests | `apps/api/server` |
| Offline training and evaluation, never imported by the API | `apps/api/modelling` |
| Versioned API and event contracts | `docs/contracts` |
| Reviewable, non-secret configuration | `config` |
| Reproducible evidence and experiment records | `notebooks`, `docs/experiments` |
| Deployment configuration and the container image | `apps/api/Dockerfile`, `infra` |
| Deterministic scenario fixtures | `fixtures` (specified, not yet populated) |

## 8. Open decisions

These are architecture-shaping and undecided. They are listed so a reader does
not mistake an absence for an oversight.

- **No provider adapter is selected.** Canonical money, direction, event time,
  account, payee, and source-revision semantics need an accepted contract before
  ingestion can be built.
- **No operational store.** Idempotency, durable history, review state, and
  replay all wait on that decision; the showcase is database-free today.
- **No approved model target or threshold.** Any threshold, calibration method,
  or promotion rule is an explicit approved decision, not a default.
- **Two console shells coexist.** The Overview is the shadcn surface; the other
  pages keep the approved Payments shell until a migration is approved.
- **Authentication is absent.** It gates the first mutable non-local endpoint.
