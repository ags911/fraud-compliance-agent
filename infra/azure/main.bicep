targetScope = 'resourceGroup'

@description('Azure region for the synthetic showcase resources.')
param location string

@description('Supported Azure Static Web Apps region; kept separate from the Container Apps region.')
param staticWebAppLocation string = 'westus2'

@description('Globally unique Azure Static Web Apps resource name.')
param staticWebAppName string

@description('Container Apps managed environment name.')
param containerEnvironmentName string

@description('Container App name for the public showcase API.')
param apiContainerAppName string

@description('Immutable public image reference. Do not use a mutable tag.')
param apiImage string

@secure()
@description('Optional Groq credential from Doppler. Leave empty for recorded-only deployment.')
param groqApiKey string = ''

@secure()
@description('Optional PostgreSQL runtime credential from Doppler. Leave empty to keep the showcase database free.')
param databaseUrl string = ''

@description('Optional operator-selected Groq model. There is deliberately no repository default.')
param showcaseGroqModel string = ''

@description('Comma-separated server-side allowlist for the optional Groq model.')
param showcaseGroqAllowedModels string = ''

@description('Enable saved showcase cases only when a guarded public database is ready.')
param showcaseCasesEnabled string = 'false'

@description('Enable the in-API simulation worker only when a guarded public database is ready.')
param simulationWorkerEnabled string = 'false'

@description('Enable public database guard limits only after ingress forwarding is confirmed.')
param publicDatabaseGuardsEnabled string = 'false'

@description('Number of trusted ingress proxy hops for client identity derivation.')
param showcaseTrustedProxyHops string = '0'

@description('Optional resource tags for ownership and cost tracing.')
param tags object = {
  application: 'fraud-compliance-agent'
  environment: 'showcase'
  dataClassification: 'synthetic-only'
}

resource staticWebApp 'Microsoft.Web/staticSites@2023-12-01' = {
  name: staticWebAppName
  location: staticWebAppLocation
  sku: {
    name: 'Free'
    tier: 'Free'
  }
  tags: tags
  properties: {
    buildProperties: {
      skipGithubActionWorkflowGeneration: true
    }
  }
}

// This showcase deliberately has no Log Analytics workspace. The Container App
// runs one small API with scale-to-zero and exposes no customer data or logs.
resource containerEnvironment 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: containerEnvironmentName
  location: location
  tags: tags
  properties: {
    appLogsConfiguration: {
      destination: null
    }
  }
}

resource apiContainerApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: apiContainerAppName
  location: location
  tags: tags
  properties: {
    managedEnvironmentId: containerEnvironment.id
    configuration: {
      activeRevisionsMode: 'Single'
      secrets: concat(
        empty(groqApiKey) ? [] : [
          {
            name: 'groq-api-key'
            value: groqApiKey
          }
        ],
        empty(databaseUrl) ? [] : [
          {
            name: 'database-url'
            value: databaseUrl
          }
        ]
      )
      ingress: {
        external: true
        targetPort: 8000
        transport: 'auto'
        allowInsecure: false
        traffic: [
          {
            latestRevision: true
            weight: 100
          }
        ]
      }
    }
    template: {
      containers: [
        {
          name: 'showcase-api'
          image: apiImage
          resources: {
            cpu: json('0.25')
            memory: '0.5Gi'
          }
          env: concat([
              {
                name: 'ALLOWED_ORIGINS'
                value: 'https://${staticWebApp.properties.defaultHostname}'
              }
              {
                // Deployment never enables anonymous live access. A separate,
                // time-bounded operator procedure is required for that window.
                name: 'SHOWCASE_LIVE_ENABLED'
                value: 'false'
              }
              {
                name: 'SHOWCASE_GROQ_MODEL'
                value: showcaseGroqModel
              }
              {
                name: 'SHOWCASE_GROQ_ALLOWED_MODELS'
                value: showcaseGroqAllowedModels
              }
              {
                name: 'SHOWCASE_CASES_ENABLED'
                value: showcaseCasesEnabled
              }
              {
                name: 'SIMULATION_WORKER_ENABLED'
                value: simulationWorkerEnabled
              }
              {
                name: 'PUBLIC_DATABASE_GUARDS_ENABLED'
                value: publicDatabaseGuardsEnabled
              }
              {
                name: 'SHOWCASE_TRUSTED_PROXY_HOPS'
                value: showcaseTrustedProxyHops
              }
            ], empty(groqApiKey) ? [] : [
              {
                name: 'GROQ_API_KEY'
                secretRef: 'groq-api-key'
              }
            ], empty(databaseUrl) ? [] : [
              {
                name: 'DATABASE_URL'
                secretRef: 'database-url'
              }
            ])
        }
      ]
      scale: {
        minReplicas: 0
        maxReplicas: 1
        rules: [
          {
            name: 'http'
            http: {
              metadata: {
                concurrentRequests: '10'
              }
            }
          }
        ]
      }
    }
  }
}

output staticWebAppDefaultHostname string = staticWebApp.properties.defaultHostname
output apiFqdn string = apiContainerApp.properties.configuration.ingress.fqdn
