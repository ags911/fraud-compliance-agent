import { expect, test } from "@playwright/test"

const summary = {
  artifact: "synthetic_benchmark_model_summary",
  status: "mechanics_evaluation_complete_not_deployable",
  data_source: "Sparkov simulated credit-card transactions",
  training_scope: "mechanics_only",
  dataset_sha256: "a".repeat(64),
  feature_columns: ["amount_source_value", "event_hour_utc", "event_day_of_week_utc", "is_weekend"],
  partition_counts: { train: 1000, calibration: 200, test: 300 },
  test_prevalence: 0.005,
  model_results: [
    {
      model_id: "logistic_regression_baseline",
      label: "Logistic Regression baseline",
      pr_auc: 0.12,
      roc_auc: 0.75,
      brier_score: 0.01,
      threshold_sweep: [],
      slice_metrics: [],
    },
    {
      model_id: "xgboost_candidate",
      label: "XGBoost candidate",
      pr_auc: 0.24,
      roc_auc: 0.88,
      brier_score: 0.008,
      threshold_sweep: [
        { threshold: 0.2, precision: 0.1, recall: 0.8, false_positive_rate: 0.04, block_rate: 0.05 },
        { threshold: 0.5, precision: 0.3, recall: 0.55, false_positive_rate: 0.01, block_rate: 0.02 },
      ],
      slice_metrics: [
        { slice: "amount_band", value: "up to_50", count: 100, prevalence: 0.004, pr_auc: 0.18, roc_auc: 0.8 },
        { slice: "amount_band", value: "over_50", count: 200, prevalence: 0.006, pr_auc: 0.27, roc_auc: 0.89 },
      ],
    },
  ],
  release_boundary: ["No score can approve or execute a payment action."],
  report_sha256: "b".repeat(64),
}

test("benchmark charts use the shared compact contract with readable tooltips", async ({ page }, testInfo) => {
  await page.route("http://localhost:8010/demo/model-summary", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(summary) })
  })

  await page.goto("/insights")
  await page.evaluate(() => document.fonts.ready)
  await expect(page.getByRole("heading", { name: "Benchmark insights" })).toBeVisible()
  const charts = page.locator(".payments-chart-compact")
  await expect(charts).toHaveCount(3)
  await expect(charts.first()).toHaveCSS("height", "245px")
  await expect(page).toHaveScreenshot(`benchmark-insights-${testInfo.project.name}.png`, {
    fullPage: true,
  })

  await page.locator(".recharts-bar-rectangle path").first().hover()
  const tooltip = page.locator(".recharts-tooltip-wrapper").filter({ hasText: "PR-AUC" }).first()
  await expect(tooltip).toBeVisible()
  await expect(tooltip).toContainText("PR-AUC")
  await expect(page).toHaveScreenshot(`benchmark-tooltip-${testInfo.project.name}.png`, {
    fullPage: true,
  })
})
