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

Infrastructure code is not configured yet. Do not represent Azure resources as
deployed until the Bicep, GitHub Actions OIDC configuration, budget alert, and
deployment runbook have been reviewed and tested.
