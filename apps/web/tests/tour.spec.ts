import AxeBuilder from "@axe-core/playwright"
import { type Page } from "@playwright/test"

import { expect, test } from "./base"

// The opt-in spotlight tour on Overview (driver.js). It must never start by itself,
// must follow what the user actually does, and must leave the highlighted control
// and the open scenario menu clickable while the rest of the page is masked.
const overlay = (page: Page) => page.locator(".driver-overlay")
const title = (page: Page) => page.locator(".driver-popover-title")
const progress = (page: Page) => page.locator(".driver-popover-progress-text")

async function open(page: Page) {
  await page.goto("/overview")
  await expect(page.locator("#payments-demo-scenario-trigger")).toBeVisible()
}

// The tour is started from the help dialog (or from the welcome dialog on a first visit).
async function startTour(page: Page) {
  await page.getByRole("button", { name: "How this demo works" }).click()
  await page.getByRole("dialog").getByRole("button", { name: "Take the tour" }).click()
  await expect(overlay(page)).toBeVisible()
}

async function chooseScenario(page: Page, name: RegExp) {
  await page.locator("#payments-demo-scenario-trigger").click()
  await page.getByRole("radio", { name }).click()
}

test.describe("Overview tour", () => {
  test("never starts by itself", async ({ page }) => {
    await open(page)
    await page.waitForTimeout(600)

    await expect(overlay(page)).toHaveCount(0)
  })

  test("starts from the help dialog at the first step with Next and close, but no Back", async ({ page }) => {
    await open(page)
    await startTour(page)

    await expect(title(page)).toHaveText("Choose a scenario")
    await expect(progress(page)).toHaveText("Step 1 of 4")
    await expect(page.locator(".driver-popover-next-btn")).toBeVisible()
    await expect(page.locator(".driver-popover-prev-btn")).toBeHidden()
    await expect(page.locator(".driver-popover-close-btn")).toBeVisible()
  })

  test("places each tooltip next to the control it describes", async ({ page }) => {
    await open(page)
    await startTour(page)

    // Step 1: directly under the dropdown, overlapping it horizontally.
    const trigger = (await page.locator("#payments-demo-scenario-trigger").boundingBox())!
    const first = (await page.locator(".driver-popover").boundingBox())!
    expect(first.y - (trigger.y + trigger.height)).toBeLessThan(24)
    expect(first.x).toBeLessThan(trigger.x + trigger.width)
    expect(first.x + first.width).toBeGreaterThan(trigger.x)

    // While the menu is open the tooltip steps aside, then returns for step 2 beside Run.
    await chooseScenario(page, /Mixed 30-day portfolio/)
    await expect(title(page)).toHaveText("Run it")
    await expect(page.locator(".driver-popover")).toBeVisible()
    const run = (await page.locator("#payments-demo-run").boundingBox())!
    const second = (await page.locator(".driver-popover").boundingBox())!
    expect(Math.abs(second.x + second.width - run.x)).toBeLessThan(40)
  })

  test("Next and Back move between the steps", async ({ page }) => {
    await open(page)
    await startTour(page)

    await page.locator(".driver-popover-next-btn").click()
    await expect(progress(page)).toHaveText("Step 2 of 4")
    await page.locator(".driver-popover-prev-btn").click()
    await expect(progress(page)).toHaveText("Step 1 of 4")
    await page.locator(".driver-popover-next-btn").click()
    await page.locator(".driver-popover-next-btn").click()
    await expect(progress(page)).toHaveText("Step 3 of 4")
    await page.locator(".driver-popover-next-btn").click()
    await expect(progress(page)).toHaveText("Step 4 of 4")
    await expect(page.locator(".driver-popover-prev-btn")).toBeVisible()
    await page.locator(".driver-popover-prev-btn").click()
    await expect(progress(page)).toHaveText("Step 3 of 4")
  })

  test("follows the user's real actions and leaves the menu clickable", async ({ page }) => {
    await open(page)
    await startTour(page)
    await expect(page.locator("#payments-demo-run")).toBeDisabled()

    // The highlighted dropdown opens, and its options must still receive clicks.
    await chooseScenario(page, /Mixed 30-day portfolio/)
    await expect(title(page)).toHaveText("Run it")
    await expect(progress(page)).toHaveText("Step 2 of 4")
    await expect(page.locator("#payments-demo-run")).toBeEnabled()

    await page.locator("#payments-demo-run").click()
    await expect(title(page)).toHaveText("Inspect the results")
    await expect(progress(page)).toHaveText("Step 3 of 4")
    await expect(page.getByText("TXN-DEMO-", { exact: false }).first()).toBeVisible()

    await page.locator(".driver-popover-next-btn").click()
    await expect(title(page)).toHaveText("Go deeper")
    await expect(progress(page)).toHaveText("Step 4 of 4")
    await expect(page.locator("#overview-quick-actions")).toBeInViewport()

    await page.locator(".driver-popover").getByRole("button", { name: "Finish" }).click()
    await expect(overlay(page)).toHaveCount(0)
  })

  test("the Go deeper step points at Quick actions, and Analyse a transaction opens the live page", async ({ page }) => {
    await open(page)
    await chooseScenario(page, /Mixed 30-day portfolio/)
    await page.locator("#payments-demo-run").click()
    await startTour(page)
    await page.locator(".driver-popover-next-btn").click()
    await page.locator(".driver-popover-next-btn").click()
    await page.locator(".driver-popover-next-btn").click()
    await expect(title(page)).toHaveText("Go deeper")
    await page.locator(".driver-popover").getByRole("button", { name: "Finish" }).click()

    await page.locator("#overview-quick-actions").getByRole("button", { name: /Analyse a transaction/ }).click()
    await expect(page).toHaveURL(/\/transactions\/new$/)
    await expect(page.getByRole("heading", { name: "Analyse a transaction" })).toBeVisible()
  })

  test("Escape and the close button both end the tour", async ({ page }) => {
    await open(page)
    await startTour(page)
    await page.keyboard.press("Escape")
    await expect(overlay(page)).toHaveCount(0)

    await startTour(page)
    await page.locator(".driver-popover-close-btn").click()
    await expect(overlay(page)).toHaveCount(0)
  })

  test("always starts at step 1, then follows existing progress", async ({ page }) => {
    await open(page)
    await chooseScenario(page, /New-device purchase/)
    await startTour(page)
    await expect(title(page)).toHaveText("Choose a scenario")
    await expect(progress(page)).toHaveText("Step 1 of 4")
    await page.keyboard.press("Escape")

    await page.locator("#payments-demo-run").click()
    await expect(page.getByText("TXN-DEMO-", { exact: false }).first()).toBeVisible()
    await startTour(page)
    await expect(progress(page)).toHaveText("Step 1 of 4")
  })

  test("masks the rest of the page, and clicking the mask ends the tour without clicking through", async ({ page }) => {
    await open(page)
    await startTour(page)

    // The help button is visible at every width and sits under the mask.
    const help = page.getByRole("button", { name: "How this demo works" })
    const box = await help.boundingBox()
    expect(box).not.toBeNull()
    await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2)

    await expect(overlay(page)).toHaveCount(0)
    await expect(page.getByRole("dialog")).toHaveCount(0)
  })

  test("animates by default and skips animation when the user prefers reduced motion", async ({ page }) => {
    await open(page)
    await startTour(page)
    await expect(page.locator("body")).toHaveClass(/driver-fade/)
    await page.keyboard.press("Escape")

    await page.emulateMedia({ reducedMotion: "reduce" })
    await startTour(page)
    await expect(page.locator("body")).not.toHaveClass(/driver-fade/)
  })

  test("the tour popover has no automatically detectable accessibility violations", async ({ page }) => {
    await open(page)
    await startTour(page)
    await expect(title(page)).toBeVisible()
    // Let the fade-in finish, or axe measures contrast against a half-transparent popover.
    await page.waitForTimeout(800)

    // Only the tour's own popover is checked. The page behind the mask has known
    // colour-contrast findings from the design tokens, tracked in the plan.
    const results = await new AxeBuilder({ page })
      .include(".driver-popover")
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze()

    const failures = results.violations.map((violation) => `${violation.id}: ${violation.help}`)
    expect(failures).toEqual([])
  })
})
