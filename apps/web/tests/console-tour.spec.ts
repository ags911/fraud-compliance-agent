import AxeBuilder from "@axe-core/playwright"
import { expect, test, type Page } from "@playwright/test"

// Risk Console's spotlight tour (spec 0007, driver.js). It starts by itself
// once for a new browser (AC-1, amended 2026-09-30), offers Skip on every step
// but the last, visits its seven steps in order, and describes only what
// Risk Console has today. "Raised by model" (spec 0010) has no target: its
// routing board sits on the Cases tab.
const overlay = (page: Page) => page.locator(".driver-overlay")
const title = (page: Page) => page.locator(".driver-popover-title")
const progress = (page: Page) => page.locator(".driver-popover-progress-text")

const STEPS: { title: string; target: string | null }[] = [
  { title: "Choose a scenario", target: "#console-scenario-trigger" },
  { title: "The live feed", target: "#console-live-switch" },
  { title: "Run showcase", target: "#console-run-showcase" },
  { title: "Cases", target: "#console-cases-tab" },
  { title: "Raised by model", target: null },
  { title: "Scenario figures", target: "#console-summary" },
  { title: "Recommendations over time", target: "#console-recommendations" },
]

// The tour is not about the feed: start from a browser that switched Live off,
// and never let a start reach a real API.
async function open(page: Page) {
  await page.addInitScript(() => window.localStorage.setItem("console-live-feed", "off"))
  await page.route("**/sandbox/scenarios/*/simulation-runs", (route) =>
    route.fulfill({ status: 503, contentType: "application/json", body: "{}" }),
  )
  await page.goto("/?scenario=S01")
  await expect(page.locator("#console-scenario-trigger")).toBeVisible()
}

async function startTour(page: Page) {
  await page.getByRole("button", { name: "How this dashboard works" }).click()
  await expect(overlay(page)).toBeVisible()
}

