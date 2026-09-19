targetScope = 'resourceGroup'

@description('Azure region for the synthetic showcase resources.')
param location string

@description('Globally unique Azure Static Web Apps resource name.')
param staticWebAppName string

@description('Container Apps managed environment name.')
param containerEnvironmentName string

@description('Container App name for the public showcase API.')
param apiContainerAppName string

@description('Immutable public image reference. Do not use a mutable tag.')
param apiImage string

@description('Optional resource tags for ownership and cost tracing.')
param tags object = {}

resource staticWebApp 'Microsoft.Web/staticSites@2023-12-01' = {
  name: staticWebAppName
  location: location
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
      destination: 'none'
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
            cpu: 0.25
            memory: '0.5Gi'
          }
          env: [
            {
              name: 'ALLOWED_ORIGINS'
              value: 'https://${staticWebApp.properties.defaultHostname}'
            }
          ]
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
