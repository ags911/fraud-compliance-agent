import { expect, test, type Page } from "@playwright/test"

/**
 * Radar's decision routing board (spec 0006). The feed API is stubbed: the
 * first stream answer is an empty run, later ones reveal two PASS payments, as S01's rule gives,
 * so the board shows every outcome at zero and then the routed decisions.
 */

const RUN_ID = "3f2a9c1e-7b4d-4e8a-9c2f-1a6b5d8e0f42"
const BROWSER_ID = "0b6f2d4e-7a1c-4e8b-9f3a-2c5d8e1f4a6b"

type Outcome = "PASS" | "CHALLENGE" | "HOLD"

function run(decided: Array<[number, Outcome]>) {
  const lane = (outcome: Outcome) => {
    const recent = decided
      .filter(([, recommendation]) => recommendation === outcome)
      .map(([sequence, recommendation]) => ({ event_id: `evt-${sequence}`, sequence, recommendation }))
      .reverse()
    // Like the API, list only the newest 18 while the count keeps every payment.
    return { count: recent.length, recent: recent.slice(0, 18) }
  }
  return {
    run_id: RUN_ID,
    scenario_id: "S01",
    fixture_version: "fixture-test",
    seed: "sandbox-simulation-v1",
    state: "running",
    scheduled_event_count: 200,
    appended_event_count: decided.length,
    next_due_at: null,
    routing_snapshot: { by_recommendation: { PASS: lane("PASS"), CHALLENGE: lane("CHALLENGE"), HOLD: lane("HOLD") } },
  }
}

async function stubRouting(page: Page, revealedDecisions: Array<[number, Outcome]> = [[1, "PASS"], [2, "PASS"]]) {
  await page.addInitScript((id) => window.localStorage.setItem("showcase-browser-id", id), BROWSER_ID)
  await page.route("**/sandbox/scenarios/S01/simulation-runs", (route) => route.fulfill({ json: run([]) }))
  // Later stream answers wait until the test calls `reveal`, so the empty
  // state can be checked before any decision arrives.
  let reveal = () => {}
  const revealed = new Promise<void>((resolve) => (reveal = resolve))
  let streams = 0
  await page.route(`**/sandbox/simulation-runs/${RUN_ID}/events`, async (route) => {
    streams += 1
    if (streams > 1) await revealed
    const body = streams === 1 ? run([]) : run(revealedDecisions)
    return route.fulfill({ contentType: "text/event-stream", body: `event: simulation_state\ndata: ${JSON.stringify(body)}\n\n` })
  })
  await page.route(`**/sandbox/simulation-runs/${RUN_ID}/cancel`, (route) =>
    route.fulfill({ json: { ...run(revealedDecisions), state: "cancelled" } }),
  )
  const zero = { PASS: 0, CHALLENGE: 0, HOLD: 0 }
  await page.route(/\/cases(\?.*)?$/, (route) =>
    route.fulfill({
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
    }),
  )
  return reveal
}

function nodeText(page: Page) {
  return page.getByRole("region", { name: "Live decision routing" }).locator(".recharts-sankey-nodes text, .recharts-layer text")
}

test("revealed decisions flow from the feed into their outcome nodes", async ({ page }) => {
  const reveal = await stubRouting(page)
  await page.goto("/references/radar-reference.html?scenario=S01")
  await page.getByRole("tab", { name: /^Cases/ }).click()
  const board = page.getByRole("region", { name: "Live decision routing" })

  // Before any payment every outcome is already drawn, at zero.
  await expect(board.getByText("Waiting for the first payment")).toBeVisible()
  // Every node is tall enough for its label and count, including a zero.
  await expect(nodeText(page)).toHaveText(["Feed", "0", "PASS", "0", "CHALLENGE", "0", "HOLD", "0"])
  reveal()
  await expect(board.getByText("Last routed #2 → PASS")).toBeVisible()

  // Labels sit inside the nodes and show real counts; an empty outcome stays.
  await expect(nodeText(page)).toHaveText(["Feed", "2", "PASS", "2", "CHALLENGE", "0", "HOLD", "0"])
  // One scenario's rule sends every payment to one lane, and the board says so.
  await expect(board.getByText("Every S01 payment follows its rule: PASS")).toBeVisible()
  // Screen readers get every outcome's count, including zero.
  await expect(board.getByRole("list", { name: "Routed payments by outcome" }).getByRole("listitem")).toHaveText(["PASS 2", "CHALLENGE 0", "HOLD 0"])
  await expect(board.getByText("Routing live payments.")).toBeAttached()
  // Read only: the one button only hides the board, and nothing can be followed.
  await expect(board.getByRole("button")).toHaveCount(1)
  await expect(board.getByRole("button", { name: "Hide board" })).toHaveAttribute("aria-expanded", "true")
  await expect(board.getByRole("link")).toHaveCount(0)
  await expect(board.locator("[style*='cursor: pointer']")).toHaveCount(0)
  // The chart is aria-hidden, so nothing inside it may take keyboard focus.
  await expect(board.locator("[tabindex]:not([tabindex='-1'])")).toHaveCount(0)
})

