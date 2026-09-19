# Infrastructure

Azure deployment configuration for the recruiter showcase will live here:

- `azure/` — Bicep infrastructure definitions and non-secret parameters for
  Azure Static Web Apps and Azure Container Apps.
- `azure/README.md` — deployment prerequisites, cost guardrails, environment
  names, and rollback/teardown instructions.

The intended deployment is synthetic-only and database-free: the React console
uses Azure Static Web Apps; the FastAPI demo API uses Azure Container Apps
Consumption with scale-to-zero. Do not add an Azure database, VNet, cache,
queue, production identity service, or real provider integration until a
visible showcase requirement justifies it.

## The API container image

`apps/api/Dockerfile` is the first deployment artifact and the only one that
exists today. Build it from the repository root, because the image includes the
sanitised benchmark evidence the read-only model-summary route serves:

```bash
docker build -f apps/api/Dockerfile -t fraud-compliance-agent-api .
docker run --rm -p 8000:8000 fraud-compliance-agent-api
```

What the image is and is not:

- Python 3.13 slim and uv, both pinned by digest; dependencies installed from
  the committed lockfile with `uv sync --frozen --no-dev`.
- It runs as the non-root `app` user (uid 10001) and exposes port 8000, which
  is the target port a Container Apps ingress must use.
- The private Arbiris SDK is excluded, so `/scenarios` and the run routes answer
  `503 demo_pipeline_unavailable`. `/health` and `/demo/model-summary` work.
  Publishing the SDK inside an image needs an explicit deployment approval.
- The offline `modelling` library and its scikit-learn, XGBoost, pandas, and
  Plotly stack are excluded: the production wheel contains `server` only.
- `ALLOWED_ORIGINS` defaults to a local development origin. A deployment must
  set its real origins; a wildcard is never acceptable here.
- `FCA_EVIDENCE_ROOT` points at the two evidence files copied into the image.
  There is no repository inside a container, so the route reads them from there.

The repository-root `.dockerignore` is an allowlist: everything is excluded and
only the API's dependency metadata, `server/`, and the two evidence files are
added back. Extend it deliberately; a denylist would eventually let the private
submodule, the local corpus, or a `.env` file into a published layer.

CI builds the image on every change, starts it, and checks that it is healthy,
serves the committed benchmark digest, runs as a non-root user, and carries no
private or offline code.

Infrastructure code beyond the image is not configured yet. Do not represent
Azure resources as deployed until the Bicep, GitHub Actions OIDC configuration,
budget alert, and deployment runbook have been reviewed and tested.
