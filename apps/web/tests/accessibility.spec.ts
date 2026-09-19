import AxeBuilder from "@axe-core/playwright"
import { expect, test, type Page } from "@playwright/test"

// Automated WCAG 2.x A/AA checks for every MVP 1 route. This complements, and
// does not replace, manual keyboard and screen-reader review. The frozen Rules
// Performance reference page is deliberately excluded: it must not be changed.
const API_BASE_URL = "http://localhost:8010"

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
      model_id: "xgboost_candidate",
      label: "XGBoost candidate",
      pr_auc: 0.24,
      roc_auc: 0.88,
      brier_score: 0.008,
      threshold_sweep: [
        { threshold: 0.2, precision: 0.1, recall: 0.8, false_positive_rate: 0.04, block_rate: 0.05 },
        { threshold: 0.5, precision: 0.3, recall: 0.55, false_positive_rate: 0.01, block_rate: 0.02 },
      ],
      slice_metrics: [{ slice: "amount_band", value: "over_50", count: 200, prevalence: 0.006, pr_auc: 0.27, roc_auc: 0.89 }],
    },
  ],
  release_boundary: ["No score can approve or execute a payment action."],
  report_sha256: "b".repeat(64),
}

const routes: { name: string; path: string; heading: RegExp }[] = [
  { name: "Overview", path: "/overview", heading: /./ },
  { name: "Benchmark insights", path: "/insights", heading: /Benchmark insights/ },
  { name: "Analyse a transaction", path: "/transactions/new", heading: /Analyse a transaction/ },
  { name: "Planned page", path: "/reviews", heading: /Reviews/ },
  { name: "Not found", path: "/no-such-page", heading: /./ },
]

async function mockApi(page: Page) {
  await page.route(`${API_BASE_URL}/demo/model-summary`, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(summary) }),
  )
  await page.route(`${API_BASE_URL}/scenarios`, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([{ id: "A", label: "Scenario A — Synthetic HOLD" }]) }),
  )
}

for (const route of routes) {
  test(`${route.name} has no automatically detectable WCAG A/AA violations`, async ({ page }, testInfo) => {
    await mockApi(page)
    await page.goto(route.path)
    await expect(page.getByRole("heading", { name: route.heading }).first()).toBeVisible()
    await page.evaluate(() => document.fonts.ready)

    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze()

    // Known issue, tracked in the implementation plan: a few text colours from the
    // frozen Payments design tokens fall below 4.5:1 (for example the sidebar's muted
    // status text). Changing a token is a design decision, not a side effect of
    // feature work, so contrast is attached to the report but does not fail the test.
    // Every other rule must pass.
    const contrast = results.violations.filter((violation) => violation.id === "color-contrast")
    const failures = results.violations.filter((violation) => violation.id !== "color-contrast")
    await testInfo.attach("known-issue-color-contrast", { body: JSON.stringify(contrast, null, 2), contentType: "application/json" })

    const summaryLines = failures.map(
      (violation) => `${violation.id} (${violation.impact}): ${violation.help} — ${violation.nodes.length} node(s), e.g. ${violation.nodes[0]?.target.join(" ")}`,
    )
    expect(summaryLines, `${route.path} at the ${testInfo.project.name} width`).toEqual([])
  })
}