// The newest payment's sweep, clipped by its lane. A clip on the moving
// element itself travels with it and never meets the lane, so the sweep
// would render nothing; the clip must sit on a still parent.
function sweep(page: Page, outcome: Outcome) {
  return page.getByRole("region", { name: "Live decision routing" }).locator(`g[data-sweep="${outcome}"]`)
}

test("the newest payment sweeps along its own lane only", async ({ page }) => {
  const reveal = await stubRouting(page)
  await page.goto("/references/radar-reference.html?scenario=S01")
  await page.getByRole("tab", { name: /^Cases/ }).click()
  reveal()

  const group = sweep(page, "PASS")
  await expect(group).toHaveAttribute("clip-path", /link-sweep-clip/)
  await expect(page.locator("g[data-sweep]")).toHaveCount(1)
  // The clipped group stays still while its band travels inside it.
  await expect.poll(() => group.evaluate((element) => getComputedStyle(element).transform)).toBe("none")
  await expect
    .poll(() => group.locator("path").first().evaluate((element) => new DOMMatrix(getComputedStyle(element).transform).e))
    .toBeGreaterThan(20)
  await expect(group.locator("[clip-path]")).toHaveCount(0)
  // Only the route animates: the outcome nodes carry no glow.
  await expect(page.getByRole("region", { name: "Live decision routing" }).locator("rect[filter]")).toHaveCount(0)
})

test("reduced motion tints the lane without travel", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  const reveal = await stubRouting(page)
  await page.goto("/references/radar-reference.html?scenario=S01")
  await page.getByRole("tab", { name: /^Cases/ }).click()
  reveal()

  const group = sweep(page, "PASS")
  await expect(group.locator("path")).toHaveCount(1)
  await page.waitForTimeout(400)
  expect(await group.locator("path").evaluate((element) => getComputedStyle(element).transform)).toBe("none")
  await expect(page.getByRole("region", { name: "Live decision routing" }).getByText("Last routed #2 → PASS")).toBeVisible()
})

test("Hide board stops the board's motion without stopping the feed, and is remembered", async ({ page }) => {
  const reveal = await stubRouting(page)
  await page.goto("/references/radar-reference.html?scenario=S01")
  await page.getByRole("tab", { name: /^Cases/ }).click()
  reveal()
  const board = page.getByRole("region", { name: "Live decision routing" })
  await expect(board.getByText("Last routed #2 → PASS")).toBeVisible()

  const toggle = board.getByRole("button", { name: "Hide board" })
  const controlled = await toggle.getAttribute("aria-controls")
  expect(controlled).toBeTruthy()
  await expect(board.locator(`[id="${controlled}"]`)).toBeAttached()
  await toggle.click()

  // The chart and its count list go; the newest decision line stays.
  await expect(board.getByRole("button", { name: "Show board" })).toHaveAttribute("aria-expanded", "false")
  await expect(board.locator(".radar-routing-chart")).toHaveCount(0)
  await expect(board.getByRole("list", { name: "Routed payments by outcome" })).toHaveCount(0)
  await expect(board.getByText("Last routed #2 → PASS")).toBeVisible()
  await expect(board.getByText("Routing live payments.")).toBeAttached()
  // Display only: the feed is still live.
  await expect(page.getByRole("switch", { name: "Live feed" })).toBeChecked()

  // The choice survives a reload, and showing the board brings it back.
  await page.reload()
  await page.getByRole("tab", { name: /^Cases/ }).click()
  await expect(board.getByRole("button", { name: "Show board" })).toBeVisible()
  await expect(board.locator(".radar-routing-chart")).toHaveCount(0)
  await board.getByRole("button", { name: "Show board" }).click()
  await expect(board.locator(".radar-routing-chart")).toBeVisible()
  await expect(board.getByRole("button", { name: "Hide board" })).toHaveAttribute("aria-expanded", "true")
})

