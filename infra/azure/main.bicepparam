using './main.bicep'

// Replace these placeholders in a private parameter file or GitHub workflow.
// Do not commit subscription IDs, deployment tokens, or other credentials here.
param location = 'uksouth'
param staticWebAppLocation = 'westus2'
param staticWebAppName = 'replace-with-unique-name'
param containerEnvironmentName = 'fraud-compliance-showcase-env'
param apiContainerAppName = 'fraud-compliance-showcase-api'
param apiImage = 'ghcr.io/replace-owner/fraud-compliance-agent-api@sha256:replace-with-immutable-digest'
// Optional live-provider values are injected by the guarded workflow from
// Doppler. Recorded playback needs none of them and remains the default.
param groqApiKey = ''
// The guarded public database remains disabled until ADR-021 verification is
// complete. Inject this only from a private Doppler-backed parameter source.
param databaseUrl = ''
param showcaseGroqModel = ''
param showcaseGroqAllowedModels = ''
param showcaseCasesEnabled = 'false'
param simulationWorkerEnabled = 'false'
param publicDatabaseGuardsEnabled = 'false'
param showcaseTrustedProxyHops = '0'
param tags = {
  application: 'fraud-compliance-agent'
  environment: 'showcase'
  dataClassification: 'synthetic-only'
}
