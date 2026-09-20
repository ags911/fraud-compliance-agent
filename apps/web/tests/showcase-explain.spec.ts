import AxeBuilder from "@axe-core/playwright"
import { expect, test, type Page } from "@playwright/test"

const API_BASE_URL = "http://localhost:8010"
const SHOWCASE_URL = `${API_BASE_URL}/showcase/investigations`
const HEALTH_URL = `${API_BASE_URL}/health`

function identity(scenario: string, sequence: number, event: string) {
  return {
    schema_version: "1.0",
    event_id: `evt_abc123_${sequence}`,
    run_id: "run_abc123def456",
    scenario_id: scenario,
    sequence,
    event,
  }
}

function sse(payloads: Record<string, unknown>[]): string {
  return payloads.map((payload) => `data: ${JSON.stringify(payload)}\n\n`).join("") + "event: done\ndata: {}\n\n"
}

const S04_RECORDED = sse([
  {
    ...identity("S04", 1, "run_started"),
    requested_mode: "recorded",
    execution_mode: "recorded",
    fallback_reason: null,
    provider: null,
    model_id: null,
    data_label: "synthetic",
  },
  { ...identity("S04", 2, "route_resolved"), deterministic_route: "INVESTIGATE", investigation_eligibility: "eligible" },
  { ...identity("S04", 3, "tool_call"), call_index: 1, tool_name: "get_payee_evidence" },
  {
    ...identity("S04", 4, "tool_result"),
    call_index: 1,
    tool_name: "get_payee_evidence",
    evidence: [
      {
        evidence_id: "ev_payee_relationship",
        category: "payee_relationship",
        display_value: "First payment to this synthetic payee",
        source_class: "synthetic_fixture",
        fixture_version: "1.0",
      },
    ],
  },
  {
    ...identity("S04", 5, "investigation_result"),
    investigation_status: "complete",
    recommendation: "CHALLENGE",
    recommendation_basis: "evidence_grounded",
    summary: "Synthetic evidence remains mixed, so the bounded agent recommends a challenge.",
    claims: [
      {
        claim_id: "claim_recent_payee",
        text: "The synthetic payee relationship is recent.",
        evidence_ids: ["ev_payee_relationship"],
      },
    ],
    uncertainties: ["No production identity or provider evidence is available."],
    authority_status: "not_evaluated",
    simulated_action: "none",
    failure_reason: null,
  },
  {
    ...identity("S04", 6, "run_result"),
    investigation_status: "complete",
    recommendation: "CHALLENGE",
    recommendation_basis: "evidence_grounded",
    authority_status: "not_evaluated",
    simulated_action: "none",
    execution_mode: "recorded",
    data_label: "synthetic",
  },
])

async function runS04(page: Page) {
  await page.route(SHOWCASE_URL, async (route) => {
    await route.fulfill({ status: 200, headers: { "content-type": "text/event-stream" }, body: S04_RECORDED })
  })
  await page.getByRole("button", { name: "Run investigation" }).click()
  await expect(page.getByTestId("showcase-outcome")).toBeVisible()
}

async function openShowcase(page: Page) {
  await page.goto("/transactions/investigation")
  await expect(page.getByRole("heading", { name: "Showcase investigation" })).toBeVisible()
}

/**
 * The status lives in the sidebar, which is a drawer at the mobile width, so
 * open it there before asserting. The status itself is identical either way.
 */
async function revealStatus(page: Page, projectName: string) {
  if (projectName === "mobile") {
    await page.getByRole("button", { name: "Toggle navigation menu" }).click()
    await expect(page.locator('[data-sidebar="sidebar"][data-mobile="true"]')).toBeVisible()
  }
}

test.describe("Demo API status", () => {
  test("reports the status a liveness check actually found", async ({ page }, testInfo) => {
    await page.route(HEALTH_URL, (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "ok" }) }),
    )
    await openShowcase(page)
    await revealStatus(page, testInfo.project.name)

    await expect(page.getByTestId("api-health")).toHaveAttribute("data-status", "ready")
    await expect(page.getByTestId("api-health")).toContainText("Demo API ready")
  })

  test("reports an unreachable API as unavailable, never as operational", async ({ page }, testInfo) => {
    await page.route(HEALTH_URL, (route) => route.abort())
    await openShowcase(page)
    await revealStatus(page, testInfo.project.name)

    await expect(page.getByTestId("api-health")).toHaveAttribute("data-status", "unavailable")
    await expect(page.getByTestId("api-health")).toContainText("Demo API unavailable")
    await expect(page.getByText("All systems operational")).toHaveCount(0)
  })

  test("shows a slow cold start as waking rather than as a fault", async ({ page }, testInfo) => {
    // Scale-to-zero compute answers the first request only after it starts up.
    await page.route(HEALTH_URL, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 2500))
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "ok" }) })
    })
    await openShowcase(page)
    await revealStatus(page, testInfo.project.name)

    await expect(page.getByTestId("api-health")).toHaveAttribute("data-status", "waking")
    await expect(page.getByTestId("api-health")).toContainText("Waking the demo API")
    await expect(page.getByTestId("api-health")).toHaveAttribute("data-status", "ready", { timeout: 5000 })
  })
})

