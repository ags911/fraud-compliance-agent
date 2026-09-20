# syntax=docker/dockerfile:1

# Container image for the showcase demo API (MVP 3, Azure Container Apps).
#
# Build from the repository root so the sanitised benchmark evidence can be
# copied in:
#     docker build -f apps/api/Dockerfile -t fraud-compliance-agent-api .
# The root .dockerignore is an allowlist: only API dependency metadata,
# `server/`, accepted synthetic runtime inputs, and benchmark evidence enter.
#
# What this image is: the FastAPI demo backend and its runtime dependencies. It
# is a synthetic, unauthenticated demonstration service, not a production
# payment or compliance service.
#
# What it excludes: the private Arbiris SDK submodule, the offline `modelling`
# evaluation library and its scikit-learn/XGBoost/Plotly stack, tests,
# notebooks, datasets, and every secret. Without the SDK the live demo-pipeline
# routes answer 503 `demo_pipeline_unavailable`; `/health`,
# `/demo/model-summary`, and `/showcase/investigations` work.

# Base images are pinned by digest so a rebuild cannot silently change them.
# The tags are recorded for readability, not for resolution:
#   python:3.13-slim            (matches apps/api/.python-version)
#   ghcr.io/astral-sh/uv:0.11.8 (matches the uv that maintains uv.lock)
ARG PYTHON_IMAGE=python:3.13-slim@sha256:8d9d0b8bcf6506481eae4907c18f5e3e7902e629f5f6d684f9e7c32e85e3ddf0
ARG UV_IMAGE=ghcr.io/astral-sh/uv:0.11.8@sha256:3b7b60a81d3c57ef471703e5c83fd4aaa33abcd403596fb22ab07db85ae91347

FROM ${UV_IMAGE} AS uv

FROM ${PYTHON_IMAGE} AS builder

COPY --from=uv /uv /usr/local/bin/uv

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never \
    UV_PROJECT_ENVIRONMENT=/opt/venv

WORKDIR /src

# Dependencies are installed from the committed lockfile before any application
# code is copied, so editing a route does not reinstall the dependency tree.
# --frozen fails rather than re-resolving, --no-dev drops the test, lint, and
# notebook stack, and the `sdk` extra is not selected, so the private submodule
# is never needed here.
COPY apps/api/pyproject.toml apps/api/uv.lock ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev --no-install-project

# The application, installed as a built wheel rather than an editable path. The
# wheel target contains only `server`, so the offline evaluation library cannot
# reach this image.
COPY apps/api/README.md ./
COPY apps/api/server ./server
# Deliberately built without the shared uv cache. With the cache mounted, uv
# reused a previously built wheel of this project and the image shipped stale
# application code that still passed every other check. Dependencies are
# already installed above, so this step only builds and installs the project.
RUN uv sync --frozen --no-dev --no-editable \
    --reinstall-package fraud-compliance-agent-api

FROM ${PYTHON_IMAGE} AS runtime

# A fixed non-root account. It owns nothing it runs: the virtual environment and
# the evidence files are copied in root-owned and read-only to this user.
RUN groupadd --gid 10001 app \
    && useradd --uid 10001 --gid app --no-create-home --home /nonexistent app

ENV PATH=/opt/venv/bin:$PATH \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    # The deployment must set its real browser origins. The default is a local
    # development origin, never a wildcard.
    ALLOWED_ORIGINS=http://localhost:5173 \
    # The public demo calls no external provider unless a deployment opts in
    # and supplies a key.
    DEMO_ALLOW_EXTERNAL_INVESTIGATION=false \
    SHOWCASE_LIVE_ENABLED=false \
    # Accepted showcase configuration and fixtures are copied below this root.
    FCA_SHOWCASE_ROOT=/app/showcase \
    # There is no repository inside the image, so the read-only model-summary
    # route reads its evidence from here instead.
    FCA_EVIDENCE_ROOT=/app/evidence

COPY --from=builder /opt/venv /opt/venv
COPY docs/contracts/model-training-contract.v1.json /app/evidence/docs/contracts/
COPY docs/proposals/fast-path-model-release.candidate.json /app/evidence/docs/proposals/
COPY config/public-showcase-investigation.v1.json /app/showcase/config/
COPY fixtures/s01-s08/scenarios.v1.json /app/showcase/fixtures/s01-s08/

WORKDIR /app
USER app

EXPOSE 8000

# Container Apps probes this route. Scale-to-zero means the first request after
# an idle period pays the cold start.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=4).read()"]

# Exec form: uvicorn receives SIGTERM directly, so a scale-down or a rolling
# revision drains instead of being killed.
CMD ["uvicorn", "server.main:app", "--host", "0.0.0.0", "--port", "8000"]