test.describe("Risk Console tour", () => {
  // covers: AC-1 (the config marks every test browser as having seen the tour)
  test("does not start by itself for a browser that has seen it", async ({ page }) => {
    await open(page)
    await page.waitForTimeout(600)

    await expect(overlay(page)).toHaveCount(0)
  })

  test("starts at step 1 of 7 with Next and close, but no Back", async ({ page }) => {
    await open(page)
    await startTour(page)

    await expect(title(page)).toHaveText("Choose a scenario")
    await expect(progress(page)).toHaveText("Step 1 of 7")
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
      if (step.target) await expect(page.locator(step.target)).toHaveClass(/driver-active-element/)
      if (index < STEPS.length - 1) await page.locator(".driver-popover-next-btn").click()
    }
    await expect(page.locator(".driver-popover-next-btn")).toHaveText("Finish")

    await page.locator(".driver-popover-prev-btn").click()
    await expect(title(page)).toHaveText("Scenario figures")

    await page.locator(".driver-popover-next-btn").click()
    await page.locator(".driver-popover-next-btn").click()
    await expect(overlay(page)).toHaveCount(0)
  })

  test("describes only what Risk Console has today", async ({ page }) => {
    await open(page)
    await startTour(page)

    const copy: string[] = []
    for (let index = 0; index < STEPS.length; index += 1) {
      // Wait for the step to change before reading it, or a slow render
      // reads the previous step's text again.
      await expect(title(page)).toHaveText(STEPS[index].title)
      copy.push((await page.locator(".driver-popover-description").textContent()) ?? "")
      if (index < STEPS.length - 1) await page.locator(".driver-popover-next-btn").click()
    }
    const text = copy.join(" ")
    expect(text).toContain("The model can only raise a live feed payment the rules cleared")
    expect(text).toContain("Sparkov synthetic data")
    expect(text).toContain("not a fraud probability")
    expect(text).toContain("read only")
    // Planned stages stay out until they ship.
    expect(text).not.toMatch(/Health|review queue|S06|S07|S08|coming soon/i)
  })

  test("starting from the Cases tab moves to the Scenario tab first", async ({ page }) => {
    await open(page)
    await page.getByRole("tab", { name: /^Cases/ }).click()
    await expect(page.locator("#console-summary")).toHaveCount(0)

    await startTour(page)
    await expect(page.getByRole("tab", { name: "Scenario" })).toHaveAttribute("aria-selected", "true")
    await expect(page.locator("#console-summary")).toBeVisible()
  })

  // covers: AC-7
  test("Skip tour is on every step but the last, and ends the tour", async ({ page }) => {
    await open(page)
    await startTour(page)
    const skip = page.getByRole("button", { name: "Skip tour" })
    for (let index = 0; index < STEPS.length; index += 1) {
      await expect(title(page)).toHaveText(STEPS[index].title)
      await expect(skip).toHaveCount(index < STEPS.length - 1 ? 1 : 0)
      if (index < STEPS.length - 1) await page.locator(".driver-popover-next-btn").click()
    }

    await page.locator(".driver-popover-prev-btn").click()
    await page.locator(".driver-popover-prev-btn").click()
    await expect(title(page)).toHaveText("Raised by model")
    await skip.click()
    await expect(overlay(page)).toHaveCount(0)
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

    await page.locator("#console-scenario-trigger").click()
    await page.getByRole("option", { name: /^S03/ }).click()
    await expect(page.locator("#console-scenario-trigger")).toContainText("S03")
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

test.describe("Risk Console tour on a first visit", () => {
  // A new browser: nothing remembered, so the tour has never been seen.
  test.use({ storageState: { cookies: [], origins: [] } })

  async function firstVisit(page: Page, { health = 200, path = "/?scenario=S01" } = {}) {
    await page.addInitScript(() => window.localStorage.setItem("console-live-feed", "off"))
    await page.route("**/sandbox/scenarios/*/simulation-runs", (route) =>
      route.fulfill({ status: 503, contentType: "application/json", body: "{}" }),
    )
    await page.route("**/health", (route) => route.fulfill({ status: health, json: { status: "ok" } }))
    await page.goto(path)
    await expect(page.locator("#console-scenario-trigger")).toBeVisible()
  }

  // covers: AC-1
  test("starts once when the API answers, and not again after a reload", async ({ page }) => {
    await firstVisit(page)
    await expect(overlay(page)).toBeVisible()
    await expect(title(page)).toHaveText("Choose a scenario")
    await expect(progress(page)).toHaveText("Step 1 of 7")
    expect(await page.evaluate(() => window.localStorage.getItem("console-tour-seen"))).toBe("1")

    await page.keyboard.press("Escape")
    await page.reload()
    await expect(page.locator("#console-scenario-trigger")).toBeVisible()
    await page.waitForTimeout(600)
    await expect(overlay(page)).toHaveCount(0)
  })

  // covers: AC-1
  test("waits for the API: with no answer it does not start", async ({ page }) => {
    await firstVisit(page, { health: 503 })
    await page.waitForTimeout(600)
    await expect(overlay(page)).toHaveCount(0)
  })

  // covers: AC-1
  test("a shared case link opens the case, not the tour", async ({ page }) => {
    await firstVisit(page, { path: "/?scenario=S01&case=3f2a9c1e-7b4d-4e8a-9c2f-1a6b5d8e0f42" })
    await page.waitForTimeout(600)
    await expect(overlay(page)).toHaveCount(0)
  })

  // covers: AC-1
  test("with storage blocked it still starts, and the page works", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, "localStorage", { get() { throw new Error("blocked") } })
    })
    await page.route("**/health", (route) => route.fulfill({ json: { status: "ok" } }))
    await page.goto("/?scenario=S01")
    await expect(overlay(page)).toBeVisible()
    await expect(title(page)).toHaveText("Choose a scenario")
  })
})