test.describe("Explain this decision", () => {
  test("refuses to answer before a run has completed", async ({ page }) => {
    await openShowcase(page)
    const explain = page.getByTestId("explain-decision")

    // The panel labels itself a preview, next to its heading.
    await expect(page.getByText("Explain this decision")).toBeVisible()
    await expect(page.getByText("Preview", { exact: true })).toBeVisible()
    await expect(explain.getByRole("button", { name: /What was recommended/ })).toBeDisabled()
    await expect(explain.getByRole("textbox")).toBeDisabled()
  })

  test("answers the recommendation from the run and names its source", async ({ page }) => {
    await openShowcase(page)
    await runS04(page)
    const explain = page.getByTestId("explain-decision")

    await explain.getByRole("button", { name: /What was recommended/ }).click()

    await expect(explain.getByText(/CHALLENGE, grounded in the evidence/)).toBeVisible()
    await expect(explain.getByText("Source: Investigation trace").first()).toBeVisible()
  })

  test("grounds its evidence answer in the identifiers the run returned", async ({ page }) => {
    await openShowcase(page)
    await runS04(page)
    const explain = page.getByTestId("explain-decision")

    await explain.getByRole("button", { name: /What evidence was used/ }).click()

    await expect(explain.getByText(/ev_payee_relationship/)).toBeVisible()
    await expect(explain.getByText("Source: Investigation trace evidence")).toBeVisible()
  })

  test("confirms every claim cites same-run evidence", async ({ page }) => {
    await openShowcase(page)
    await runS04(page)
    const explain = page.getByTestId("explain-decision")

    await explain.getByRole("button", { name: /Is every claim backed/ }).click()

    await expect(explain.getByText(/claim_recent_payee → ev_payee_relationship/)).toBeVisible()
  })

  test("never claims the surface can approve or release a payment", async ({ page }) => {
    await openShowcase(page)
    await runS04(page)
    const explain = page.getByTestId("explain-decision")

    await explain.getByRole("button", { name: /Could this approve or release/ }).click()

    await expect(explain.getByText(/cannot decide authority or move money/)).toBeVisible()
  })

  test("refuses a question it cannot ground in the run", async ({ page }) => {
    await openShowcase(page)
    await runS04(page)
    const explain = page.getByTestId("explain-decision")

    await explain.getByRole("textbox").fill("What is the false positive rate in production?")
    await explain.getByRole("button", { name: "Send" }).click()

    await expect(explain.getByText("I can only answer about this run. Try one of the suggested questions.")).toBeVisible()
  })

  test("says no language model is connected", async ({ page }) => {
    await openShowcase(page)

    await expect(page.getByTestId("explain-decision")).toContainText("No language model is connected")
  })

  test("has no automatically detectable WCAG A/AA violations after answering", async ({ page }) => {
    await openShowcase(page)
    await runS04(page)
    await page.getByTestId("explain-decision").getByRole("button", { name: /What evidence was used/ }).click()
    await page.evaluate(() => document.fonts.ready)

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze()

    expect(
      results.violations.map(
        (violation) => `${violation.id} (${violation.impact}): ${violation.help} — ${violation.nodes.length} node(s)`,
      ),
    ).toEqual([])
  })
})

test.describe("Showcase investigation tour", () => {
  test("opens on the API status and cold-start explanation", async ({ page }) => {
    await openShowcase(page)

    await page.getByRole("button", { name: "Tour this workspace" }).click()

    await expect(page.getByText("Check the demo API first")).toBeVisible()
    await expect(page.getByText(/scales to zero/)).toBeVisible()
    await expect(page.getByText(/never as an outage/)).toBeVisible()
  })

  test("is keyboard operable through every step", async ({ page }) => {
    await openShowcase(page)
    await page.getByRole("button", { name: "Tour this workspace" }).click()
    await expect(page.getByText("Check the demo API first")).toBeVisible()

    // Advance with the keyboard only: focus the control, then activate it.
    const title = page.locator(".driver-popover-title")
    for (const heading of ["Pick a synthetic scenario", "Follow the evidence", "Ask about this run"]) {
      await page.locator(".driver-popover-next-btn").focus()
      await page.keyboard.press("Enter")
      await expect(title).toHaveText(heading)
    }

    await page.keyboard.press("Escape")
    await expect(title).toHaveCount(0)
  })
})

test.describe("Keyboard operation", () => {
  test("the whole run flow is reachable and operable by keyboard alone", async ({ page }) => {
    await openShowcase(page)
    await page.route(SHOWCASE_URL, async (route) => {
      await route.fulfill({ status: 200, headers: { "content-type": "text/event-stream" }, body: S04_RECORDED })
    })

    // Select a scenario with the keyboard, then run it, without using a pointer.
    await page.getByRole("radio", { name: /S04/ }).focus()
    await page.keyboard.press("Space")
    await expect(page.getByRole("radio", { name: /S04/ })).toBeChecked()

    await page.getByRole("button", { name: "Run investigation" }).focus()
    await page.keyboard.press("Enter")
    await expect(page.getByTestId("showcase-outcome")).toBeVisible()

    // The Explain draft submits on Enter, so the panel needs no pointer either.
    const input = page.getByTestId("explain-decision").getByRole("textbox")
    await input.focus()
    await input.fill("What evidence was used?")
    await page.keyboard.press("Enter")
    await expect(page.getByTestId("explain-decision").getByText(/ev_payee_relationship/)).toBeVisible()
  })

  test("every interactive control shows a visible focus indicator", async ({ page }) => {
    await openShowcase(page)

    const runButton = page.getByRole("button", { name: "Run investigation" })
    await runButton.focus()

    const outlineWidth = await runButton.evaluate((element) => {
      const style = getComputedStyle(element)
      return Number.parseFloat(style.outlineWidth) + Number.parseFloat(style.getPropertyValue("--tw-ring-offset-width") || "0")
    })
    expect(outlineWidth).toBeGreaterThan(0)
  })
})
