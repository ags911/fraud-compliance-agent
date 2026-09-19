import AxeBuilder from "@axe-core/playwright"

import { expect, test } from "./base"

// The dashboard is the app's Overview route. It carries its own header, section tabs,
// and Explain drawer, and its theme is scoped to the route, so it is tested separately
// from the Payments pages. The shared fixture answers the welcome dialog; welcome.spec
// covers the dialog itself.
test.describe("Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/overview")
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

  test("live pages are tabs, and everything planned sits under More", async ({ page }) => {
    const tabs = page.getByRole("navigation", { name: "Sections" })
    await expect(tabs.getByRole("link", { name: "Overview" })).toHaveAttribute("aria-current", "page")
    await expect(tabs.getByRole("link", { name: "Analyse a transaction" })).toHaveAttribute("href", "/transactions/new")
    await expect(tabs.getByRole("link", { name: "Insights" })).toHaveAttribute("href", "/insights")
    await expect(page.locator('[data-sidebar="menu-button"]')).toHaveCount(0)

    await tabs.getByRole("button", { name: "More" }).click()
    const more = page.locator("[data-radix-popper-content-wrapper]").last()
    await expect(more.getByText("Planned, not built yet")).toBeVisible()
    for (const [name, href] of [["All decisions", "/transactions"], ["Queue", "/reviews"], ["Performance", "/rules/performance"]]) {
      await expect(more.getByRole("link", { name: new RegExp(`^${name}`) })).toHaveAttribute("href", href)
    }
    // Views with no page yet are shown but not linked.
    for (const name of ["Changes", "Drift", "Policies", "Access", "Integrations"]) {
      await expect(more.getByText(new RegExp(`^${name}`))).toBeVisible()
      await expect(more.getByRole("link", { name: new RegExp(`^${name}`) })).toHaveCount(0)
    }
  })

  test("Analyse a transaction is a primary action on the page", async ({ page }) => {
    await expect(page.getByRole("main").getByRole("link", { name: "Analyse a transaction" }).first()).toHaveAttribute("href", "/transactions/new")
  })

  test("there is no date-range control, because nothing on the page is date-filtered", async ({ page }) => {
    await expect(page.getByRole("button", { name: /Sep 2026|Select dates/ })).toHaveCount(0)
  })

  test("the Explain panel is a labelled preview that answers only from the page's figures", async ({ page }) => {
    // The panel is closed until asked for. Closed, it is inert on desktop (slid off-screen but out
    // of the tab order); on a narrow screen it is a sheet that does not exist until opened.
    const narrow = (page.viewportSize()?.width ?? 1440) < 768
    if (narrow) await expect(page.getByRole("region", { name: "Explain" })).toHaveCount(0)
    else await expect(page.locator("[inert]")).toHaveCount(1)
    await page.getByRole("button", { name: "Toggle explain panel" }).click()
    await expect(page.locator("[inert]")).toHaveCount(0)
    const panel = page.getByRole("region", { name: "Explain" })
    await expect(panel.getByText("No language model is connected.")).toBeVisible()
    await expect(panel.getByRole("textbox", { name: "Ask about this page" })).toBeDisabled()
    await expect(panel.getByRole("button", { name: "Which decision has the highest risk?" })).toBeDisabled()
  })

  test("the Explain panel answers from the run, cites its source, and refuses anything else", async ({ page }) => {
    await page.getByRole("button", { name: "Run the mixed 30-day portfolio" }).click()
    await page.getByRole("button", { name: "Toggle explain panel" }).click()
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
    await page.getByRole("button", { name: "Toggle explain panel" }).click()
    const panel = page.getByRole("region", { name: "Explain" })
    await panel.getByRole("button", { name: "What is in the review queue?" }).click()
    await expect(panel.getByRole("log")).toContainText("Source: Review queue")

    // On a narrow screen the panel is a modal sheet, so it is closed before the page is used again.
    if (narrow) await page.keyboard.press("Escape")
    else await page.getByRole("button", { name: "Toggle explain panel" }).click()
    await page.getByRole("button", { name: "Reset demo and return all values to zero" }).click()
    await page.getByRole("button", { name: "Toggle explain panel" }).click()
    await expect(page.getByRole("region", { name: "Explain" }).getByRole("log")).not.toContainText("Source: Review queue")
  })

  test("has a top bar with search, the synthetic label, the scenario control and the Explain toggle", async ({ page }) => {
    await expect(page.getByLabel("Search decisions")).toBeDisabled()
    await expect(page.getByRole("combobox", { name: "Demo scenario" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Toggle explain panel" })).toBeVisible()
  })

  test("has no automatically detectable accessibility violations with the Explain panel used and a section menu open", async ({ page }) => {
    await page.getByRole("button", { name: "Run the mixed 30-day portfolio" }).click()
    await page.getByRole("button", { name: "Toggle explain panel" }).click()
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
    // This test opens its own context, so it answers the first-visit welcome dialog
    // the way the shared fixture does; the dialog is modal until it is answered.
    await context.addInitScript(() => {
      window.sessionStorage.setItem("averlynx-demo-session", JSON.stringify({ welcomeSeen: true }))
    })
    const page = await context.newPage()
    await page.goto("/overview")
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
