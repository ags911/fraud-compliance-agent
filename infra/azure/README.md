# Azure showcase deployment runbook (prepared, not deployed)

This directory is the reviewable deployment path for the synthetic recruiter
showcase. It creates only a Static Web App and a scale-to-zero Container App,
plus a subscription budget alert during the one-time bootstrap. It does not
create a database, queue, VNet, identity provider, or customer-data store.

## Current hard stop

Do **not** describe the current image as a completed public deployment yet. The image deliberately excludes the private Arbiris SDK, so `/scenarios` and both legacy `/run` routes return `503 demo_pipeline_unavailable`. `/health`, the read-only benchmark route, and the repository-owned recorded S01–S05 `/showcase/investigations` runtime work without it. Local browser integration is complete; deployed acceptance remains pending, and the private SDK remains excluded.

The public-safe investigation now passes its local contract, evaluation,
browser, abuse-control, and container-boundary gates. The manual GitHub
workflow remains guarded by the `showcase` environment, an explicit confirmation
input, a `main`-branch check, and Azure OIDC. No cloud resources currently
exist, so the deployed checks remain unperformed.

Recorded playback will remain continuously public. Live Groq mode must default
off and be enabled only for a controlled demonstration window through a
server-side kill switch. Do not deploy always-on anonymous live access until a
reliable provider spending limit or durable distributed quota mechanism has
been approved and tested.

The candidate controlled window is limited to one concurrent live
investigation, two per observed client per 10 minutes, ten per process, a
30-minute maximum enablement window and a 45-second overall timeout. Resolve
the observed-client key only from verified Container Apps ingress metadata;
never trust an arbitrary caller-supplied forwarding header. Process restart
resets these counters, so they are not a daily spending cap.

Groq is the sole optional live provider. Inject its credential and allowlisted
model setting server-side, record the provider and selected model identifier
with the run, and admit only schema-validated structured output. Raw prompts,
raw responses, hidden reasoning and provider exceptions must not enter logs or
public events. Do not configure another LLM as failover; use labelled recorded
playback when Groq is unavailable.

Do not treat a passing image build as automatic migration approval. The legacy
private-SDK A–F workflow stays local-only until accepted S01–S08 contracts,
runtime evaluations, browser acceptance and the public-container boundary all
pass and an explicit cutover decision is recorded. It remains excluded from
the public image throughout.

## What is locally complete

- `subscription.bicep` defines the dedicated resource group and 80%/100%
  monthly budget notifications.
- `main.bicep` defines Static Web Apps Free and Container Apps Consumption with
  HTTPS-only ingress, 0–1 replicas, the exact Static Web Apps CORS origin, and
  no database or logging workspace.
- Optional Groq settings enter the Container App only through a secure Bicep
  parameter and secret reference. `SHOWCASE_LIVE_ENABLED` is hard-coded to
  `false` in the deployment template.
- `.github/workflows/deploy-showcase.yml` builds the SDK-free image, publishes
  it to GHCR by commit SHA, resolves its digest, proves it is anonymously
  pullable, authenticates to Azure with OIDC, runs `what-if`, deploys, builds
  the console against the deployed API URL, obtains the Static Web Apps token
  at runtime, and runs public acceptance.
- `make acceptance-mvp3-predeploy` checks the repository and deployment
  boundary. CI additionally compiles both templates with Bicep v0.47.16.

## One-time owner bootstrap

This step needs a human Azure login because the long-lived deployment identity
must not receive subscription-wide rights merely to create its own resource
group and budget.

1. Create or select an Azure subscription and a monitored mailbox. Confirm the
   subscription can incur charges; a budget alert reports spend but does not
   cap it.
2. Review both subscription-scope changes before applying them:

   ```bash
   az deployment sub what-if \
     --location uksouth \
     --template-file infra/azure/subscription.bicep \
     --parameters \
       resourceGroupName=fraud-compliance-showcase-rg \
       location=uksouth \
       monthlyBudgetAmount=10 \
       budgetAlertEmail='<monitored mailbox>' \
       budgetStartDate='<first day of current or next month>'

   az deployment sub create \
     --location uksouth \
     --template-file infra/azure/subscription.bicep \
     --parameters \
       resourceGroupName=fraud-compliance-showcase-rg \
       location=uksouth \
       monthlyBudgetAmount=10 \
       budgetAlertEmail='<monitored mailbox>' \
       budgetStartDate='<first day of current or next month>'
   ```

