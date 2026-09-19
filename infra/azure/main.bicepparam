using './main.bicep'

// Replace these placeholders in a private parameter file or GitHub workflow.
// Do not commit subscription IDs, deployment tokens, or other credentials here.
param location = 'uksouth'
param staticWebAppName = 'replace-with-unique-name'
param containerEnvironmentName = 'fraud-compliance-showcase-env'
param apiContainerAppName = 'fraud-compliance-showcase-api'
param apiImage = 'ghcr.io/replace-owner/fraud-compliance-agent-api@sha256:replace-with-immutable-digest'
param tags = {
  application: 'fraud-compliance-agent'
  environment: 'showcase'
  dataClassification: 'synthetic-only'
}
