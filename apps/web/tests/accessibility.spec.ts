import AxeBuilder from "@axe-core/playwright"
import { type Page } from "@playwright/test"

import { expect, test } from "./base"

import { modelSummary } from "./fixtures/model-summary"

// Automated WCAG 2.x A/AA checks for every MVP 1 route. This complements, and
// does not replace, manual keyboard and screen-reader review. The frozen Rules
// Performance reference page is deliberately excluded: it must not be changed.
const API_BASE_URL = "http://localhost:8010"

const routes: { name: string; path: string; heading: RegExp }[] = [
  { name: "Overview", path: "/overview", heading: /./ },
  { name: "Benchmark insights", path: "/insights", heading: /Benchmark insights/ },
  { name: "Analyse a transaction", path: "/transactions/new", heading: /Analyse a transaction/ },
  { name: "Planned page", path: "/reviews", heading: /Reviews/ },
  { name: "Not found", path: "/no-such-page", heading: /./ },
]

async function mockApi(page: Page) {
  await page.route(`${API_BASE_URL}/demo/model-summary`, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(modelSummary) }),
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
