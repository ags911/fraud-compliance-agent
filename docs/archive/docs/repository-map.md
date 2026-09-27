# Repository map

This map explains ownership, authority, and the important entry points in the
Fraud Compliance Agent monorepo. It is intentionally not a hand-maintained
description of every source file. For a complete list of project files,
generate a local report on demand:

```bash
make repository-inventory
```

The report is written to `docs/repository-inventory.md`, which is git-ignored.
It is not committed and CI does not check it, so adding a file never fails a
build.

## Root ownership

| Location | Owner and purpose | Authority / edit rule |
| --- | --- | --- |
| `apps/web` | React/Vite operator console, accessibility, browser state, and browser tests | UI consumes accepted contracts only; never imports API internals or secrets. |
| `apps/api` | FastAPI modular monolith for operational facts, risk routing, integrations, persistence, and API tests | Backend/domain owner. `apps/api/vendor` is pinned third-party material: do not edit except during an explicit SDK upgrade. |
| `apps/api/prototypes` | Retained source-snapshot prototypes, kept for reference | Not active product surfaces, build inputs, or contract authority. |
| `apps/api/modelling` | Offline fast-path model training, evaluation, diagnostics, and release-report library that Notebook 08 runs | Not part of the served API: `server/` never imports it, and its ML dependencies stay development-only. |
| `docs/contracts` | Versioned HTTP, event, and domain contracts shared by applications | Contract authority after explicit acceptance. |
| `docs/product` | Candidate PRD and the single active cross-application delivery plan | Product planning authority after the documented approval record is complete; location alone is not approval. |
| `docs/proposals` | Review artifacts that are not yet runtime inputs | Proposed only; promote through an ADR, contract, and tests. |
| `docs/experiments` | Sanitised notebook experiment records | Evidence, never runtime authority. |
| `docs/architecture` | Structural description of the system, from ingestion to monitoring | Describes structure and build state; approves nothing. |
| `notebooks` | Reproducible, sanitised feasibility and evaluation evidence | Follow the notebook plan, data governance, and approved gates. |
| `fixtures` | Versioned deterministic scenarios and contract examples | No provider/raw data; only explicitly accepted fixtures may become scoped runtime inputs. |
| `config` | Non-secret configuration examples and model configuration | Never add credentials or local environment values. |
| `data` | Local/managed data staging locations | Ignored by Git; raw, processed, and model data never belong in commits. |
| `infra` | Local orchestration and deployment configuration | No application-domain logic. |
| `scripts` | Reproducible maintenance, corpus, and notebook pipeline utilities | Keep scripts documented, linted, and safe to run. |
| `.github/workflows` | CI verification and security workflows | Changes must preserve mandatory quality gates. |

## Key entry points

| File | Responsibility |
| --- | --- |
| `AGENTS.md`, `CLAUDE.md` | Minimal agent entry points. Both direct agents to the canonical project context. |
| `docs/project-context.md` | Stable project, architecture, safety, and delivery rules for every contributor. |
| `docs/architecture/system-architecture.md` | Context, containers, pipeline, data and model lifecycle, trust boundaries, and deployment. |
| `README.md` | Monorepo orientation, independently runnable applications, and common commands. |
| `Makefile` | Local verification and safe notebook/corpus commands. `make check` is the standard handoff gate. |
| `.github/workflows/verify.yml` | CI build, lint, docstring, smoke-test, test, and container-image checks. |
| `.github/workflows/deploy-showcase.yml` | Manual, protected MVP 3 deployment: SDK-free GHCR image, Azure OIDC, Bicep, Static Web Apps publish, and public acceptance. |
| `.github/workflows/security.yml` | Dependency audit and CodeQL, on every change and weekly. |
| `infra/azure/README.md` | One-time Azure/OIDC bootstrap, Doppler boundary, deploy verification, rollback, and teardown runbook. |
| `docs/audits/2026-09-21-mvp3-azure-release.md` | Dated Azure deployment, public acceptance, IAM, cost-control, and residual-risk evidence for MVP 3. |
| `apps/api/Dockerfile` | Showcase API image: digest-pinned bases, non-root, no private SDK or offline ML code. |
| `.dockerignore` | Allowlist build context for that image; everything is excluded until it is named. |
| `apps/api/server/main.py` | FastAPI application factory and current Phase 0 public route registration. |
| `apps/api/server/showcase_investigation/` | SDK-free S01–S05 playback, bounded LangGraph live path, provider adapter and process-local admission controls. |
| `docs/proposals/public-showcase-investigation.proposed.md` | Decision register and remaining gates for the repository-owned SDK-free MVP 3 investigation; ADR-015 owns its contract, ADR-016 its fixtures, and ADR-017 its local API runtime. |
| `apps/api/server/models.py` | API-side domain/data models. |
| `apps/api/modelling/pipeline.py` | Run setup and the mode-dependent decision about what data an evaluation run may read. |
| `config/fast-path-model-training.v1.json` | Accepted seed, hyperparameters, threshold grid, and synthetic-fixture shape for the mechanics-only benchmark. |
| `apps/web/src/main.tsx` | Primary React application entry point. |
| `apps/web/src/*-main.tsx` | Standalone design/reference page entry points. |
| `apps/web/work/payments-design-concept.html` | Frozen approved visual reference for Rules Performance; do not alter during feature work. |
| `notebooks/notebook-plan.md` | Ordered 01–10 notebook scope, gates, inputs, and definition of done. |
| `notebooks/README.md` | Notebook kernel, safety, structure, and quality standards. |
| `docs/data-governance.md` | Data, provider, output, and artifact handling policy. |

## Product and decision authority

1. The candidate PRD and the single active delivery plan live in
   `docs/product/`; their proposal status is explicit in
   `docs/project-context.md`.
2. Accepted cross-application semantics live in `docs/contracts/`. A proposal,
   notebook result, or frontend mock does not silently become an API contract.
3. Approval decisions belong in the PRD or an ADR. The project context captures
   only durable constraints, not a mutable work log.

## Generated inventory scope

The local `repository-inventory.md` report lists project-managed source, documentation,
configuration, workflow, notebook, fixture, and infrastructure files. It
excludes dependencies, build output, virtual environments, Git metadata,
notebook checkpoints, and vendor trees. Those exclusions are deliberate: they
are not project-owned implementation files and would create a large, unstable
document.
