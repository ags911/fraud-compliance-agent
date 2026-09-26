import { expect, test, type Page } from "@playwright/test"

/**
 * The Mixed feed (spec 0008) and the visible feed lifecycle (spec 0009). The
 * API is stubbed: a Mixed run reveals one payment from each of S01 to S05, and
 * each scenario's analytics answer for its own dataset.
 */

const RUN_ID = "7c1d2e3f-4a5b-4c6d-8e9f-0a1b2c3d4e5f"
const BROWSER_ID = "0b6f2d4e-7a1c-4e8b-9f3a-2c5d8e1f4a6b"
const SOURCES = ["S01", "S02", "S03", "S04", "S05"] as const
// Each source's accepted rule (spec 0004), as the server decides them.
const RULE = { S01: "PASS", S02: "HOLD", S03: "HOLD", S04: "CHALLENGE", S05: "HOLD" } as const

type Outcome = "PASS" | "CHALLENGE" | "HOLD"

function run(scenarioId: string, decided: Outcome[], state = "running") {
  const lane = (outcome: Outcome) => {
    const recent = decided
      .map((recommendation, index) => ({ event_id: `evt-${index + 1}`, sequence: index + 1, recommendation }))
      .filter((token) => token.recommendation === outcome)
      .reverse()
    return { count: recent.length, recent }
  }
  return {
    run_id: RUN_ID,
    scenario_id: scenarioId,
    fixture_version: scenarioId === "MIX" ? null : "fixture-test",
    seed: "sandbox-simulation-v1",
    state,
    scheduled_event_count: 200,
    appended_event_count: decided.length,
    next_due_at: null,
    routing_snapshot: { by_recommendation: { PASS: lane("PASS"), CHALLENGE: lane("CHALLENGE"), HOLD: lane("HOLD") } },
  }
}

function analytics(scenarioId: string, transactions: number) {
  return {
    contract_version: "1.0",
    scenario_id: scenarioId,
    fixture_version: `${scenarioId.toLowerCase()}-v1`,
    source_class: "sanitised_sandbox",
    enrichment_version: "sandbox-enrichment-v2",
    baseline_version: "fixture-only",
    overlay_version: "fixture-only",
    time_boundary: { start_date: "2026-09-23", end_date: "2026-09-23", event_time_precision: "date" },
    daily_aggregates: [{ date: "2026-09-23", transaction_count: transactions, outbound_amount_minor: 1000, category_counts: {} }],
  }
}

type Calls = string[]

async function stubApi(page: Page, { decided = SOURCES.map((source) => RULE[source]) as Outcome[] } = {}): Promise<Calls> {
  const calls: Calls = []
  await page.addInitScript((id) => window.localStorage.setItem("showcase-browser-id", id), BROWSER_ID)
  await page.route("**/sandbox/scenarios/*/simulation-runs", (route) => {
    const scenarioId = new URL(route.request().url()).pathname.split("/")[3]
    calls.push(`start:${scenarioId}`)
    return route.fulfill({ json: run(scenarioId, []) })
  })
  await page.route(`**/sandbox/simulation-runs/${RUN_ID}/events`, (route) =>
    route.fulfill({ contentType: "text/event-stream", body: `event: simulation_state\ndata: ${JSON.stringify(run("MIX", decided))}\n\n` }),
  )
  await page.route(`**/sandbox/simulation-runs/${RUN_ID}/cancel`, (route) => {
    calls.push(`cancel:${route.request().headers()["x-showcase-browser-id"] ?? "none"}`)
    return route.fulfill({ json: run("MIX", decided, "cancelled") })
  })
  // Every scenario has 10 base transactions, plus 1 while this run is overlaid.
  await page.route("**/sandbox/scenarios/*/analytics**", (route) => {
    const url = new URL(route.request().url())
    const scenarioId = url.pathname.split("/")[3]
    const runId = url.searchParams.get("simulation_run_id")
    calls.push(`analytics:${scenarioId}:${runId ?? "base"}`)
    return route.fulfill({ json: analytics(scenarioId, runId ? 11 : 10) })
  })
  await page.route("**/sandbox/scenarios/*/decisions**", (route) => {
    const scenarioId = new URL(route.request().url()).pathname.split("/")[3]
    const day = { date: "2026-09-23", PASS: 0, CHALLENGE: 0, HOLD: 0, [RULE[scenarioId as keyof typeof RULE]]: 1 }
    return route.fulfill({ json: { contract_version: "0", scenario_id: scenarioId, fixture_version: "v1", days: [day], totals: { PASS: day.PASS, CHALLENGE: day.CHALLENGE, HOLD: day.HOLD } } })
  })
  return calls
}

// ---- Mixed feed (spec 0008) --------------------------------------------------

