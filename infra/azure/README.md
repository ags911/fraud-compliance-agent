# Azure showcase deployment (prepared, not deployed)

This directory is a reviewable deployment scaffold for a synthetic recruiter showcase. It creates only a Static Web App and a scale-to-zero Container App, plus a subscription budget alert. It does not create a database, queue, VNet, identity provider, or customer-data store.

## Current hard stop

Do **not** deploy the current API image as the full decision demo. The image deliberately excludes the private Arbiris SDK, so `/scenarios` and both `/run` routes return `503 demo_pipeline_unavailable`; only `/health` and the read-only benchmark route work. Publishing the SDK in an image requires separate explicit approval and a reviewed supply-chain design.

The Bicep is therefore ready for review and validation, but the GitHub deployment workflow remains guarded until that decision and Azure credentials exist.

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
