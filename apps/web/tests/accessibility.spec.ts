import AxeBuilder from "@axe-core/playwright"
import { expect, test, type Page } from "@playwright/test"

import { modelSummary } from "./fixtures/model-summary"

// Automated WCAG 2.x A/AA checks for each Risk Console tab. This complements,
// and does not replace, manual keyboard and screen-reader review. The Sandbox
// API is left unavailable, the public site's state; the benchmark is stubbed.
const API_BASE_URL = "http://localhost:8010"

const tabs = ["Scenario", "Cases", "Model"] as const

async function mockApi(page: Page) {
  await page.route(`${API_BASE_URL}/**`, (route) => route.fulfill({ status: 503, json: { detail: "sandbox_scenario_data_unavailable" } }))
  await page.route(`${API_BASE_URL}/demo/model-summary`, (route) => route.fulfill({ json: modelSummary }))
}

for (const tab of tabs) {
  test(`the ${tab} tab has no automatically detectable WCAG A/AA violations`, async ({ page }, testInfo) => {
    await mockApi(page)
    await page.goto("/")
    await page.getByRole("tab", { name: new RegExp(`^${tab}`) }).click()
    await expect(page.getByRole("tab", { name: new RegExp(`^${tab}`) })).toHaveAttribute("aria-selected", "true")
    await page.evaluate(() => document.fonts.ready)

    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze()

    const summaryLines = results.violations.map(
      (violation) => `${violation.id} (${violation.impact}): ${violation.help} — ${violation.nodes.length} node(s), e.g. ${violation.nodes[0]?.target.join(" ")}`,
    )
    expect(summaryLines, `${tab} tab at the ${testInfo.project.name} width`).toEqual([])
  })
}
