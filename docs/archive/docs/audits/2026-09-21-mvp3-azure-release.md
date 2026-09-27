# MVP 3 Azure release evidence — 2026-09-21

Status: **Recorded-only public showcase deployed and verified**

This record captures the first successful Azure release of the synthetic,
database-free recruiter showcase. It is deployment evidence, not a production
readiness, fraud-performance, zero-cost, or live-provider claim.

## Release identity

| Field | Recorded value |
| --- | --- |
| Source commit | `942f92bf996fa6dfbbb1f229aca043d6d1b3beb1` |
| Protected workflow | [Deploy public showcase run 35611121637](https://github.com/ags911/fraud-compliance-agent/actions/runs/35611121637) |
| Web URL | <https://thankful-grass-0e239cb1e.4.azurestaticapps.net> |
| API URL | <https://fraud-compliance-showcase-api.happysmoke-49a5708a.uksouth.azurecontainerapps.io> |
| API image | `ghcr.io/ags911/fraud-compliance-agent-api@sha256:7ff33d7dce13f072b948e6a74f47a809ffba40884105af0dbe80d99d04ce8756` |
| Resource group | `fraud-compliance-showcase-rg` |

## Deployed boundary

- Azure Static Web Apps Free hosts the console. Its control-plane region is
  West US 2 because this subscription rejected new Static Web Apps customers
  in West Europe during preflight.
- Azure Container Apps Consumption hosts the API in UK South with public
  HTTPS-only ingress, 0–1 replicas, 0.25 vCPU and 0.5 GiB.
- The resource group contains only the Static Web App, Container App, and
  managed Container Apps environment. It has no database, cache, queue, VNet,
  customer data, or logging workspace.
- The API uses the immutable image digest above and excludes the private SDK.
- `SHOWCASE_LIVE_ENABLED=false`; there is no provider secret, selected model,
  or model allowlist. Recorded playback is the continuously public path.
- The exact Static Web Apps origin is supplied through `ALLOWED_ORIGINS`.

## Identity and delivery controls

- GitHub environment `showcase` is restricted to `main` and requires review.
- The Entra federated credential uses issuer
  `https://token.actions.githubusercontent.com`, audience
  `api://AzureADTokenExchange`, and immutable subject
  `repo:ags911@23552511/fraud-compliance-agent@1376491338:environment:showcase`.
- No Azure client secret exists. The deployment service principal has
  `Contributor` only on the dedicated resource group.
- The workflow reviewed Azure `what-if` before applying the same template and
  parameters, retrieved and masked the Static Web Apps token at runtime, and
  used no stored Static Web Apps deployment secret.

## Cost controls

The subscription budget
`fraud-compliance-showcase-rg-showcase-budget` is monthly, starts
2026-09-01, and is set to 10 subscription currency units. Enabled email alerts
at 80% and 100% target `accounts@arbiris.uk`. These alerts notify; they do not
cap spending. Delivery is not claimed because neither threshold has been
crossed.

## Verification results

Workflow run `35611121637` passed:

- Bicep compilation and the deployment-configuration verifier;
- the full pre-deploy gate: 199 browser tests passed with 9 skipped, 279 API
  tests passed with 6 skipped, and the two real local showcase matrix tests
  passed;
- anonymous pull of the SDK-free GHCR digest, passwordless Azure OIDC,
  resource-group `what-if`, resource deployment, console build/publication,
  and the public health/CORS acceptance command.

Independent public checks then confirmed:

- `/health` returned `200` with `{"status":"ok"}`;
- recorded S04 returned `200` and emitted the two accepted tool calls/results,
  an evidence-grounded investigation result, and one terminal run result;
- live-requested S05 returned `200` as labelled recorded playback and emitted
  the deterministic incomplete fail-safe path;
- an invalid request returned `422` with only the stable `invalid_request`
  code and public message;
- the deployed web origin received `access-control-allow-origin`, while a
  foreign origin received no grant;
- Chrome loaded the SPA route directly, reported `Demo API ready`, displayed
  S04's two evidence items and non-authoritative `CHALLENGE`, and displayed
  S05's provider-unavailable, incomplete `HOLD` with authority `Not evaluated`
  and simulated action `None`;
- Chrome recorded no console warnings or errors during that journey.

The first exact public acceptance command after an idle interval completed in
about 45 seconds; an immediate warm rerun completed in 1.48 seconds. These are
end-to-end smoke-command observations, not an API latency percentile or SLA.
Separate warm API requests completed in under 0.1 seconds. Local browser tests
retain deterministic coverage for waking, unavailable, and retry states.

## Residual and deferred items

- Manual keyboard and screen-reader review remains a human accessibility task.
- The optional controlled live Groq evaluation remains unclaimed until an
  approved model, provider secret, spending protection, timed enable/disable
  procedure, and evaluation window exist.
- Doppler injection is prepared but intentionally unused by this recorded-only
  release.
- Budget-alert configuration is verified; actual email delivery awaits a real
  threshold crossing.
- The local private-SDK A–F compatibility workflow is not in the public image.
  Public verification does not itself approve its retirement.
- S06–S08, durable history, authentication, Plaid ingestion, served fraud-model
  scoring, and payment actions remain outside MVP 3.

## Rollback and teardown ownership

The platform/release owner rolls application code back by rerunning the
protected workflow from a known-good commit. Full teardown uses the explicit
resource-group deletion in `infra/azure/README.md`; the subscription budget,
GHCR images, GitHub environment, Entra application, and any future Doppler
secret are separate resources and must be retained or removed deliberately and
recorded.
