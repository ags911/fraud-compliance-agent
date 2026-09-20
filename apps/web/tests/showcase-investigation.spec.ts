import AxeBuilder from "@axe-core/playwright"
import { expect, test } from "@playwright/test"

const API_BASE_URL = "http://localhost:8010"
const SHOWCASE_URL = `${API_BASE_URL}/showcase/investigations`

/**
 * Frames are built the way the accepted contract puts them on the wire: default
 * SSE message events carrying one JSON object, then a named `done` event whose
 * data is `{}`.
 */
function sse(payloads: Record<string, unknown>[]): string {
  return payloads.map((payload) => `data: ${JSON.stringify(payload)}\n\n`).join("") + "event: done\ndata: {}\n\n"
}

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
  { ...identity("S04", 5, "tool_call"), call_index: 2, tool_name: "get_device_session_evidence" },
  {
    ...identity("S04", 6, "tool_result"),
    call_index: 2,
    tool_name: "get_device_session_evidence",
    evidence: [
      {
        evidence_id: "ev_device_familiarity",
        category: "device_familiarity",
        display_value: "Recognised device on a changed synthetic network",
        source_class: "synthetic_fixture",
        fixture_version: "1.0",
      },
    ],
  },
  {
    ...identity("S04", 7, "investigation_result"),
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
    ...identity("S04", 8, "run_result"),
    investigation_status: "complete",
    recommendation: "CHALLENGE",
    recommendation_basis: "evidence_grounded",
    authority_status: "not_evaluated",
    simulated_action: "none",
    execution_mode: "recorded",
    data_label: "synthetic",
  },
])

const S01_SKIPPED = sse([
  {
    ...identity("S01", 1, "run_started"),
    requested_mode: "recorded",
    execution_mode: "recorded",
    fallback_reason: null,
    provider: null,
    model_id: null,
    data_label: "synthetic",
  },
  { ...identity("S01", 2, "route_resolved"), deterministic_route: "PASS", investigation_eligibility: "skipped" },
  { ...identity("S01", 3, "investigation_skipped"), reason: "deterministic_clear_route" },
  {
    ...identity("S01", 4, "run_result"),
    investigation_status: "skipped",
    recommendation: "PASS",
    recommendation_basis: "deterministic",
    authority_status: "not_evaluated",
    simulated_action: "none",
    execution_mode: "recorded",
    data_label: "synthetic",
  },
])

const S05_OUTAGE = sse([
  {
    ...identity("S05", 1, "run_started"),
    requested_mode: "live",
    execution_mode: "recorded",
    fallback_reason: "provider_unavailable",
    provider: null,
    model_id: null,
    data_label: "synthetic",
  },
  {
    ...identity("S05", 2, "route_resolved"),
    deterministic_route: "INVESTIGATE",
    investigation_eligibility: "eligible_failure_test",
  },
  {
    ...identity("S05", 3, "investigation_result"),
    investigation_status: "incomplete",
    recommendation: "HOLD",
    recommendation_basis: "fail_safe",
    summary: "The synthetic investigation stopped safely because its provider was unavailable.",
    claims: [],
    uncertainties: ["No live provider response was used."],
    authority_status: "not_evaluated",
    simulated_action: "none",
    failure_reason: "provider_unavailable",
  },
  {
    ...identity("S05", 4, "run_result"),
    investigation_status: "incomplete",
    recommendation: "HOLD",
    recommendation_basis: "fail_safe",
    authority_status: "not_evaluated",
    simulated_action: "none",
    execution_mode: "recorded",
    data_label: "synthetic",
  },
])

async function stubShowcase(page: import("@playwright/test").Page, body: string) {
  await page.route(SHOWCASE_URL, async (route) => {
    await route.fulfill({ status: 200, headers: { "content-type": "text/event-stream" }, body })
  })
}

async function openShowcase(page: import("@playwright/test").Page) {
  await page.goto("/transactions/investigation")
  await expect(page.getByRole("heading", { name: "Showcase investigation" })).toBeVisible()
}