test("blocked storage still shows the board", async ({ page }) => {
  await page.addInitScript(() => {
    const getItem = Storage.prototype.getItem
    const setItem = Storage.prototype.setItem
    Storage.prototype.getItem = function (key: string) {
      if (key === "radar-routing-board-hidden") throw new DOMException("blocked", "SecurityError")
      return getItem.call(this, key)
    }
    Storage.prototype.setItem = function (key: string, value: string) {
      if (key === "radar-routing-board-hidden") throw new DOMException("blocked", "SecurityError")
      return setItem.call(this, key, value)
    }
  })
  const reveal = await stubRouting(page)
  await page.goto("/references/radar-reference.html?scenario=S01")
  await page.getByRole("tab", { name: /^Cases/ }).click()
  reveal()
  const board = page.getByRole("region", { name: "Live decision routing" })
  await expect(board.locator(".radar-routing-chart")).toBeVisible()
  // Hiding still works for this page view, even though it cannot be saved.
  await board.getByRole("button", { name: "Hide board" }).click()
  await expect(board.locator(".radar-routing-chart")).toHaveCount(0)
})

test("outcome nodes keep clear space when one outcome dominates", async ({ page }) => {
  // Mostly HOLD, one CHALLENGE and no PASS: the two small nodes sit side by
  // side, each raised to its minimum height.
  const decided: Array<[number, Outcome]> = Array.from({ length: 40 }, (_, index) => [index + 1, index === 20 ? "CHALLENGE" : "HOLD"])
  const reveal = await stubRouting(page, decided)
  await page.goto("/references/radar-reference.html?scenario=S01")
  await page.getByRole("tab", { name: /^Cases/ }).click()
  reveal()
  const board = page.getByRole("region", { name: "Live decision routing" })
  await expect(board.getByText("Last routed #40 → HOLD")).toBeVisible()

  const outcomes = await board.locator("rect[fill*='sankey-colors-']").evaluateAll((rects) =>
    rects
      .map((rect) => rect.getBoundingClientRect())
      .filter((box, _, boxes) => box.left > Math.min(...boxes.map((other) => other.left)))
      .map((box) => ({ top: box.top, bottom: box.bottom }))
      .sort((a, b) => a.top - b.top),
  )
  expect(outcomes).toHaveLength(3)
  for (let index = 1; index < outcomes.length; index += 1) {
    expect(outcomes[index].top - outcomes[index - 1].bottom).toBeGreaterThanOrEqual(8)
  }
  // Every node stays inside the chart.
  const chart = await board.locator(".radar-routing-chart svg").boundingBox()
  expect(outcomes[0].top).toBeGreaterThanOrEqual(chart!.y)
  expect(outcomes[2].bottom).toBeLessThanOrEqual(chart!.y + chart!.height)
})

test("a lane's count keeps every payment beyond the 18 listed", async ({ page }) => {
  // covers: AC 3
  const decided: Array<[number, Outcome]> = Array.from({ length: 25 }, (_, index) => [index + 1, "HOLD"])
  const reveal = await stubRouting(page, decided)
  await page.goto("/references/radar-reference.html?scenario=S01")
  await page.getByRole("tab", { name: /^Cases/ }).click()
  reveal()
  const board = page.getByRole("region", { name: "Live decision routing" })

  await expect(board.getByRole("list", { name: "Routed payments by outcome" }).getByRole("listitem")).toHaveText(["PASS 0", "CHALLENGE 0", "HOLD 25"])
  await expect(nodeText(page)).toHaveText(["Feed", "25", "PASS", "0", "CHALLENGE", "0", "HOLD", "25"])
})

