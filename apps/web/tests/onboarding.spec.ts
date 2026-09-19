import { expect, test, type Page } from "@playwright/test"

import { modelSummary } from "./fixtures/model-summary"

// The "Getting started" guide on Overview: three steps (choose, run, inspect) whose
// progress must complete visibly, persist within the tab, and stay recoverable when
// dismissed. Each test starts with an empty session because Playwright isolates
// browser storage per test.
const API_BASE_URL = "http://localhost:8010"

const guide = (page: Page) => page.getByRole("region", { name: "Getting started" })
const count = (page: Page, done: number) => page.getByText(`${done} of 3 completed`, { exact: true })

async function open(page: Page) {
  await page.route(`${API_BASE_URL}/scenarios`, (route) => route.fulfill({ status: 200, contentType: "application/json", body: "[]" }))
  await page.route(`${API_BASE_URL}/demo/model-summary`, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(modelSummary) }),
  )
  await page.goto("/overview")
  await expect(count(page, 0)).toBeVisible()
}

async function choose(page: Page, name: RegExp) {
  // The trigger's accessible name changes once a scenario is chosen, so use its id.
  await page.locator("#payments-demo-scenario-trigger").click()
  await page.getByRole("radio", { name }).click()
}

async function run(page: Page) {
  await page.getByRole("button", { name: "Run", exact: true }).click()
}

// On the narrow (mobile) project the sidebar is a sheet, so open it before using a link.
// On desktop it is always visible, and toggling it would collapse it to icons.
async function goTo(page: Page, name: string) {
  if (test.info().project.name === "mobile") {
    await page.getByRole("button", { name: "Toggle navigation menu" }).click()
  }
  await page.getByRole("link", { name, exact: true }).click()
}

async function completeAllSteps(page: Page) {
  await choose(page, /New-device purchase/)
  await expect(count(page, 1)).toBeVisible()
  await run(page)
  await expect(count(page, 2)).toBeVisible()
  await page.getByRole("button", { name: "View results" }).click()
  await expect(count(page, 3)).toBeVisible()
}

test.describe("Getting started guide", () => {
  test("each step completes visibly, in order, with a text alternative", async ({ page }) => {
    await open(page)
    await expect(guide(page).getByRole("listitem")).toHaveCount(3)

    await choose(page, /New-device purchase/)
    await expect(count(page, 1)).toBeVisible()
    await expect(guide(page).getByText("Completed: Choose a scenario")).toBeAttached()

    await run(page)
    await expect(count(page, 2)).toBeVisible()
    await expect(guide(page).getByText("Completed: Run the scenario")).toBeAttached()

    await page.getByRole("button", { name: "View results" }).click()
    await expect(count(page, 3)).toBeVisible()
    await expect(guide(page).getByText("Completed: Inspect the results")).toBeAttached()
    await expect(guide(page).getByRole("progressbar", { name: "Getting started progress" })).toHaveAttribute("aria-valuenow", "3")
  })

  test("progress survives a reload and navigating away and back", async ({ page }) => {
    await open(page)
    await completeAllSteps(page)

    await page.reload()
    await expect(count(page, 3)).toBeVisible()

    await goTo(page, "Insights")
    await expect(page).toHaveURL(/\/insights$/)
    await goTo(page, "Overview")
    await expect(count(page, 3)).toBeVisible()
  })

  test("scrolling to the results is not treated as inspecting them", async ({ page }) => {
    await open(page)
    await choose(page, /New-device purchase/)
    await run(page)
    await expect(count(page, 2)).toBeVisible()

    await page.locator("#overview-results").scrollIntoViewIfNeeded()
    await expect(count(page, 2)).toBeVisible()
    await expect(page.getByRole("button", { name: "View results" })).toBeVisible()
  })

  test("a new run or a new choice needs its results inspected again", async ({ page }) => {
    await open(page)
    await completeAllSteps(page)

    await run(page)
    await expect(count(page, 2)).toBeVisible()

    await page.getByRole("button", { name: "View results" }).click()
    await expect(count(page, 3)).toBeVisible()
    await choose(page, /High-velocity transfer/)
    await expect(count(page, 1)).toBeVisible()
  })

  test("dismissing keeps the guide hidden after a reload, and it can be reopened", async ({ page }) => {
    await open(page)
    await page.getByRole("button", { name: "Dismiss getting started guide" }).click()
    await expect(guide(page)).toBeHidden()

    await page.reload()
    await expect(guide(page)).toBeHidden()

    await page.getByRole("button", { name: "How this demo works" }).click()
    await page.getByRole("button", { name: "Show getting started guide" }).click()
    await expect(guide(page)).toBeVisible()
    await expect(count(page, 0)).toBeVisible()
  })

  test("the reopen control only appears while the guide is dismissed", async ({ page }) => {
    await open(page)
    await page.getByRole("button", { name: "How this demo works" }).click()
    await expect(page.getByRole("button", { name: "Show getting started guide" })).toHaveCount(0)
  })

  test("Reset clears progress but respects a dismissed guide", async ({ page }) => {
    await open(page)
    await completeAllSteps(page)
    await page.getByRole("button", { name: "Dismiss getting started guide" }).click()

    await page.getByRole("button", { name: "Reset demo and return all values to zero" }).click()
    await expect(guide(page)).toBeHidden()

    await page.getByRole("button", { name: "How this demo works" }).click()
    await page.getByRole("button", { name: "Show getting started guide" }).click()
    await expect(count(page, 0)).toBeVisible()
  })

  test("the help dialog shows the same progress as the guide", async ({ page }) => {
    await open(page)
    await completeAllSteps(page)

    await page.getByRole("button", { name: "How this demo works" }).click()
    const dialog = page.getByRole("dialog")
    await expect(dialog.locator('li[data-complete="true"]')).toHaveCount(3)
  })
})