test("Radar opens on the Mixed feed and starts it", async ({ page }) => {
  const calls = await stubApi(page)
  await page.goto("/references/radar-reference.html")

  await expect(page.getByRole("combobox", { name: "Synthetic showcase scenario" })).toHaveText("Mixed feed · S01 to S05")
  await expect(page.getByText("Mixed feed · S01 to S05", { exact: true }).last()).toBeVisible()
  await expect.poll(() => calls.filter((call) => call.startsWith("start:"))).toEqual(["start:MIX"])

  // The Scenario tab adds up S01 to S05, each read with the Mixed run.
  for (const source of SOURCES) await expect.poll(() => calls).toContain(`analytics:${source}:${RUN_ID}`)
  await expect(page.getByLabel("Mixed feed Sandbox activity summary").locator(".stat-value").first()).toHaveText("55")

  // An investigation needs one scenario.
  const runButton = page.locator("#radar-run-showcase")
  await expect(runButton).toBeDisabled()
  await expect(runButton).toHaveAttribute("title", "Pick one scenario to run the showcase")
})

test("the Mixed feed's routing board shows every outcome and says why", async ({ page }) => {
  await stubApi(page)
  await page.goto("/references/radar-reference.html")
  await page.getByRole("tab", { name: /^Cases/ }).click()
  const board = page.getByRole("region", { name: "Live decision routing" })

  await expect(board.getByRole("list", { name: "Routed payments by outcome" }).getByRole("listitem")).toHaveText(["PASS 1", "CHALLENGE 1", "HOLD 3"])
  await expect(board.getByText("Payments from S01 to S05, each decided by its own scenario's rule.")).toBeVisible()
})

test("?scenario= opens one scenario, and an unknown value falls back to Mixed", async ({ page }) => {
  const calls = await stubApi(page)
  await page.goto("/references/radar-reference.html?scenario=S04")
  await expect(page.getByRole("combobox", { name: "Synthetic showcase scenario" })).toHaveText("S04 · Ambiguous contextual case")
  await expect.poll(() => calls).toContain("start:S04")
  await expect(page.locator("#radar-run-showcase")).toBeEnabled()

  await page.goto("/references/radar-reference.html?scenario=S99")
  await expect(page.getByRole("combobox", { name: "Synthetic showcase scenario" })).toHaveText("Mixed feed · S01 to S05")
})

// ---- Visible feed lifecycle (spec 0009) -------------------------------------

// Let a test hide and show the tab: visibilityState reads a page flag.
async function controllableVisibility(page: Page, hidden: boolean) {
  await page.addInitScript((startHidden) => {
    const state = window as unknown as { __tabHidden: boolean }
    state.__tabHidden = startHidden
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => (state.__tabHidden ? "hidden" : "visible") })
    Object.defineProperty(document, "hidden", { configurable: true, get: () => state.__tabHidden })
  }, hidden)
}

async function setTabHidden(page: Page, hidden: boolean) {
  await page.evaluate((value) => {
    ;(window as unknown as { __tabHidden: boolean }).__tabHidden = value
    document.dispatchEvent(new Event("visibilitychange"))
  }, hidden)
}

test("a tab opened in the background starts its feed only once shown", async ({ page }) => {
  await controllableVisibility(page, true)
  const calls = await stubApi(page)
  await page.goto("/references/radar-reference.html")
  await expect(page.getByRole("combobox", { name: "Synthetic showcase scenario" })).toBeVisible()
  await page.waitForTimeout(500)
  expect(calls.filter((call) => call.startsWith("start:"))).toEqual([])

  await setTabHidden(page, false)
  await expect.poll(() => calls.filter((call) => call.startsWith("start:"))).toEqual(["start:MIX"])
})

test("a tab hidden for two minutes stops its feed without switching Live off", async ({ page }) => {
  await controllableVisibility(page, false)
  await page.clock.install()
  const calls = await stubApi(page)
  await page.goto("/references/radar-reference.html")
  await expect(page.locator(".live-status")).toHaveText("5 / 200")

  await setTabHidden(page, true)
  await page.clock.fastForward(119_000)
  expect(calls).not.toContain(`cancel:${BROWSER_ID}`)
  await page.clock.fastForward(2_000)
  await expect.poll(() => calls).toContain(`cancel:${BROWSER_ID}`)

  // Coming back shows the stopped count and does not restart.
  await setTabHidden(page, false)
  await expect(page.locator(".live-status")).toHaveText("Stopped · 5")
  expect(calls.filter((call) => call.startsWith("start:"))).toEqual(["start:MIX"])
  expect(await page.evaluate(() => window.localStorage.getItem("radar-live-feed"))).toBeNull()
})

test("a tab shown again within two minutes keeps its feed", async ({ page }) => {
  await controllableVisibility(page, false)
  await page.clock.install()
  const calls = await stubApi(page)
  await page.goto("/references/radar-reference.html")
  await expect(page.locator(".live-status")).toHaveText("5 / 200")

  await setTabHidden(page, true)
  await page.clock.fastForward(60_000)
  await setTabHidden(page, false)
  await page.clock.fastForward(120_000)
  expect(calls).not.toContain(`cancel:${BROWSER_ID}`)
  await expect(page.locator(".live-status")).toHaveText("5 / 200")
})

test("closing the tab cancels its live run", async ({ page }) => {
  const calls = await stubApi(page)
  await page.goto("/references/radar-reference.html")
  await expect(page.locator(".live-status")).toHaveText("5 / 200")

  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: false })))
  await expect.poll(() => calls).toContain(`cancel:${BROWSER_ID}`)
})
