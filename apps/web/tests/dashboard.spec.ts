import AxeBuilder from "@axe-core/playwright"
import { expect, test } from "@playwright/test"

// The standalone shadcn dashboard (dashboard.html). It has its own theme and does not
// share the Payments design system, so it is tested separately from the console.
test.describe("Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard.html")
    await expect(page.getByRole("heading", { name: "Fraud risk", level: 1 })).toBeVisible()
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
    await expect(page.locator("table").last().getByRole("row")).toHaveCount(6)

    await page.getByRole("searchbox", { name: "Search decisions" }).or(page.getByLabel("Search decisions")).fill("Jordan")
    await expect(page.locator("table").last().getByRole("row")).toHaveCount(2)

    await page.getByRole("button", { name: "Reset demo and return all values to zero" }).click()
    await expect(summary).toContainText("£0.00")
  })

  test("one click on the empty state runs the mixed portfolio, and the KPIs carry route-share and queue context", async ({ page }) => {
    await page.getByRole("button", { name: "Run the mixed 30-day portfolio" }).click()

    const summary = page.getByRole("region", { name: "Dashboard summary" })
    await expect(summary).toContainText("7.0% of transactions")
    await expect(summary).toContainText("Oldest review 46 min")
    await expect(page.getByText("Nothing has run yet")).toHaveCount(0)
  })

  test("draws no trend lines or time-series charts, because there is no recorded history to show", async ({ page }) => {
    for (const scenario of [/Mixed 30-day portfolio/, /New-device purchase/]) {
      await page.getByRole("combobox", { name: "Demo scenario" }).click()
      await page.getByRole("option", { name: scenario }).click()
      await page.getByRole("button", { name: "Run", exact: true }).click()

      await expect(page.getByText("fraud-risk-v4.2")).toBeVisible()
      await expect(page.getByRole("figure")).toHaveCount(0)
      await expect(page.locator(".recharts-wrapper")).toHaveCount(0)
      await expect(page.getByText(/vs prior 7 days/)).toHaveCount(0)
      await expect(page.getByText(/Synthetic 30-day series/)).toHaveCount(0)
    }
  })

  test("Quick actions link to the live decision page and benchmark insights", async ({ page }) => {
    await expect(page.getByRole("link", { name: /Analyse a transaction/ }).last()).toHaveAttribute("href", "/transactions/new")
    await expect(page.getByRole("link", { name: /Benchmark insights/ }).last()).toHaveAttribute("href", "/insights")
  })

  test("says the data is synthetic in the page, not in the sidebar", async ({ page }) => {
    await expect(page.getByText("All data is synthetic, and nothing here can approve, release, or execute a real payment.")).toBeVisible()
    await expect(page.getByText("Synthetic demo. Nothing here is a real payment.")).toHaveCount(0)
  })

  test("all navigation lives in the section tabs, and only real pages are linked", async ({ page }) => {
    const tabs = page.getByRole("navigation", { name: "Sections" })
    await expect(tabs.getByRole("link", { name: "Overview" })).toHaveAttribute("aria-current", "page")
    await expect(page.locator('[data-sidebar="menu-button"]')).toHaveCount(0)

    const menu = page.getByRole("dialog").or(page.locator("[data-radix-popper-content-wrapper]")).last()
    for (const [section, live, missing] of [
      ["Transactions", [["Analyse a transaction", "/transactions/new"], ["All decisions", "/transactions"]], []],
      ["Insights", [["Model benchmark", "/insights"]], ["Drift"]],
      ["Rules", [["Performance", "/rules/performance"]], ["Changes"]],
      ["Reviews", [["Queue", "/reviews"]], []],
      ["Settings", [], ["Policies", "Access", "Integrations"]],
    ] as const) {
      await tabs.getByRole("button", { name: new RegExp(`^${section}`) }).click()
      for (const [name, href] of live) await expect(menu.getByRole("link", { name: new RegExp(`^${name}`) })).toHaveAttribute("href", href)
      for (const name of missing) {
        await expect(menu.getByText(new RegExp(`^${name}`))).toBeVisible()
        await expect(menu.getByRole("link", { name: new RegExp(`^${name}`) })).toHaveCount(0)
      }
      await page.keyboard.press("Escape")
    }
  })

  test("the Explain panel is a labelled preview that answers only from the page's figures", async ({ page }) => {
    // Below 768px the panel is a sheet that opens from the toggle; above it, it is open already.
    if ((page.viewportSize()?.width ?? 1440) < 768) await page.getByRole("button", { name: "Toggle explain panel" }).click()
    const panel = page.getByRole("region", { name: "Explain" })
    await expect(panel.getByText("No language model is connected.")).toBeVisible()
    await expect(panel.getByRole("textbox", { name: "Ask about this page" })).toBeDisabled()
    await expect(panel.getByRole("button", { name: "Which decision has the highest risk?" })).toBeDisabled()
  })

  test("the Explain panel answers from the run, cites its source, and refuses anything else", async ({ page }) => {
    const narrow = (page.viewportSize()?.width ?? 1440) < 768
    await page.getByRole("button", { name: "Run the mixed 30-day portfolio" }).click()
    if (narrow) await page.getByRole("button", { name: "Toggle explain panel" }).click()
    const panel = page.getByRole("region", { name: "Explain" })
    const log = panel.getByRole("log", { name: "Conversation" })

    await panel.getByRole("button", { name: "Which decision has the highest risk?" }).click()
    await expect(log).toContainText("TXN-DEMO-1047")
    await expect(log).toContainText("scored 94%")
    await expect(log).toContainText("Source: Recent decisions")

    await panel.getByRole("textbox", { name: "Ask about this page" }).fill("how many are in the review queue?")
    await panel.getByRole("button", { name: "Send" }).click()
    await expect(log).toContainText("holds 18 case(s)")

    await panel.getByRole("textbox", { name: "Ask about this page" }).fill("what is the weather")
    await page.keyboard.press("Enter")
    await expect(log).toContainText("I can only answer questions about the figures on this page.")

    await panel.getByRole("button", { name: "Is the model performing well?" }).click()
    await expect(log).toContainText("I can't say.")
    await expect(log).toContainText("Unavailable")
  })

  test("a new run starts a fresh conversation", async ({ page }) => {
    const narrow = (page.viewportSize()?.width ?? 1440) < 768
    await page.getByRole("button", { name: "Run the mixed 30-day portfolio" }).click()
    if (narrow) await page.getByRole("button", { name: "Toggle explain panel" }).click()
    const panel = page.getByRole("region", { name: "Explain" })
    await panel.getByRole("button", { name: "What is in the review queue?" }).click()
    await expect(panel.getByRole("log")).toContainText("Source: Review queue")

    if (narrow) await page.keyboard.press("Escape")
    await page.getByRole("button", { name: "Reset demo and return all values to zero" }).click()
    if (narrow) await page.getByRole("button", { name: "Toggle explain panel" }).click()
    await expect(page.getByRole("region", { name: "Explain" }).getByRole("log")).not.toContainText("Source: Review queue")
  })

  test("has a top bar with search, the demo label, the scenario control and the date range", async ({ page }) => {
    await expect(page.getByLabel("Search decisions")).toBeDisabled()
    await expect(page.getByRole("combobox", { name: "Demo scenario" })).toBeVisible()
    await expect(page.getByRole("button", { name: /Sep 2026/ })).toBeVisible()
  })

  test("has no automatically detectable accessibility violations with the Explain panel used and a section menu open", async ({ page }) => {
    const narrow = (page.viewportSize()?.width ?? 1440) < 768
    await page.getByRole("button", { name: "Run the mixed 30-day portfolio" }).click()
    if (narrow) await page.getByRole("button", { name: "Toggle explain panel" }).click()
    await page.getByRole("region", { name: "Explain" }).getByRole("button", { name: "Which decision has the highest risk?" }).click()
    await page.waitForTimeout(800)

    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze()
    expect(results.violations.map((violation) => `${violation.id}: ${violation.help}`)).toEqual([])
  })

  test("has no automatically detectable accessibility violations before a run", async ({ page }) => {
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