test("an empty outcome's lane is drawn faint so its floor width does not read as flow", async ({ page }) => {
  const reveal = await stubRouting(page)
  await page.goto("/references/radar-reference.html?scenario=S01")
  await page.getByRole("tab", { name: /^Cases/ }).click()
  reveal()
  const board = page.getByRole("region", { name: "Live decision routing" })
  await expect(board.getByText("Last routed #2 → PASS")).toBeVisible()

  // Lanes in outcome order: PASS carries 2 payments, CHALLENGE and HOLD none.
  const lanes = board.locator(".recharts-sankey-links path[fill*='sankey-colors-FEED'], path[fill*='sankey-colors-FEED'][d*='C']")
  await expect.poll(() => lanes.evaluateAll((paths) => paths.map((path) => path.getAttribute("fill-opacity")))).toEqual(["0.4", "0.15", "0.15"])
})

test("the Hide board button works from the keyboard", async ({ page }) => {
  // covers: AC 9
  const reveal = await stubRouting(page)
  await page.goto("/references/radar-reference.html?scenario=S01")
  await page.getByRole("tab", { name: /^Cases/ }).click()
  reveal()
  const board = page.getByRole("region", { name: "Live decision routing" })
  const toggle = board.getByRole("button", { name: "Hide board" })
  await expect(toggle).toBeVisible()

  await toggle.focus()
  await page.keyboard.press("Enter")
  await expect(board.getByRole("button", { name: "Show board" })).toBeFocused()
  await expect(board.locator(".radar-routing-chart")).toHaveCount(0)
  await page.keyboard.press("Space")
  await expect(board.getByRole("button", { name: "Hide board" })).toHaveAttribute("aria-expanded", "true")
  await expect(board.locator(".radar-routing-chart")).toBeVisible()
})

test("stopping the feed keeps the routed counts and announces them", async ({ page }) => {
  // covers: AC 7. A stopped run keeps its last snapshot until the page leaves it.
  const reveal = await stubRouting(page, [[1, "PASS"], [2, "HOLD"], [3, "HOLD"]])
  await page.goto("/references/radar-reference.html?scenario=S01")
  await page.getByRole("tab", { name: /^Cases/ }).click()
  reveal()
  const board = page.getByRole("region", { name: "Live decision routing" })
  await expect(board.getByText("Last routed #3 → HOLD")).toBeVisible()

  await page.getByRole("switch", { name: "Live feed" }).click()

  await expect(board.getByText("Routing finished: 1 pass, 0 challenge, 2 hold.")).toBeAttached()
  await expect(board.getByRole("list", { name: "Routed payments by outcome" }).getByRole("listitem")).toHaveText(["PASS 1", "CHALLENGE 0", "HOLD 2"])
  await expect(board.getByText("Last routed #3 → HOLD")).toBeVisible()
})

test("with Live switched off before a run the board says how to start it", async ({ page }) => {
  // covers: AC 7
  await page.addInitScript(() => window.localStorage.setItem("radar-live-feed", "off"))
  await stubRouting(page)
  await page.goto("/references/radar-reference.html?scenario=S01")
  await page.getByRole("tab", { name: /^Cases/ }).click()
  const board = page.getByRole("region", { name: "Live decision routing" })

  await expect(board.getByText("Start Live to route simulated payments.")).toBeVisible()
  await expect(board.getByRole("list", { name: "Routed payments by outcome" }).getByRole("listitem")).toHaveText(["PASS 0", "CHALLENGE 0", "HOLD 0"])
  // The Cases tab stays in place beside the quiet board.
  await expect(page.getByRole("tab", { name: /^Cases/ })).toHaveAttribute("aria-selected", "true")
})

test("Run showcase becomes Stop showcase while a run is in progress", async ({ page }) => {
  await stubRouting(page)
  // The investigation never answers, so the run stays in progress until stopped.
  let aborted = false
  await page.route("**/showcase/investigations", () => {
    // Left unanswered on purpose.
  })
  page.on("requestfailed", (request) => {
    if (request.url().includes("/showcase/investigations")) aborted = true
  })
  await page.goto("/references/radar-reference.html?scenario=S01")

  const button = page.locator("#radar-run-showcase")
  await expect(button).toHaveText("Run showcase")
  await button.click()
  await expect(button).toHaveText("Stop showcase")
  await expect(button).toBeEnabled()

  await button.click()
  await expect(button).toHaveText("Run showcase")
  await expect.poll(() => aborted).toBe(true)
})
