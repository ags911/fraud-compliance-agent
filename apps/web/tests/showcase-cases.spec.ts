import { expect, test, type Page } from "@playwright/test"

/**
 * Durable showcase cases (spec 0002): Risk Console's Cases tab and case drawer.
 * The API is stubbed; the storage, scoping and paging rules are covered by the
 * API tests, so these check what the browser shows for each response.
 */

const BROWSER_ID = "0b6f2d4e-7a1c-4e8b-9f3a-2c5d8e1f4a6b"
const S04_ID = "run_abc123def456"
const S05_ID = "run_def456abc123"

function identity(caseId: string, scenario: string, sequence: number, event: string) {
  return {
    schema_version: "1.0",
    event_id: `evt_${caseId}_${sequence}`,
    run_id: caseId,
    scenario_id: scenario,
    sequence,
    event,
  }
}

function runStarted(caseId: string, scenario: string) {
  return {
    ...identity(caseId, scenario, 1, "run_started"),
    requested_mode: "recorded",
    execution_mode: "recorded",
    fallback_reason: null,
    provider: null,
    model_id: null,
    data_label: "synthetic",
  }
}

function summary(caseId: string, overrides: Record<string, unknown>) {
  return {
    case_id: caseId,
    scenario_id: "S04",
    requested_mode: "recorded",
    execution_mode: "recorded",
    fallback_reason: null,
    provider: null,
    model_id: null,
    deterministic_route: "INVESTIGATE",
    investigation_status: "complete",
    recommendation: "CHALLENGE",
    recommendation_basis: "evidence_grounded",
    failure_reason: null,
    authority_status: "not_evaluated",
    tool_call_count: 1,
    evidence_count: 1,
    event_count: 6,
    fixture_version: "s04-r1",
    started_at: "2026-09-24T09:15:02Z",
    completed_at: "2026-09-24T09:15:04Z",
    expires_at: "2026-10-24T09:15:04Z",
    contract_version: "1.0",
    origin: "showcase",
    model_score: null,
    model_version: null,
    ...overrides,
  }
}

function detail(caseSummary: ReturnType<typeof summary>, payloads: Record<string, unknown>[]) {
  return {
    contract_version: "1.0",
    case: caseSummary,
    events: payloads.map((payload) => ({
      sequence: payload.sequence,
      event_id: payload.event_id,
      event_type: payload.event,
      recorded_at: "2026-09-24T09:15:03Z",
      payload,
    })),
  }
}

const S04_DETAIL = detail(summary(S04_ID, {}), [
  runStarted(S04_ID, "S04"),
  { ...identity(S04_ID, "S04", 2, "route_resolved"), deterministic_route: "INVESTIGATE", investigation_eligibility: "eligible" },
  { ...identity(S04_ID, "S04", 3, "tool_call"), call_index: 1, tool_name: "get_payee_evidence" },
  {
    ...identity(S04_ID, "S04", 4, "tool_result"),
    call_index: 1,
    tool_name: "get_payee_evidence",
    evidence: [
      {
        evidence_id: "ev_payee_relationship",
        category: "payee_relationship",
        display_value: "First payment to this synthetic payee",
        source_class: "synthetic_fixture",
        fixture_version: "s04-r1",
      },
    ],
  },
  {
    ...identity(S04_ID, "S04", 5, "investigation_result"),
    investigation_status: "complete",
    recommendation: "CHALLENGE",
    recommendation_basis: "evidence_grounded",
    summary: "Synthetic evidence remains mixed, so the bounded agent recommends a challenge.",
    claims: [
      { claim_id: "claim_recent_payee", text: "The synthetic payee relationship is recent.", evidence_ids: ["ev_payee_relationship"] },
    ],
    uncertainties: [],
    authority_status: "not_evaluated",
    simulated_action: "none",
    failure_reason: null,
  },
  {
    ...identity(S04_ID, "S04", 6, "run_result"),
    investigation_status: "complete",
    recommendation: "CHALLENGE",
    recommendation_basis: "evidence_grounded",
    authority_status: "not_evaluated",
    simulated_action: "none",
    execution_mode: "recorded",
    data_label: "synthetic",
  },
])

