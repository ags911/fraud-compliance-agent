targetScope = 'subscription'

@description('Resource group that contains the synthetic showcase.')
param resourceGroupName string

@description('Region for the resource group.')
param location string

@minValue(1)
@description('Monthly budget in the subscription currency. A budget alerts; it does not stop resources.')
param monthlyBudgetAmount int = 10

@description('Alert recipient. Supply a monitored mailbox before deployment.')
param budgetAlertEmail string

@description('First day of the budget period, in YYYY-MM-DD format.')
param budgetStartDate string

resource showcaseResourceGroup 'Microsoft.Resources/resourceGroups@2024-03-01' = {
  name: resourceGroupName
  location: location
}

resource showcaseBudget 'Microsoft.Consumption/budgets@2023-11-01' = {
  name: '${resourceGroupName}-showcase-budget'
  properties: {
    category: 'Cost'
    amount: monthlyBudgetAmount
    timeGrain: 'Monthly'
    timePeriod: {
      startDate: '${budgetStartDate}T00:00:00Z'
    }
    notifications: {
      at80Percent: {
        enabled: true
        operator: 'GreaterThan'
        threshold: 80
        contactEmails: [budgetAlertEmail]
        contactRoles: []
        contactGroups: []
      }
      at100Percent: {
        enabled: true
        operator: 'GreaterThan'
        threshold: 100
        contactEmails: [budgetAlertEmail]
        contactRoles: []
        contactGroups: []
      }
    }
  }
}
