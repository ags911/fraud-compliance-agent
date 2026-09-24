import { expect, test, type Page } from "@playwright/test"

/**
 * Radar's live feed (spec 0003). The API and the worker are stubbed: these
 * check that the page starts, follows and stops a run, and that the figures
 * shown are the imported base plus that run's payments.
 */

const RUN_ID = "3f2a9c1e-7b4d-4e8a-9c2f-1a6b5d8e0f42"

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

// One day of base activity: 10 transactions, plus one per shown feed payment.
function analytics(extra: number) {
  return {
    contract_version: "1.0",
    scenario_id: "S01",
    fixture_version: "fixture-test",
    source_class: "sanitised_sandbox",
    enrichment_version: "sandbox-enrichment-v2",
    baseline_version: "fixture-only",
    overlay_version: "fixture-only",
    time_boundary: { start_date: "2026-09-23", end_date: "2026-09-23", event_time_precision: "date" },
    daily_aggregates: [
      { date: "2026-09-23", transaction_count: 10 + extra, outbound_amount_minor: 10000 + extra * 4200, category_counts: {} },
    ],
  }
}

async function stubFeed(page: Page, { appended, cancelled }: { appended: number; cancelled: number }) {
  const calls: string[] = []
  await page.route("**/sandbox/scenarios/S01/analytics**", (route) => {
    const runId = new URL(route.request().url()).searchParams.get("simulation_run_id")
    calls.push(`analytics:${runId ?? "base"}`)
    return route.fulfill({ json: analytics(runId ? appended : 0) })
  })
  await page.route("**/sandbox/scenarios/S01/simulation-runs", (route) => {
    calls.push("start")
    return route.fulfill({ json: run("pending", 0) })
  })
  await page.route(`**/sandbox/simulation-runs/${RUN_ID}/events`, (route) =>
    route.fulfill({
      contentType: "text/event-stream",
      body: `event: simulation_state\ndata: ${JSON.stringify(run("running", appended))}\n\n`,
    }),
  )
  await page.route(`**/sandbox/simulation-runs/${RUN_ID}/cancel`, (route) => {
    calls.push("cancel")
    return route.fulfill({ json: run("cancelled", cancelled) })
  })
  return calls
}

test("the Live switch starts a feed, shows the base plus its payments, and stops it", async ({ page }) => {
  const calls = await stubFeed(page, { appended: 2, cancelled: 2 })
  await page.goto("/references/radar-reference.html")

  const live = page.getByRole("switch", { name: "Live feed" })
  const status = page.locator(".live-status")
  const transactions = page.getByLabel("S01 Sandbox activity summary").locator(".stat-value").first()
  await expect(live).not.toBeChecked()
  await expect(transactions).toHaveText("10")

  await live.click()
  await expect(live).toBeChecked()
  await expect(status).toHaveText("2 / 200")
  // The figures are re-read with the run, so they count up from the base.
  await expect(transactions).toHaveText("12")
  expect(calls).toContain(`analytics:${RUN_ID}`)

  await live.click()
  await expect(live).not.toBeChecked()
  await expect(status).toHaveText("Stopped · 2")
  expect(calls).toContain("cancel")
  await expect(transactions).toHaveText("12")
})

test("says the feed is unavailable when the API cannot start it", async ({ page }) => {
  await page.route("**/sandbox/scenarios/S01/analytics**", (route) => route.fulfill({ json: analytics(0) }))
  await page.route("**/sandbox/scenarios/S01/simulation-runs", (route) =>
    route.fulfill({ status: 503, json: { detail: "sandbox_scenario_data_unavailable" } }),
  )
  await page.goto("/references/radar-reference.html")

  const live = page.getByRole("switch", { name: "Live feed" })
  await live.click()
  await expect(page.locator(".live-status")).toHaveText("Unavailable")
  await expect(live).not.toBeChecked()
})