const S05_DETAIL = detail(
  summary(S05_ID, {
    scenario_id: "S05",
    investigation_status: "incomplete",
    recommendation: "HOLD",
    recommendation_basis: "fail_safe",
    failure_reason: "provider_unavailable",
    tool_call_count: 0,
    evidence_count: 0,
    event_count: 4,
  }),
  [
    runStarted(S05_ID, "S05"),
    {
      ...identity(S05_ID, "S05", 2, "route_resolved"),
      deterministic_route: "INVESTIGATE",
      investigation_eligibility: "eligible_failure_test",
    },
    {
      ...identity(S05_ID, "S05", 3, "investigation_result"),
      investigation_status: "incomplete",
      recommendation: "HOLD",
      recommendation_basis: "fail_safe",
      summary: "The synthetic investigation stopped safely because its provider was unavailable.",
      claims: [],
      uncertainties: [],
      authority_status: "not_evaluated",
      simulated_action: "none",
      failure_reason: "provider_unavailable",
    },
    {
      ...identity(S05_ID, "S05", 4, "run_result"),
      investigation_status: "incomplete",
      recommendation: "HOLD",
      recommendation_basis: "fail_safe",
      authority_status: "not_evaluated",
      simulated_action: "none",
      execution_mode: "recorded",
      data_label: "synthetic",
    },
  ],
)

// A live feed payment's case (spec 0004): an S04 payment carrying the
// scenario's recorded CHALLENGE, with no agent run and no score yet.
const FEED_ID = "run_feed_3f2a9c1e7b4d_007"
const FEED_EVENT = (n: number) => `evt_feed_3f2a9c1e7b4d_007_${n}`
const FEED_DETAIL = detail(
  summary(FEED_ID, {
    origin: "feed",
    investigation_status: "skipped",
    tool_call_count: 0,
    evidence_count: 0,
    event_count: 4,
    fixture_version: null,
    started_at: "2026-09-23T12:00:07Z",
    completed_at: "2026-09-23T12:00:07Z",
    expires_at: "2026-10-23T12:00:07Z",
  }),
  [
    { ...runStarted(FEED_ID, "S04"), event_id: FEED_EVENT(1) },
    {
      ...identity(FEED_ID, "S04", 2, "route_resolved"),
      event_id: FEED_EVENT(2),
      deterministic_route: "INVESTIGATE",
      investigation_eligibility: "skipped",
    },
    { ...identity(FEED_ID, "S04", 3, "investigation_skipped"), event_id: FEED_EVENT(3), reason: "existing_recorded_recommendation" },
    {
      ...identity(FEED_ID, "S04", 4, "run_result"),
      event_id: FEED_EVENT(4),
      investigation_status: "skipped",
      recommendation: "CHALLENGE",
      recommendation_basis: "evidence_grounded",
      authority_status: "not_evaluated",
      simulated_action: "none",
      execution_mode: "recorded",
      data_label: "synthetic",
    },
  ],
)

const CARRIED_COPY = "Carried from the scenario's recorded investigation; no agent ran for this payment."

function zeroScenarios() {
  return Object.fromEntries(
    ["S01", "S02", "S03", "S04", "S05", "S06", "S07", "S08"].map((id) => [id, { PASS: 0, CHALLENGE: 0, HOLD: 0 }]),
  )
}

const CASE_PAGE = {
  contract_version: "1.0",
  items: [S05_DETAIL.case, S04_DETAIL.case],
  next_cursor: null,
  totals: {
    total: 2,
    by_recommendation: { PASS: 0, CHALLENGE: 1, HOLD: 1 },
    by_scenario: { ...zeroScenarios(), S04: { PASS: 0, CHALLENGE: 1, HOLD: 0 }, S05: { PASS: 0, CHALLENGE: 0, HOLD: 1 } },
    deterministic_passes: 0,
    fail_safe_holds: 1,
    completed_investigations: 1,
  },
}

const UNAVAILABLE = { detail: { code: "cases_unavailable", message: "Case history is off in this environment." } }

