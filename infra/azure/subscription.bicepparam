using './subscription.bicep'

// Copy to a private parameter file before use; the alert address is intentionally
// not committed as project configuration.
param resourceGroupName = 'fraud-compliance-showcase-rg'
param location = 'uksouth'
param monthlyBudgetAmount = 10
param budgetAlertEmail = 'replace-with-monitored-mailbox@example.com'
param budgetStartDate = '2026-10-01'
