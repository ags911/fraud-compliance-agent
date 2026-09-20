# Azure showcase deployment (prepared, not deployed)

This directory is a reviewable deployment scaffold for a synthetic recruiter showcase. It creates only a Static Web App and a scale-to-zero Container App, plus a subscription budget alert. It does not create a database, queue, VNet, identity provider, or customer-data store.

## Current hard stop

Do **not** deploy the current API image as the completed decision demo yet. The image deliberately excludes the private Arbiris SDK, so `/scenarios` and both legacy `/run` routes return `503 demo_pipeline_unavailable`. `/health`, the read-only benchmark route, and the repository-owned recorded S01–S05 `/showcase/investigations` runtime work without it. Browser integration and deployed acceptance remain pending; the private SDK remains excluded.

The Bicep is therefore ready for review and validation, but the GitHub deployment workflow remains guarded until the public-safe investigation passes its contract, evaluation, abuse-control and container-boundary gates and Azure credentials exist.

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

## Prerequisites when deployment is approved

1. Create an Azure subscription and choose a monitored mailbox for budget alerts.
2. Create an Entra application/service principal scoped to the showcase resource group. Add a GitHub Actions federated credential for the repository, branch/environment that may deploy.
3. Set repository **variables** (not secrets) `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`, `AZURE_RESOURCE_GROUP`, `AZURE_LOCATION`, and unique resource names. OIDC keeps an Azure client secret out of GitHub.
4. Put the budget email and immutable image digest in protected deployment-environment variables. Never use `latest`.
5. Validate before applying: `az bicep build --file infra/azure/subscription.bicep` and `az bicep build --file infra/azure/main.bicep`.

## Apply and rollback

After the hard stop is resolved, deploy the subscription template first (resource group + budget), then the resource-group template. Use `what-if` for both scopes before `create`.

The budget is an alert only; it does not stop spending. Roll back by deleting the dedicated resource group in the Azure portal or with `az group delete --name <showcase-rg> --yes`. This removes the Static Web App, Container App, and managed environment together. Verify the budget alert separately because it is subscription-scoped.

For Static Web Apps publishing, use GitHub OIDC to retrieve the deployment token only at workflow runtime, mask it, and pass it directly to the deploy action. Do not save that token as a repository secret.
