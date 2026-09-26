import AxeBuilder from "@axe-core/playwright"
import { expect, test, type Page } from "@playwright/test"

// Radar's opt in spotlight tour (spec 0007, driver.js). It must never start by
// itself, must visit its six targets in order, and must describe only what
// Radar has today.
const overlay = (page: Page) => page.locator(".driver-overlay")
const title = (page: Page) => page.locator(".driver-popover-title")
const progress = (page: Page) => page.locator(".driver-popover-progress-text")

const STEPS = [
  { title: "Choose a scenario", target: "#radar-scenario-trigger" },
  { title: "The live feed", target: "#radar-live-switch" },
  { title: "Run showcase", target: "#radar-run-showcase" },
  { title: "Cases", target: "#radar-cases-tab" },
  { title: "Scenario figures", target: "#radar-summary" },
  { title: "Recommendations over time", target: "#radar-recommendations" },
]

// The tour is not about the feed: start from a browser that switched Live off,
// and never let a start reach a real API.
async function open(page: Page) {
  await page.addInitScript(() => window.localStorage.setItem("radar-live-feed", "off"))
  await page.route("**/sandbox/scenarios/*/simulation-runs", (route) =>
    route.fulfill({ status: 503, contentType: "application/json", body: "{}" }),
  )
  await page.goto("/references/radar-reference.html?scenario=S01")
  await expect(page.locator("#radar-scenario-trigger")).toBeVisible()
}

async function startTour(page: Page) {
  await page.getByRole("button", { name: "How this dashboard works" }).click()
  await expect(overlay(page)).toBeVisible()
}

test.describe("Radar tour", () => {
  test("never starts by itself", async ({ page }) => {
    await open(page)
    await page.waitForTimeout(600)

    await expect(overlay(page)).toHaveCount(0)
  })

  test("starts at step 1 of 6 with Next and close, but no Back", async ({ page }) => {
    await open(page)
    await startTour(page)

    await expect(title(page)).toHaveText("Choose a scenario")
    await expect(progress(page)).toHaveText("Step 1 of 6")
    await expect(page.locator(".driver-popover-next-btn")).toBeVisible()
    await expect(page.locator(".driver-popover-prev-btn")).toBeHidden()
    await expect(page.locator(".driver-popover-close-btn")).toBeVisible()
  })

  test("Next visits each target in order, Back returns, and the last step finishes", async ({ page }) => {
    await open(page)
    await startTour(page)

    for (const [index, step] of STEPS.entries()) {
      await expect(title(page)).toHaveText(step.title)
      await expect(progress(page)).toHaveText(`Step ${index + 1} of ${STEPS.length}`)
      await expect(page.locator(step.target)).toHaveClass(/driver-active-element/)
      if (index < STEPS.length - 1) await page.locator(".driver-popover-next-btn").click()
    }
    await expect(page.locator(".driver-popover-next-btn")).toHaveText("Finish")

    await page.locator(".driver-popover-prev-btn").click()
    await expect(title(page)).toHaveText("Scenario figures")

    await page.locator(".driver-popover-next-btn").click()
    await page.locator(".driver-popover-next-btn").click()
    await expect(overlay(page)).toHaveCount(0)
  })

  test("describes only what Radar has today", async ({ page }) => {
    await open(page)
    await startTour(page)

    const copy: string[] = []
    for (let index = 0; index < STEPS.length; index += 1) {
      copy.push((await page.locator(".driver-popover-description").textContent()) ?? "")
      if (index < STEPS.length - 1) await page.locator(".driver-popover-next-btn").click()
    }
    const text = copy.join(" ")
    expect(text).toContain("No model score decides anything")
    expect(text).toContain("read only")
    // Planned stages stay out until they ship.
    expect(text).not.toMatch(/Health|review queue|S06|S07|S08|coming soon/i)
  })

  test("starting from the Cases tab moves to the Scenario tab first", async ({ page }) => {
    await open(page)
    await page.getByRole("tab", { name: /^Cases/ }).click()
    await expect(page.locator("#radar-summary")).toHaveCount(0)

    await startTour(page)
    await expect(page.getByRole("tab", { name: "Scenario" })).toHaveAttribute("aria-selected", "true")
    await expect(page.locator("#radar-summary")).toBeVisible()
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

  test("the scenario picker stays usable during step 1", async ({ page }) => {
    await open(page)
    await startTour(page)

    await page.locator("#radar-scenario-trigger").click()
    await page.getByRole("option", { name: /^S03/ }).click()
    await expect(page.locator("#radar-scenario-trigger")).toContainText("S03")
    await expect(title(page)).toHaveText("Choose a scenario")
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
    // Let the fade in finish, or axe measures contrast against a half transparent popover.
    await page.waitForTimeout(800)

    const results = await new AxeBuilder({ page })
      .include(".driver-popover")
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze()

    expect(results.violations.map((violation) => `${violation.id}: ${violation.help}`)).toEqual([])
  })
})