test.describe("Showcase investigation", () => {
  test("starts with no invented outcome", async ({ page }) => {
    await openShowcase(page)

    await expect(page.getByText("No investigation has run")).toBeVisible()
    await expect(page.getByTestId("showcase-outcome")).toHaveCount(0)
    await expect(page.getByTestId("showcase-evidence")).toHaveCount(0)
  })

  test("shows the S04 evidence trace with same-run citations", async ({ page }) => {
    await openShowcase(page)
    await stubShowcase(page, S04_RECORDED)

    await page.getByRole("button", { name: "Run investigation" }).click()

    await expect(page.getByTestId("showcase-mode")).toContainText("Recorded playback")
    await expect(page.getByTestId("showcase-mode")).toContainText("Synthetic data")
    const evidence = page.getByTestId("showcase-evidence")
    await expect(evidence.getByText("Payee evidence")).toBeVisible()
    await expect(evidence.getByText("Device session evidence")).toBeVisible()
    await expect(evidence.getByText("ev_payee_relationship")).toBeVisible()

    const outcome = page.getByTestId("showcase-outcome")
    await expect(outcome.getByText("CHALLENGE").first()).toBeVisible()
    await expect(outcome.getByText("Investigation complete")).toBeVisible()
    // The claim must name the evidence it cites, so the reader can check it.
    await expect(outcome.getByText("Cites ev_payee_relationship")).toBeVisible()
    await expect(outcome.getByText("Not evaluated")).toBeVisible()
  })

  test("makes a deterministic bypass visible as a skipped investigation", async ({ page }) => {
    await openShowcase(page)
    await stubShowcase(page, S01_SKIPPED)
    await page.getByRole("radio", { name: /S01/ }).check()

    await page.getByRole("button", { name: "Run investigation" }).click()

    await expect(page.getByTestId("showcase-skipped")).toContainText("Investigation skipped")
    await expect(page.getByTestId("showcase-skipped")).toContainText("deterministic clear route")
    await expect(page.getByTestId("showcase-evidence")).toHaveCount(0)
    await expect(page.getByTestId("showcase-run-result")).toContainText("PASS")
  })

  test("reports the S05 outage as incomplete and fail-safe, never as a decision", async ({ page }) => {
    await openShowcase(page)
    await stubShowcase(page, S05_OUTAGE)
    await page.getByRole("radio", { name: /S05/ }).check()
    await page.getByRole("radio", { name: "Request live run" }).check()

    await page.getByRole("button", { name: "Run investigation" }).click()

    // Requesting live must not be reported as a live run when it fell back.
    await expect(page.getByTestId("showcase-mode")).toContainText("Recorded playback")
    await expect(page.getByTestId("showcase-mode")).toContainText("provider was unavailable")

    const outcome = page.getByTestId("showcase-outcome")
    await expect(outcome.getByText("Investigation incomplete")).toBeVisible()
    await expect(outcome.getByText("Fail-safe")).toBeVisible()
    await expect(outcome.getByText("No outcome was decided")).toBeVisible()
    await expect(outcome.getByText("Investigation complete")).toHaveCount(0)
  })

  test("labels a live run with its provider and model", async ({ page }) => {
    await openShowcase(page)
    await stubShowcase(
      page,
      S04_RECORDED.replace(
        '"execution_mode":"recorded","fallback_reason":null,"provider":null,"model_id":null',
        '"execution_mode":"live","fallback_reason":null,"provider":"groq","model_id":"approved-test-model"',
      ),
    )

    await page.getByRole("button", { name: "Run investigation" }).click()

    const mode = page.getByTestId("showcase-mode")
    await expect(mode).toContainText("Live model run")
    // The contract records provider and model with every live run.
    await expect(mode).toContainText("groq")
    await expect(mode).toContainText("approved-test-model")
  })

  test("turns a deferred scenario into a plain message, not a decision", async ({ page }) => {
    await openShowcase(page)
    await page.route(SHOWCASE_URL, async (route) => {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          detail: { code: "showcase_investigation_unavailable", message: "The synthetic investigation is unavailable." },
        }),
      })
    })

    await page.getByRole("button", { name: "Run investigation" }).click()

    await expect(page.getByText("The investigation could not run")).toBeVisible()
    await expect(page.getByText("operational behaviour is deferred")).toBeVisible()
    await expect(page.getByTestId("showcase-outcome")).toHaveCount(0)
  })

  test("requires the terminal event before reporting a finished run", async ({ page }) => {
    await openShowcase(page)
    // The stream stops after the result without the contract's `done` event.
    await page.route(SHOWCASE_URL, async (route) => {
      await route.fulfill({
        status: 200,
        headers: { "content-type": "text/event-stream" },
        body: S04_RECORDED.replace("event: done\ndata: {}\n\n", ""),
      })
    })

    await page.getByRole("button", { name: "Run investigation" }).click()

    await expect(page.getByText("The investigation could not run")).toBeVisible()
    await expect(page.getByText("ended before completion")).toBeVisible()
  })

  // accessibility.spec.ts sweeps this route's initial state. This covers the
  // state that only exists after a run, using the same WCAG A/AA scope.
  test("has no automatically detectable WCAG A/AA violations with a trace on screen", async ({ page }) => {
    await openShowcase(page)
    await stubShowcase(page, S04_RECORDED)
    await page.getByRole("button", { name: "Run investigation" }).click()
    await expect(page.getByTestId("showcase-outcome")).toBeVisible()
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
