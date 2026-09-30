import AxeBuilder from "@axe-core/playwright"
import { expect, test, type Page, type Request } from "@playwright/test"

/**
 * The Scenario tab's Overview card (spec 0011). The API is stubbed: these check
 * what the page sends, how each source is labelled, and that the card says
 * when its figures change without asking again.
 */

const API_BASE_URL = "http://localhost:8010"
const RUN_ID = "3f2a9c1e-7b4d-4e8a-9c2f-1a6b5d8e0f42"
const BROWSER_ID = "0b6f2d4e-7a1c-4e8b-9f3a-2c5d8e1f4a6b"

const TEMPLATE_LABEL = "Template summary from the synthetic figures on this page. No AI model was used."

function overview(overrides: Record<string, unknown> = {}) {
  return {
    contract_version: "1.0",
    scenario_id: "S01",
    range: "30",
    window: { start: "2026-08-25", end: "2026-09-23", days: 30 },
    source: "template",
    model_id: null,
    headline: "Trusted recurring payment: 12 transactions and £142.00 outbound spend over 30 days.",
    points: ["5 PASS, 0 CHALLENGE and 0 HOLD.", "The largest day was 23 Sep 2026, with £142.00 outbound.", "Payments landed on 1 of 30 days."],
    fallback_reason: "live_disabled",
    included: { feed: true, cases: true },
    ...overrides,
  }
}

function run(state: string, appended: number) {
  return {
    run_id: RUN_ID,
    scenario_id: "S01",
    fixture_version: "fixture-test",
    seed: "sandbox-simulation-v1",
    state,
    scheduled_event_count: 200,
    appended_event_count: appended,
    next_due_at: null,
  }
}

const analytics = {
  contract_version: "1.0",
  scenario_id: "S01",
  fixture_version: "fixture-test",
  source_class: "sanitised_sandbox",
  enrichment_version: "sandbox-enrichment-v2",
  baseline_version: "fixture-only",
  overlay_version: "fixture-only",
  time_boundary: { start_date: "2026-06-29", end_date: "2026-09-23", event_time_precision: "date" },
  daily_aggregates: [{ date: "2026-09-23", transaction_count: 12, outbound_amount_minor: 14200, category_counts: {} }],
}

const decisions = {
  contract_version: "0",
  scenario_id: "S01",
  fixture_version: "fixture-test",
  days: [{ date: "2026-09-23", PASS: 5, CHALLENGE: 0, HOLD: 0 }],
  totals: { PASS: 5, CHALLENGE: 0, HOLD: 0 },
}

/** Stub the Scenario tab's reads; the live feed stays off unless asked. */
async function stubScenario(page: Page, { feedOn = false }: { feedOn?: boolean } = {}) {
  await page.addInitScript((id) => window.localStorage.setItem("showcase-browser-id", id), BROWSER_ID)
  if (!feedOn) await page.addInitScript(() => window.localStorage.setItem("console-live-feed", "off"))
  await page.route(`${API_BASE_URL}/**`, (route) => route.fulfill({ status: 503, json: { detail: "unavailable" } }))
  await page.route("**/sandbox/scenarios/*/analytics**", (route) => route.fulfill({ json: analytics }))
  await page.route("**/sandbox/scenarios/*/decisions**", (route) => route.fulfill({ json: decisions }))
}

/** Answer the overview route with one body and record every request to it. */
async function stubOverview(page: Page, body: Record<string, unknown>) {
  const requests: Request[] = []
  await page.route("**/sandbox/scenarios/*/overview", (route) => {
    requests.push(route.request())
    return route.fulfill({ json: body })
  })
  return requests
}

const card = (page: Page) => page.locator("#console-overview")

test("a template overview is labelled, with no reason line while live is off", async ({ page }) => {
  await stubScenario(page)
  const requests = await stubOverview(page, overview())
  await page.goto("/?scenario=S01")

  await card(page).getByRole("button", { name: "Write overview" }).click()

  await expect(card(page).getByText(overview().headline)).toBeVisible()
  await expect(card(page).getByRole("listitem")).toHaveCount(3)
  await expect(card(page).getByText(TEMPLATE_LABEL)).toBeVisible()
  await expect(card(page).getByText(/so this is the template summary/)).toHaveCount(0)
  await expect(card(page).getByText(/isn't included|aren't included/)).toHaveCount(0)

  // The page sends only the scenario, the range and (when running) its run ID;
  // the browser ID travels as a header, and no figures leave the browser.
  const [request] = requests
  expect(new URL(request.url()).pathname).toBe("/sandbox/scenarios/S01/overview")
  expect(request.postDataJSON()).toEqual({ range: "30" })
  expect(request.headers()["x-showcase-browser-id"]).toBe(BROWSER_ID)
})

test("a live overview names its model, and says what was left out", async ({ page }) => {
  await stubScenario(page)
  await stubOverview(
    page,
    overview({ source: "live", model_id: "test-model", fallback_reason: null, included: { feed: false, cases: true } }),
  )
  await page.goto("/?scenario=S01")
  await card(page).getByRole("button", { name: "Write overview" }).click()

  await expect(
    card(page).getByText(
      "Written by an AI model (test-model) from the synthetic figures on this page. It can be wrong and it never decides anything.",
    ),
  ).toBeVisible()
  await expect(card(page).getByText("Your live feed isn't included.")).toBeVisible()
  await expect(card(page).getByText(TEMPLATE_LABEL)).toHaveCount(0)
})

const reasons = [
  ["admission_limited", "The AI overview limit is reached, so this is the template summary."],
  ["provider_unavailable", "The AI model is unavailable, so this is the template summary."],
  ["timeout", "The AI model took too long, so this is the template summary."],
  ["invalid_output", "The AI overview didn't pass the fact check, so this is the template summary."],
  ["ungrounded", "The AI overview didn't pass the fact check, so this is the template summary."],
] as const

