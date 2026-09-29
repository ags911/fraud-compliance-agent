import AxeBuilder from "@axe-core/playwright"
import { expect, test, type Page } from "@playwright/test"

/**
 * The hosted demo API sleeps when idle, so the first load after a quiet spell
 * waits while it starts. The console says so, only while `/health` has not
 * answered after a short delay. The API is stubbed.
 */

const NOTICE = "Starting the demo server…"

async function stubQuietApi(page: Page) {
  // Nothing else is under test: every other API read is unavailable, and the
  // feed never starts a real run.
  await page.addInitScript(() => window.localStorage.setItem("console-live-feed", "off"))
  await page.route("**/sandbox/**", (route) => route.fulfill({ status: 503, contentType: "application/json", body: "{}" }))
  await page.route(/\/cases(\?.*)?$/, (route) => route.fulfill({ status: 503, contentType: "application/json", body: "{}" }))
}

/** Hold `/health` until the returned function is called, like a sleeping API. */
async function slowHealth(page: Page) {
  let wake = () => {}
  const awake = new Promise<void>((resolve) => (wake = resolve))
  await page.route("**/health", async (route) => {
    await awake
    await route.fulfill({ json: { status: "ok" } })
  })
  return wake
}

test("says the demo server is starting while the API wakes, then clears", async ({ page }) => {
  await stubQuietApi(page)
  const wake = await slowHealth(page)
  await page.goto("/")

  const notice = page.getByRole("status").filter({ hasText: NOTICE })
  await expect(notice).toBeVisible()
  await expect(notice).toContainText("It sleeps when nobody is using it, so the first load can take about 30 seconds.")
  // The dashboard stays usable underneath.
  await expect(page.getByRole("combobox", { name: "Synthetic showcase scenario" })).toBeVisible()
  // The same WCAG scope as tests/accessibility.spec.ts.
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze()
  expect(axe.violations).toEqual([])

  wake()
  await expect(page.getByText(NOTICE)).toHaveCount(0)
})

test("a warm API never shows the notice", async ({ page }) => {
  await stubQuietApi(page)
  await page.route("**/health", (route) => route.fulfill({ json: { status: "ok" } }))
  await page.goto("/")

  await expect(page.getByRole("combobox", { name: "Synthetic showcase scenario" })).toBeVisible()
  // Past the notice delay, it still has not appeared.
  await page.waitForTimeout(2_000)
  await expect(page.getByText(NOTICE)).toHaveCount(0)
})

test("an unreachable API drops the notice and leaves the page's own messages", async ({ page }) => {
  await stubQuietApi(page)
  let fail = () => {}
  const failed = new Promise<void>((resolve) => (fail = resolve))
  await page.route("**/health", async (route) => {
    await failed
    await route.abort("connectionrefused")
  })
  await page.goto("/")

  await expect(page.getByText(NOTICE)).toBeVisible()
  fail()
  await expect(page.getByText(NOTICE)).toHaveCount(0)
})
