import AxeBuilder from "@axe-core/playwright"
import { expect, test } from "@playwright/test"

// The standalone shadcn dashboard (dashboard.html). It has its own theme and does not
// share the Payments design system, so it is tested separately from the console.
test.describe("Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard.html")
    await expect(page.getByRole("heading", { name: "Dashboard", level: 1 })).toBeVisible()
  })

  test("starts at zero, then shows the same synthetic figures as Overview after a run", async ({ page }) => {
    const summary = page.getByRole("region", { name: "Dashboard summary" })
    await expect(summary).toContainText("£0.00")
    await expect(page.getByText("Run a scenario to see decisions.")).toBeVisible()
    await expect(page.getByRole("button", { name: "Run", exact: true })).toBeDisabled()

    await page.getByRole("combobox", { name: "Demo scenario" }).click()
    await page.getByRole("option", { name: /Mixed 30-day portfolio/ }).click()
    await page.getByRole("button", { name: "Run", exact: true }).click()

    await expect(summary).toContainText("£1.24m")
    await expect(summary).toContainText("12,842")
    await expect(page.getByText("fraud-risk-v4.2")).toBeVisible()
    await expect(page.getByText("Unavailable")).toBeVisible()
    await expect(page.getByRole("row")).toHaveCount(6)

    await page.getByRole("searchbox", { name: "Search decisions" }).or(page.getByLabel("Search decisions")).fill("Jordan")
    await expect(page.getByRole("row")).toHaveCount(2)

    await page.getByRole("button", { name: "Reset demo and return all values to zero" }).click()
    await expect(summary).toContainText("£0.00")
  })

  test("one click on the empty state runs the mixed portfolio, and Held and Review queue carry context", async ({ page }) => {
    await page.getByRole("button", { name: "Run the mixed 30-day portfolio" }).click()

    const summary = page.getByRole("region", { name: "Dashboard summary" })
    await expect(summary).toContainText("7.0% of transactions")
    await expect(summary).toContainText("Oldest review 46 min")
    await expect(page.getByText("Nothing has run yet")).toHaveCount(0)
  })

  test("Quick actions link to the live decision page and benchmark insights", async ({ page }) => {
    await expect(page.getByRole("link", { name: /Analyse a transaction/ }).last()).toHaveAttribute("href", "/transactions/new")
    await expect(page.getByRole("link", { name: /Benchmark insights/ }).last()).toHaveAttribute("href", "/insights")
  })

  test("has a top bar with search, the demo label, the scenario control and the date range", async ({ page }) => {
    await expect(page.getByLabel("Search decisions")).toBeDisabled()
    await expect(page.getByRole("combobox", { name: "Demo scenario" })).toBeVisible()
    await expect(page.getByRole("button", { name: /Sep 2026/ })).toBeVisible()
  })

  test("links only to pages that exist, and marks the current page", async ({ page }) => {
    // Below 768px the sidebar is a sheet that opens from the trigger.
    if ((page.viewportSize()?.width ?? 1440) < 768) await page.getByRole("button", { name: "Toggle navigation menu" }).click()
    const nav = page.getByRole("dialog").or(page.locator('[data-sidebar="sidebar"]')).first()
    await expect(nav.getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page")
    for (const [name, href] of [["Overview", "/overview"], ["Analyse a transaction", "/transactions/new"], ["Benchmark insights", "/insights"]]) {
      await expect(nav.getByRole("link", { name })).toHaveAttribute("href", href)
    }
  })

  test("has no automatically detectable accessibility violations", async ({ page }) => {
    await page.waitForTimeout(800)
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze()
    expect(results.violations.map((violation) => `${violation.id}: ${violation.help}`)).toEqual([])
  })

  test("is light by default even when the system prefers dark, and the toggle is remembered", async ({ browser, baseURL }) => {
    const context = await browser.newContext({ baseURL, colorScheme: "dark" })
    const page = await context.newPage()
    await page.goto("/dashboard.html")
    await expect(page.getByRole("button", { name: "Switch to dark theme" })).toBeVisible()
    await expect(page.locator("html")).not.toHaveClass(/dark/)

    await page.getByRole("button", { name: "Switch to dark theme" }).click()
    await expect(page.locator("html")).toHaveClass(/dark/)
    await page.reload()
    await expect(page.locator("html")).toHaveClass(/dark/)
    await expect(page.getByRole("button", { name: "Switch to light theme" })).toBeVisible()
    await context.close()
  })
})