for (const [reason, line] of reasons) {
  test(`a template after ${reason} carries one reason line`, async ({ page }) => {
    await stubScenario(page)
    await page.route("**/sandbox/scenarios/*/overview", (route) =>
      route.fulfill({ json: overview({ fallback_reason: reason, included: { feed: false, cases: false } }) }),
    )
    await page.goto("/?scenario=S01")
    await card(page).getByRole("button", { name: "Write overview" }).click()

    await expect(card(page).getByText(line)).toHaveCount(1)
    await expect(card(page).getByText(TEMPLATE_LABEL)).toBeVisible()
    await expect(card(page).getByText("Your live feed and cases aren't included.")).toBeVisible()
  })
}

test("while writing the button is disabled, and the result is announced politely", async ({ page }) => {
  await stubScenario(page)
  let release: () => void = () => undefined
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route("**/sandbox/scenarios/*/overview", async (route) => {
    await held
    await route.fulfill({ json: overview() })
  })
  await page.goto("/?scenario=S01")
  await card(page).getByRole("button", { name: "Write overview" }).click()

  const writing = card(page).getByRole("button", { name: "Writing…" })
  await expect(writing).toBeDisabled()
  release()
  await expect(card(page).getByRole("status")).toContainText(overview().headline)
  await expect(card(page).getByRole("status")).toHaveAttribute("aria-live", "polite")
  await expect(card(page).getByRole("button", { name: "Write overview" })).toBeEnabled()
})

test("an unreachable API says so and keeps the button", async ({ page }) => {
  await stubScenario(page)
  await page.route("**/sandbox/scenarios/*/overview", (route) => route.abort())
  await page.goto("/?scenario=S01")
  await card(page).getByRole("button", { name: "Write overview" }).click()

  await expect(card(page).getByText("The overview is unavailable right now.")).toBeVisible()
  await expect(card(page).getByRole("button", { name: "Write overview" })).toBeEnabled()
})

test("changing the range makes the overview out of date without asking again", async ({ page }) => {
  await stubScenario(page)
  const requests = await stubOverview(page, overview())
  await page.goto("/?scenario=S01")
  await card(page).getByRole("button", { name: "Write overview" }).click()
  await expect(card(page).getByText(overview().headline)).toBeVisible()
  await expect(card(page).getByText("Figures have changed since this was written.")).toHaveCount(0)

  await page.getByRole("group", { name: "Scenario date range" }).getByRole("button", { name: "7D" }).click()

  await expect(card(page).getByText("Figures have changed since this was written.")).toBeVisible()
  const again = card(page).getByRole("button", { name: "Write again" })
  await expect(again).toBeVisible()
  expect(requests).toHaveLength(1)

  await again.click()
  await expect(card(page).getByText("Figures have changed since this was written.")).toHaveCount(0)
  expect(requests).toHaveLength(2)
  expect(requests[1].postDataJSON()).toEqual({ range: "7" })
})

test("a running feed sends its run ID in the body, and stopping it with the same count dates the overview", async ({ page }) => {
  await stubScenario(page, { feedOn: true })
  await page.route("**/sandbox/scenarios/S01/simulation-runs", (route) => route.fulfill({ json: run("pending", 0) }))
  await page.route(`**/sandbox/simulation-runs/${RUN_ID}/events`, (route) =>
    route.fulfill({ contentType: "text/event-stream", body: `event: simulation_state\ndata: ${JSON.stringify(run("running", 2))}\n\n` }),
  )
  await page.route(`**/sandbox/simulation-runs/${RUN_ID}/cancel`, (route) => route.fulfill({ json: run("cancelled", 2) }))
  const requests = await stubOverview(page, overview())
  await page.goto("/?scenario=S01")
  await expect(page.locator(".live-status")).toHaveText("2 / 200")

  await card(page).getByRole("button", { name: "Write overview" }).click()
  await expect(card(page).getByText(overview().headline)).toBeVisible()
  expect(requests[0].postDataJSON()).toEqual({ range: "30", simulation_run_id: RUN_ID })
  expect(requests[0].url()).not.toContain(RUN_ID)

  await page.getByRole("switch", { name: "Live feed" }).click()
  await expect(card(page).getByText("Figures have changed since this was written.")).toBeVisible()
  expect(requests).toHaveLength(1)
})

test("the Mixed feed asks for its own overview", async ({ page }) => {
  await stubScenario(page)
  const requests = await stubOverview(page, overview({ scenario_id: "MIX", headline: "Mixed feed · S01 to S05: 60 transactions." }))
  await page.goto("/")
  await card(page).getByRole("button", { name: "Write overview" }).click()
  await expect(card(page).getByText("Mixed feed · S01 to S05: 60 transactions.")).toBeVisible()
  expect(new URL(requests[0].url()).pathname).toBe("/sandbox/scenarios/MIX/overview")
})

test("a shown overview has no automatically detectable WCAG A/AA violations", async ({ page }, testInfo) => {
  await stubScenario(page)
  await page.route("**/sandbox/scenarios/*/overview", (route) =>
    route.fulfill({ json: overview({ fallback_reason: "ungrounded", included: { feed: false, cases: true } }) }),
  )
  await page.goto("/?scenario=S01")
  await card(page).getByRole("button", { name: "Write overview" }).click()
  await expect(card(page).getByText(overview().headline)).toBeVisible()
  await page.evaluate(() => document.fonts.ready)

  const results = await new AxeBuilder({ page }).include("#console-overview").withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze()
  const summary = results.violations.map((violation) => `${violation.id}: ${violation.help}`)
  expect(summary, `Overview card at the ${testInfo.project.name} width`).toEqual([])
})
