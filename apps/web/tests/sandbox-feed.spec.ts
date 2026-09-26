import { expect, test, type Page } from "@playwright/test"

/**
 * Radar's live feed (spec 0003). The API and the worker are stubbed: these
 * check that the page starts, follows and stops a run, and that the figures
 * shown are the imported base plus that run's payments.
 */

const RUN_ID = "3f2a9c1e-7b4d-4e8a-9c2f-1a6b5d8e0f42"
const BROWSER_ID = "0b6f2d4e-7a1c-4e8b-9f3a-2c5d8e1f4a6b"

// Every feed request for a run must carry this browser's ID (spec 0003, AC-9).
async function useBrowserId(page: Page) {
  await page.addInitScript((id) => window.localStorage.setItem("showcase-browser-id", id), BROWSER_ID)
}

// The feed starts by itself (spec 0005). Tests of the switch itself begin from
// a browser that switched Live off earlier.
async function startOff(page: Page) {
  await page.addInitScript(() => window.localStorage.setItem("radar-live-feed", "off"))
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

// The imported base decides 5 PASS payments; each revealed feed payment adds one.
function decisions(extra: number) {
  const day = { date: "2026-09-23", PASS: 5 + extra, CHALLENGE: 0, HOLD: 0 }
  return {
    contract_version: "0",
    scenario_id: "S01",
    fixture_version: "fixture-test",
    days: [day],
    totals: { PASS: day.PASS, CHALLENGE: 0, HOLD: 0 },
  }
}

async function stubFeed(
  page: Page,
  { appended, cancelled, streamState = "running" }: { appended: number; cancelled: number; streamState?: string },
) {
  const calls: string[] = []
  await page.route("**/sandbox/scenarios/S01/decisions**", (route) => {
    const runId = new URL(route.request().url()).searchParams.get("simulation_run_id")
    calls.push(`decisions:${runId ?? "base"}`)
    if (runId) calls.push(`decisions-header:${route.request().headers()["x-showcase-browser-id"] ?? "none"}`)
    return route.fulfill({ json: decisions(runId ? appended : 0) })
  })
  await page.route("**/sandbox/scenarios/S01/analytics**", (route) => {
    const runId = new URL(route.request().url()).searchParams.get("simulation_run_id")
    calls.push(`analytics:${runId ?? "base"}`)
    if (runId) calls.push(`analytics-header:${route.request().headers()["x-showcase-browser-id"] ?? "none"}`)
    return route.fulfill({ json: analytics(runId ? appended : 0) })
  })
  await page.route("**/sandbox/scenarios/S01/simulation-runs", (route) => {
    calls.push(`start:${route.request().headers()["x-showcase-browser-id"] ?? "none"}`)
    return route.fulfill({ json: run("pending", 0) })
  })
  await page.route(`**/sandbox/simulation-runs/${RUN_ID}/events`, (route) => {
    calls.push(`stream:${route.request().headers()["x-showcase-browser-id"] ?? "none"}`)
    return route.fulfill({
      contentType: "text/event-stream",
      body: `event: simulation_state\ndata: ${JSON.stringify(run(streamState, appended))}\n\n`,
    })
  })
  await page.route(`**/sandbox/simulation-runs/${RUN_ID}/cancel`, (route) => {
    calls.push("cancel")
    return route.fulfill({ json: run("cancelled", cancelled) })
  })
  return calls
}

test("the Live switch starts a feed, shows the base plus its payments, and stops it", async ({ page }) => {
  await useBrowserId(page)
  await startOff(page)
  const calls = await stubFeed(page, { appended: 2, cancelled: 2 })
  await page.goto("/references/radar-reference.html?scenario=S01")

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
  // The browser ID travels as a header on start, the fetch stream and the overlay.
  expect(calls).toContain(`start:${BROWSER_ID}`)
  expect(calls).toContain(`stream:${BROWSER_ID}`)
  expect(calls).toContain(`analytics-header:${BROWSER_ID}`)

  await live.click()
  await expect(live).not.toBeChecked()
  await expect(status).toHaveText("Stopped · 2")
  expect(calls).toContain("cancel")
  await expect(transactions).toHaveText("12")
})

test("says the feed is unavailable when the API cannot start it", async ({ page }) => {
  await startOff(page)
  await page.route("**/sandbox/scenarios/S01/analytics**", (route) => route.fulfill({ json: analytics(0) }))
  await page.route("**/sandbox/scenarios/S01/simulation-runs", (route) =>
    route.fulfill({ status: 503, json: { detail: "sandbox_scenario_data_unavailable" } }),
  )
  await page.goto("/references/radar-reference.html?scenario=S01")

  const live = page.getByRole("switch", { name: "Live feed" })
  await live.click()
  await expect(page.locator(".live-status")).toHaveText("Unavailable")
  await expect(live).not.toBeChecked()
})

test("says the feed is busy when the API is at a limit", async ({ page }) => {
  await useBrowserId(page)
  await startOff(page)
  await page.route("**/sandbox/scenarios/S01/analytics**", (route) => route.fulfill({ json: analytics(0) }))
  await page.route("**/sandbox/scenarios/S01/simulation-runs", (route) =>
    route.fulfill({ status: 429, json: { detail: "simulation_busy" } }),
  )
  await page.goto("/references/radar-reference.html?scenario=S01")

  const live = page.getByRole("switch", { name: "Live feed" })
  await live.click()
  await expect(page.locator(".live-status")).toHaveText("Busy")
  await expect(live).not.toBeChecked()
})

test("the recommendations chart shows decided payments, not mock data, and counts up during a feed", async ({ page }) => {
  await useBrowserId(page)
  await startOff(page)
  const calls = await stubFeed(page, { appended: 2, cancelled: 2 })
  await page.goto("/references/radar-reference.html?scenario=S01")

  const chart = page.locator(".radar-outcome-card").filter({ hasText: "Recommendations over time" })
  await expect(chart.locator(".radar-source-pill")).toHaveText("Sandbox")
  await expect(page.getByText("Mock data")).toHaveCount(0)
  await expect(chart.locator(".card-copy")).toContainText("5 payments")

  await page.getByRole("switch", { name: "Live feed" }).click()
  await expect(chart.locator(".card-copy")).toContainText("7 payments")
  // The run overlay is read for its own browser only.
  expect(calls).toContain(`decisions:${RUN_ID}`)
  expect(calls).toContain(`decisions-header:${BROWSER_ID}`)
})

test("the Cases tab refetches while a feed runs and once when it ends, without a loading flash", async ({ page }) => {
  await useBrowserId(page)
  await startOff(page)
  // The stream reports 1 payment, then 2, so the revealed count changes during the run.
  await stubFeed(page, { appended: 2, cancelled: 2 })
  let listRequests = 0
  const zero = { PASS: 0, CHALLENGE: 0, HOLD: 0 }
  await page.route(/\/cases(\?.*)?$/, (route) => {
    listRequests += 1
    return route.fulfill({
      json: {
        contract_version: "1.0",
        items: [],
        next_cursor: null,
        totals: {
          total: 0,
          by_recommendation: zero,
          by_scenario: Object.fromEntries(["S01", "S02", "S03", "S04", "S05", "S06", "S07", "S08"].map((id) => [id, zero])),
          deterministic_passes: 0,
          fail_safe_holds: 0,
          completed_investigations: 0,
        },
      },
    })
  })
  await page.goto("/references/radar-reference.html?scenario=S01")
  await page.getByRole("tab", { name: /^Cases/ }).click()
  await expect(page.getByText("Saved cases", { exact: true })).toBeVisible()
  const beforeFeed = listRequests

  await page.getByRole("switch", { name: "Live feed" }).click()
  await expect(page.locator(".live-status")).toHaveText("2 / 200")
  await expect.poll(() => listRequests, { timeout: 8000 }).toBeGreaterThan(beforeFeed)
  // A quiet refetch keeps the table on screen.
  await expect(page.getByText("Saved cases", { exact: true })).toBeVisible()

  const duringFeed = listRequests
  await page.getByRole("switch", { name: "Live feed" }).click()
  await expect(page.locator(".live-status")).toHaveText("Stopped · 2")
  await expect.poll(() => listRequests, { timeout: 8000 }).toBeGreaterThan(duringFeed)
})

test("the Cases tab count follows a feed from the Scenario tab", async ({ page }) => {
  await useBrowserId(page)
  await startOff(page)
  await stubFeed(page, { appended: 2, cancelled: 2 })
  // No saved cases until the feed starts, then 3 HOLD feed cases.
  let feedStarted = false
  page.on("request", (request) => {
    if (request.url().includes("/simulation-runs")) feedStarted = true
  })
  const zero = { PASS: 0, CHALLENGE: 0, HOLD: 0 }
  await page.route(/\/cases(\?.*)?$/, (route) => {
    const total = feedStarted ? 3 : 0
    return route.fulfill({
      json: {
        contract_version: "1.0",
        items: [],
        next_cursor: null,
        totals: {
          total,
          by_recommendation: { ...zero, HOLD: total },
          by_scenario: Object.fromEntries(["S01", "S02", "S03", "S04", "S05", "S06", "S07", "S08"].map((id) => [id, zero])),
          deterministic_passes: 0,
          fail_safe_holds: 0,
          completed_investigations: 0,
        },
      },
    })
  })
  await page.goto("/references/radar-reference.html?scenario=S01")
  const casesTab = page.getByRole("tab", { name: /^Cases/ })
  await expect(casesTab).toHaveText("Cases")

  await page.getByRole("switch", { name: "Live feed" }).click()
  // Still on the Scenario tab: the count updates without opening Cases.
  await expect(page.getByRole("tab", { name: "Scenario" })).toHaveAttribute("aria-selected", "true")
  await expect(casesTab).toHaveText("Cases3", { timeout: 8000 })
})

test("a feed's quiet refresh keeps the rows already loaded with Show more", async ({ page }) => {
  await useBrowserId(page)
  await startOff(page)
  await stubFeed(page, { appended: 2, cancelled: 2 })
  const zero = { PASS: 0, CHALLENGE: 0, HOLD: 0 }
  // Newest first: c01 is the newest of 25 saved cases; n01 and n02 arrive during the feed.
  const summary = (id: string, secondsAgo: number) => ({
    case_id: id,
    scenario_id: "S02",
    requested_mode: "recorded",
    execution_mode: "recorded",
    fallback_reason: null,
    provider: null,
    model_id: null,
    deterministic_route: "HOLD",
    investigation_status: "skipped",
    recommendation: "HOLD",
    recommendation_basis: "deterministic",
    failure_reason: null,
    authority_status: "not_evaluated",
    tool_call_count: 0,
    evidence_count: 0,
    event_count: 4,
    fixture_version: null,
    started_at: new Date(Date.UTC(2026, 8, 23, 12, 0, 0) - secondsAgo * 1000).toISOString(),
    completed_at: new Date(Date.UTC(2026, 8, 23, 12, 0, 0) - secondsAgo * 1000).toISOString(),
    expires_at: "2026-10-23T12:00:00Z",
    contract_version: "1.0",
    origin: "feed",
    model_score: null,
    model_version: null,
  })
  const saved = Array.from({ length: 25 }, (_, index) => summary(`run_feed_c${String(index + 1).padStart(2, "0")}`, index + 1))
  const arrived = [summary("run_feed_n02", -2), summary("run_feed_n01", -1)]
  let feedStarted = false
  page.on("request", (request) => {
    if (request.url().includes("/simulation-runs")) feedStarted = true
  })
  await page.route(/\/cases(\?.*)?$/, (route) => {
    const cursor = new URL(route.request().url()).searchParams.get("cursor")
    const all = feedStarted ? [...arrived, ...saved] : saved
    const items = cursor ? saved.slice(20) : all.slice(0, 20)
    return route.fulfill({
      json: {
        contract_version: "1.0",
        items,
        next_cursor: cursor ? null : "page_two",
        totals: {
          total: all.length,
          by_recommendation: { ...zero, HOLD: all.length },
          by_scenario: Object.fromEntries(["S01", "S02", "S03", "S04", "S05", "S06", "S07", "S08"].map((id) => [id, zero])),
          deterministic_passes: 0,
          fail_safe_holds: 0,
          completed_investigations: 0,
        },
      },
    })
  })
  await page.goto("/references/radar-reference.html?scenario=S01")
  await page.getByRole("tab", { name: /^Cases/ }).click()
  const caseLinks = page.locator("a.case-link")
  await expect(caseLinks).toHaveCount(20)
  await page.getByRole("button", { name: "Show more" }).click()
  await expect(caseLinks).toHaveCount(25)

  await page.getByRole("switch", { name: "Live feed" }).click()
  // The refresh adds the two new cases on top and drops none of the 25 already shown.
  await expect(page.getByRole("link", { name: "run_feed_n01" })).toBeVisible({ timeout: 8000 })
  await expect(caseLinks).toHaveCount(27)
  await expect(page.getByRole("link", { name: "run_feed_c25" })).toBeVisible()
})

// ---- On by default, status in the top bar (spec 0005) -----------------------

function liveStatus(page: Page) {
  return page.locator(".live-status")
}

// The tooltip opens on keyboard focus as well as hover.
async function hint(page: Page) {
  await page.getByRole("switch", { name: "Live feed" }).focus()
  const tooltip = page.getByRole("tooltip")
  await expect(tooltip).toBeVisible()
  return tooltip
}

test("the feed starts by itself when the page loads", async ({ page }) => {
  await useBrowserId(page)
  const calls = await stubFeed(page, { appended: 2, cancelled: 2 })
  await page.goto("/references/radar-reference.html?scenario=S01")

  await expect(page.getByRole("switch", { name: "Live feed" })).toBeChecked()
  await expect(liveStatus(page)).toHaveText("2 / 200")
  await expect(await hint(page)).toContainText("Simulated payments added so far")
  // Once per load, never twice.
  expect(calls.filter((call) => call.startsWith("start:"))).toEqual([`start:${BROWSER_ID}`])
  // Nothing is added to the Scenario tab.
  await expect(page.locator(".feed-line, .feed-panel")).toHaveCount(0)
})

test("switching Live off is remembered across a reload", async ({ page }) => {
  await useBrowserId(page)
  const calls = await stubFeed(page, { appended: 2, cancelled: 2 })
  await page.goto("/references/radar-reference.html?scenario=S01")
  const live = page.getByRole("switch", { name: "Live feed" })
  await expect(liveStatus(page)).toHaveText("2 / 200")

  await live.click()
  await expect(live).not.toBeChecked()
  await page.reload()
  await expect(live).not.toBeChecked()
  await expect(liveStatus(page)).toHaveText("Showing history")
  await expect(await hint(page)).toContainText("imported Sandbox history")
  expect(calls.filter((call) => call.startsWith("start:"))).toHaveLength(1)

  // Switching on again clears it, so the next load starts by itself.
  await live.click()
  await expect(liveStatus(page)).toHaveText("2 / 200")
  expect(await page.evaluate(() => window.localStorage.getItem("radar-live-feed"))).toBeNull()
})

test("changing scenario starts a fresh feed for the new scenario", async ({ page }) => {
  await useBrowserId(page)
  await stubFeed(page, { appended: 2, cancelled: 2 })
  const starts: string[] = []
  await page.route("**/sandbox/scenarios/*/simulation-runs", (route) => {
    const scenario = new URL(route.request().url()).pathname.split("/")[3]
    starts.push(scenario)
    return route.fulfill({ json: { ...run("pending", 0), scenario_id: scenario } })
  })
  await page.goto("/references/radar-reference.html?scenario=S01")
  await expect.poll(() => starts).toEqual(["S01"])

  await page.getByRole("combobox", { name: "Synthetic showcase scenario" }).click()
  await page.getByRole("option", { name: /^S02/ }).click()
  await expect.poll(() => starts).toEqual(["S01", "S02"])
  await expect(page.getByRole("switch", { name: "Live feed" })).toBeChecked()
})

test("an automatic start that fails stays quiet and shows history", async ({ page }) => {
  await useBrowserId(page)
  await page.route("**/sandbox/scenarios/S01/analytics**", (route) => route.fulfill({ json: analytics(0) }))
  await page.route("**/sandbox/scenarios/S01/simulation-runs", (route) =>
    route.fulfill({ status: 429, json: { detail: "simulation_busy" } }),
  )
  await page.goto("/references/radar-reference.html?scenario=S01")

  await expect(liveStatus(page)).toHaveText("Showing history")
  await expect(page.locator(".live-switch")).toHaveAttribute("data-tone", "idle")
  await expect(page.getByRole("switch", { name: "Live feed" })).not.toBeChecked()
  await expect(await hint(page)).toContainText("at its limit right now, so this shows the imported history")
})

test("with no API, an automatic start shows history quietly", async ({ page }) => {
  await useBrowserId(page)
  await page.route("**/sandbox/scenarios/S01/analytics**", (route) => route.fulfill({ json: analytics(0) }))
  await page.route("**/sandbox/scenarios/S01/simulation-runs", (route) =>
    route.fulfill({ status: 503, json: { detail: "sandbox_scenario_data_unavailable" } }),
  )
  await page.goto("/references/radar-reference.html?scenario=S01")

  await expect(liveStatus(page)).toHaveText("Showing history")
  await expect(await hint(page)).toContainText("isn't available here")
})

test("a start the viewer asked for that fails says why in the tooltip", async ({ page }) => {
  await useBrowserId(page)
  await startOff(page)
  await page.route("**/sandbox/scenarios/S01/analytics**", (route) => route.fulfill({ json: analytics(0) }))
  await page.route("**/sandbox/scenarios/S01/simulation-runs", (route) =>
    route.fulfill({ status: 429, json: { detail: "simulation_busy" } }),
  )
  await page.goto("/references/radar-reference.html?scenario=S01")

  await page.getByRole("switch", { name: "Live feed" }).click()
  await expect(liveStatus(page)).toHaveText("Busy")
  await expect(page.locator(".live-switch")).toHaveAttribute("data-tone", "busy")
  await expect(await hint(page)).toContainText("The live feed is at its limit. Try again in a minute.")
})

test("a run with no payments arriving puts the worker fix in the tooltip", async ({ page }) => {
  await useBrowserId(page)
  await stubFeed(page, { appended: 0, cancelled: 0 })
  await page.goto("/references/radar-reference.html?scenario=S01")

  await expect(liveStatus(page)).toHaveText("Worker not running", { timeout: 10000 })
  await expect(await hint(page)).toContainText("SIMULATION_WORKER_ENABLED=true")
})

test("a finished run stays finished", async ({ page }) => {
  await useBrowserId(page)
  const calls = await stubFeed(page, { appended: 200, cancelled: 200, streamState: "completed" })
  await page.goto("/references/radar-reference.html?scenario=S01")

  await expect(liveStatus(page)).toHaveText("Finished · 200")
  await expect(page.getByRole("switch", { name: "Live feed" })).not.toBeChecked()
  await page.waitForTimeout(1500)
  expect(calls.filter((call) => call.startsWith("start:"))).toHaveLength(1)
})
