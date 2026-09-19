import AxeBuilder from "@axe-core/playwright"
import { expect, test, type Page } from "@playwright/test"

// The first-visit welcome dialog on Overview. It offers the tour or skipping it,
// remembers the answer for the browser session, and replaces the old on-page
// "Getting started" checklist. These tests use plain Playwright (not the shared
// fixture) because they need a session that has not answered the dialog yet.
const welcome = (page: Page) => page.getByRole("dialog", { name: "Welcome to the payment risk demo" })
const overlay = (page: Page) => page.locator(".driver-overlay")
const trigger = (page: Page) => page.locator("#payments-demo-scenario-trigger")

async function openFresh(page: Page) {
  await page.goto("/overview")
  await expect(welcome(page)).toBeVisible()
}

test.describe("Welcome dialog", () => {
  test("appears on the first visit and says the data is synthetic", async ({ page }) => {
    await openFresh(page)

    await expect(welcome(page)).toContainText("Synthetic data")
    await expect(welcome(page)).toContainText("Nothing here can approve, release, or execute a real payment")
    await expect(welcome(page).getByRole("button", { name: "Take the tour" })).toBeVisible()
    await expect(welcome(page).getByRole("button", { name: "Skip" })).toBeVisible()
  })

  test("is modal: the page behind it is unavailable until it is answered", async ({ page }) => {
    await openFresh(page)

    await expect(page.getByRole("button", { name: "How this demo works" })).toHaveCount(0)
    await expect(overlay(page)).toHaveCount(0)
  })

  test("Skip closes it, starts nothing, and it does not return after a reload", async ({ page }) => {
    await openFresh(page)
    await welcome(page).getByRole("button", { name: "Skip" }).click()

    await expect(welcome(page)).toHaveCount(0)
    await expect(trigger(page)).toBeVisible()
    await page.waitForTimeout(500)
    await expect(overlay(page)).toHaveCount(0)

    await page.reload()
    await expect(trigger(page)).toBeVisible()
    await expect(welcome(page)).toHaveCount(0)
  })

  test("Escape counts as skipping", async ({ page }) => {
    await openFresh(page)
    await page.keyboard.press("Escape")

    await expect(welcome(page)).toHaveCount(0)
    await expect(overlay(page)).toHaveCount(0)
  })

  test("Take the tour closes it and starts the tour at the first step", async ({ page }) => {
    await openFresh(page)
    await welcome(page).getByRole("button", { name: "Take the tour" }).click()

    await expect(welcome(page)).toHaveCount(0)
    await expect(overlay(page)).toBeVisible()
    await expect(page.locator(".driver-popover-title")).toHaveText("Choose a scenario")

    await page.reload()
    await expect(trigger(page)).toBeVisible()
    await expect(welcome(page)).toHaveCount(0)
  })

  test("a new browser session shows it again", async ({ browser, baseURL }) => {
    const context = await browser.newContext({ baseURL })
    const page = await context.newPage()
    await openFresh(page)
    await welcome(page).getByRole("button", { name: "Skip" }).click()
    await context.close()

    const second = await browser.newContext({ baseURL })
    const secondPage = await second.newPage()
    await openFresh(secondPage)
    await second.close()
  })

  test("Reset does not bring the welcome back", async ({ page }) => {
    await openFresh(page)
    await welcome(page).getByRole("button", { name: "Skip" }).click()
    await trigger(page).click()
    await page.getByRole("option", { name: /New-device purchase/ }).click()
    await page.locator("#payments-demo-run").click()
    await page.getByRole("button", { name: "Reset demo and return all values to zero" }).click()

    await expect(welcome(page)).toHaveCount(0)
  })

  test("the dashboard no longer carries a Getting started checklist", async ({ page }) => {
    await openFresh(page)
    await welcome(page).getByRole("button", { name: "Skip" }).click()

    await expect(page.getByRole("region", { name: "Getting started" })).toHaveCount(0)
    await expect(page.getByText("Getting started")).toHaveCount(0)
    await expect(page.getByText(/of 3 completed/)).toHaveCount(0)
  })

  test("the help dialog still explains the three steps and offers the tour", async ({ page }) => {
    await openFresh(page)
    await welcome(page).getByRole("button", { name: "Skip" }).click()
    await page.getByRole("button", { name: "How this demo works" }).click()

    const help = page.getByRole("dialog")
    await expect(help.getByRole("listitem")).toHaveText([/Choose a scenario/, /Run the scenario/, /Inspect the results/])
    await expect(help.getByRole("button", { name: "Take the tour" })).toBeVisible()
  })

  test("has no automatically detectable accessibility violations", async ({ page }) => {
    await openFresh(page)

    const results = await new AxeBuilder({ page })
      .include('[role="dialog"]')
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze()

    expect(results.violations.map((violation) => `${violation.id}: ${violation.help}`)).toEqual([])
  })
})