async function useBrowserId(page: Page) {
  await page.addInitScript((id) => window.localStorage.setItem("showcase-browser-id", id), BROWSER_ID)
}

test.describe("Risk Console Cases tab", () => {
  test.beforeEach(async ({ page }) => {
    await useBrowserId(page)
    // The Scenario tab's analytics are not under test here.
    await page.route("**/sandbox/scenarios/*/analytics", (route) =>
      route.fulfill({ status: 503, contentType: "application/json", body: "{}" }),
    )
    // The feed starts by itself (spec 0005); never create a real run here.
    await page.route("**/sandbox/scenarios/*/simulation-runs", (route) =>
      route.fulfill({ status: 503, contentType: "application/json", body: "{}" }),
    )
  })

  async function stubCaseList(page: Page, queries: string[] = []) {
    await page.route(/\/cases(\?.*)?$/, (route) => {
      queries.push(new URL(route.request().url()).search)
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(CASE_PAGE) })
    })
  }

  test("lists saved cases, keeps each Run ID a ?case= deep link, and filters through the API", async ({ page }) => {
    const queries: string[] = []
    await stubCaseList(page, queries)
    await page.goto("/?scenario=S01")

    await page.getByRole("tab", { name: /^Cases/ }).click()
    await expect(page.getByText("Saved cases", { exact: true })).toBeVisible()
    const link = page.getByRole("link", { name: S04_ID })
    await expect(link).toHaveAttribute("href", `/?case=${S04_ID}`)
    await expect(page.getByRole("link", { name: S05_ID })).toBeVisible()

    await page.getByRole("combobox", { name: "Filter by recommendation" }).click()
    await page.getByRole("option", { name: "HOLD" }).click()
    await expect.poll(() => queries.some((query) => query.includes("recommendation=HOLD"))).toBe(true)
  })

  test("opens a case in a drawer over the table, fetched only when opened, and closes back to its row", async ({ page }) => {
    const detailRequests: string[] = []
    await stubCaseList(page)
    await page.route("**/cases/run_*", (route) => {
      detailRequests.push(route.request().url())
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(S04_DETAIL) })
    })
    await page.goto("/?scenario=S01")
    await page.getByRole("tab", { name: /^Cases/ }).click()
    await expect(page.getByRole("link", { name: S04_ID })).toBeVisible()
    expect(detailRequests).toHaveLength(0)

    await page.getByRole("link", { name: S04_ID }).click()
    const drawer = page.getByRole("dialog")
    await expect(drawer.getByRole("heading", { name: /S04/ })).toBeVisible()
    await expect(page).toHaveURL(new RegExp(`[?&]case=${S04_ID}$`))
    expect(detailRequests.length).toBeGreaterThan(0)
    // The table stays mounted behind the drawer.
    await expect(page.locator("table").first()).toBeAttached()

    await expect(drawer.getByTestId("case-stage-route")).toContainText("Eligible for investigation")
    await expect(drawer.getByTestId("case-stage-evidence")).toContainText("Fixture s04-r1")
    // A claim's citation jumps to its evidence without adding a history entry.
    const historyLength = await page.evaluate(() => history.length)
    await drawer.getByTestId("case-stage-outcome").getByRole("link", { name: "ev_payee_relationship" }).click()
    await expect(page.locator("#evidence-ev_payee_relationship")).toBeFocused()
    expect(await page.evaluate(() => history.length)).toBe(historyLength)

    await page.keyboard.press("Escape")
    await expect(drawer).toHaveCount(0)
    await expect(page).not.toHaveURL(/case=/)
    await expect(page.getByRole("link", { name: S04_ID })).toBeFocused()

    // Browser Back closes a drawer opened from the table.
    await page.getByRole("link", { name: S05_ID }).click()
    await expect(page.getByRole("dialog")).toBeVisible()
    await page.goBack()
    await expect(page.getByRole("dialog")).toHaveCount(0)
    await expect(page.getByRole("tab", { name: /^Cases/ })).toHaveAttribute("aria-selected", "true")
  })

  test("reopens a shared ?case= link on the Cases tab, and closing it stays on Risk Console", async ({ page }) => {
    await stubCaseList(page)
    await page.route("**/cases/run_*", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(S05_DETAIL) }),
    )
    await page.goto(`/?scenario=S01&case=${S05_ID}`)

    const drawer = page.getByRole("dialog")
    await expect(drawer.getByTestId("case-failure-banner")).toContainText("Investigation incomplete: fail safe HOLD")
    await drawer.getByRole("button", { name: "Close" }).click()
    await expect(drawer).toHaveCount(0)
    await expect(page).toHaveURL(/\/\?scenario=S01$/)
    // The modal hides the page from assistive tech while open, so the tab is checked after.
    await expect(page.getByRole("tab", { name: /^Cases/ })).toHaveAttribute("aria-selected", "true")
  })

  test("shows Case not found for a malformed ?case= link without requesting it", async ({ page }) => {
    await stubCaseList(page)
    const caseReads: string[] = []
    page.on("request", (request) => {
      if (/\/cases\/[^?]/.test(new URL(request.url()).pathname)) caseReads.push(request.url())
    })
    await page.goto("/?case=not-a-case")

    const drawer = page.getByRole("dialog")
    await expect(drawer).toContainText("Case not found")
    expect(caseReads).toEqual([])
    await drawer.getByRole("button", { name: "Close" }).click()
    await expect(drawer).toHaveCount(0)
    await expect(page).not.toHaveURL(/case=/)
  })

  test("lists a feed case as Live feed and opens it with the carried route and no score", async ({ page }) => {
    await page.route(/\/cases(\?.*)?$/, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ...CASE_PAGE, items: [FEED_DETAIL.case, ...CASE_PAGE.items] }),
      }),
    )
    await page.route("**/cases/run_*", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(FEED_DETAIL) }),
    )
    await page.goto("/?scenario=S01")
    await page.getByRole("tab", { name: /^Cases/ }).click()

    const feedRow = page.getByRole("row").filter({ has: page.getByRole("link", { name: FEED_ID }) })
    await expect(feedRow).toContainText("Live feed")
    const showcaseRow = page.getByRole("row").filter({ has: page.getByRole("link", { name: S04_ID }) })
    await expect(showcaseRow).toContainText("recorded")

    await page.getByRole("link", { name: FEED_ID }).click()
    const drawer = page.getByRole("dialog")
    await expect(drawer.locator(".console-source-pill").first()).toHaveText("Live feed")
    await expect(drawer.getByText("Recorded playback")).toHaveCount(0)
    await expect(drawer.getByTestId("case-stage-route")).toContainText(CARRIED_COPY)
    await expect(drawer.getByTestId("case-model-signal")).toContainText("Not scored yet")
  })

  test("falls back to this visit's runs, unlinked, when case history is off", async ({ page }) => {
    await page.route(/\/cases(\?.*)?$/, (route) =>
      route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify(UNAVAILABLE) }),
    )
    await page.route("**/showcase/investigations", (route) =>
      route.fulfill({
        contentType: "text/event-stream",
        body: `${S04_DETAIL.events.map((item) => `data: ${JSON.stringify(item.payload)}\n\n`).join("")}event: done\ndata: {}\n\n`,
      }),
    )
    await page.goto("/?scenario=S01")

    await page.getByRole("button", { name: "Run showcase" }).click()
    await page.getByRole("tab", { name: /^Cases/ }).click()
    await expect(page.getByText("This visit's runs", { exact: true })).toBeVisible()
    await expect(page.getByText(/^Not saved: case history is off in this environment\./)).toBeVisible()
    await expect(page.getByRole("row").filter({ hasText: S04_ID })).toContainText(/\d{1,2} [A-Z][a-z]{2}, \d{2}:\d{2}:\d{2}/)
    // Storage off is the public configuration, so no developer instruction shows.
    await expect(page.getByText(/API logs/)).toHaveCount(0)
    await expect(page.getByRole("combobox", { name: "Filter by recommendation" })).toHaveCount(0)
    await expect(page.locator("a.case-link")).toHaveCount(0)
  })
})