3. Create an Entra application/service principal and grant it `Contributor`
   only on the dedicated resource group. Add one GitHub federated credential
   whose subject is `repo:ags911/fraud-compliance-agent:environment:showcase`.
   Do not create a client secret.
4. Create a protected GitHub environment named `showcase`: restrict it to
   `main`, require a reviewer, and add these non-secret environment variables:

   - `AZURE_CLIENT_ID`
   - `AZURE_TENANT_ID`
   - `AZURE_SUBSCRIPTION_ID`
   - `AZURE_RESOURCE_GROUP`
   - `AZURE_LOCATION`
   - `AZURE_STATIC_WEB_APP_LOCATION` (use `westeurope`; Static Web Apps has a
     narrower location list than Container Apps)
   - `AZURE_STATIC_WEB_APP_NAME`
   - `AZURE_CONTAINER_ENVIRONMENT_NAME`
   - `AZURE_CONTAINER_APP_NAME`

5. The workflow publishes `ghcr.io/ags911/fraud-compliance-agent-api`. After
   its first package version is created, make that package public in GitHub's
   package settings. The first run deliberately stops before Azure deployment
   if anonymous digest pull fails; rerun it after changing visibility.

## Doppler `showcase` configuration

Recorded playback needs no provider secret and is the safe initial deployment.
If the optional provider configuration is prepared, create a read-only Doppler
service token scoped only to the `showcase` config and store that bootstrap
token as the protected GitHub environment secret `DOPPLER_TOKEN`. Doppler—not
GitHub—holds these values:

- `GROQ_API_KEY`
- `SHOWCASE_GROQ_MODEL`
- `SHOWCASE_GROQ_ALLOWED_MODELS`

No model has been approved yet, so the last two values must not be invented.
The workflow may preload these settings server-side, but every normal deploy
still sets `SHOWCASE_LIVE_ENABLED=false`; none of them enter the Vite build or
browser bundle. If `DOPPLER_TOKEN` is absent, deployment remains valid and
recorded-only.

## Deploy and verify

1. Merge the reviewed checkpoint to `main` and confirm Verify is green.
2. In GitHub Actions, run **Deploy public showcase** with
   `confirm_deploy=false` first. This runs the full pre-deploy gate and changes
   no external state.
3. Rerun from `main` with `confirm_deploy=true`, review the protected
   environment request, and approve it only for the intended subscription and
   resource group. The workflow records Azure `what-if` immediately before
   applying the same template and parameters.
4. Record the web URL, API URL, workflow run, image digest, region, plan, and
   budget-alert recipient in the release evidence. Do not call MVP 3 complete
   until the workflow's public health/CORS check and the manual browser checks
   pass.
5. Confirm the alert emails are configured at 80% and 100% and that the
   monitored mailbox receives Azure budget notifications. Delivery cannot be
   proven locally.

The workflow obtains the Static Web Apps deployment token through its Azure
OIDC session, masks it, uses it in the same job, and never stores it as a
repository secret. The API image uses a registry digest, never `latest`.

## Controlled live-provider window

The deployment workflow intentionally cannot enable live Groq access. When a
model is approved, use a separate reviewed operator change that sets
`SHOWCASE_LIVE_ENABLED=true`, records its start time, verifies the 30-minute
process-local window, and restores `false` immediately afterward. Do not treat
the process-local counter as a durable quota: a restart resets it. Until that
disable path is implemented and exercised, public acceptance covers recorded
playback only.

## Rollback and teardown

- Roll back application code by rerunning the workflow from the last known-good
  commit; the immutable image digest makes that revision reproducible.
- For a failed resource deployment, inspect the Azure deployment operation and
  redeploy the last known-good template. Do not loosen CORS or enable wildcard
  origins as a recovery step.
- Teardown is intentionally explicit and destructive:

  ```bash
  az group delete --name fraud-compliance-showcase-rg --yes
  ```

  This removes the Static Web App, Container App, and managed environment. The
  subscription-scoped budget may remain after resource-group deletion; delete
  or retain it deliberately and record the result. GHCR images and Doppler
  secrets are separate resources and are not deleted by Azure teardown.
