import { expect, test } from "@playwright/test"

const API_BASE_URL = "http://localhost:8010"

async function openDecisionPage(page: import("@playwright/test").Page) {
  await page.route(`${API_BASE_URL}/scenarios`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([{ id: "A", label: "Scenario A — Synthetic HOLD" }]),
    })
  })
  await page.goto("/transactions/new")
  await expect(page.getByRole("heading", { name: "Analyse a transaction" })).toBeVisible()
  await expect(page.getByRole("button", { name: /Synthetic HOLD/ })).toBeVisible()
}

test.describe("Live decision stream states", () => {
  test("shows only unverified signed-record metadata", async ({ page }, testInfo) => {
    await openDecisionPage(page)
    await page.route(`${API_BASE_URL}/run/preset/A`, async (route) => {
      await route.fulfill({
        status: 200,
        headers: { "content-type": "text/event-stream" },
        body: [
          'data: {"node":"sim_a","result":{"sim_a":{"score":80,"outcome":"HOLD","signal_breakdown":{"amount":30},"cold_start":false,"policy_version":"v1","record_id":"record-1"}},"record":{"record_id":"record-1","schema_version":"AARF-0.2","agent_id":"demo-agent","action_type":"DECISION","policy_reference":[{"policy_id":"demo","version":"v1","section":null}],"human_oversight_status":"AUTOMATED","record_hash":"1234567890abcdef","signature_present":true,"verification_status":"not_performed"}}\n\n',
          "event: done\ndata: {}\n\n",
        ].join(""),
      })
    })

    await page.getByRole("button", { name: "Run agent" }).click()

    await expect(page.getByText("Signature present")).toBeVisible()
    await expect(page.getByText("Verification was not performed by this demo.")).toBeVisible()
    await expect(page.getByText("Reasoning chain")).toHaveCount(0)
    await expect(page.getByText("Raw JSON")).toHaveCount(0)
    if (testInfo.project.name === "mobile") {
      await page.getByText("Signature present").scrollIntoViewIfNeeded()
    }
    await expect(page).toHaveScreenshot(`live-decision-record-${testInfo.project.name}.png`, {
      fullPage: true,
    })
  })

  test("requires an explicit terminal event before reporting completion", async ({ page }) => {
    await openDecisionPage(page)
    await page.route(`${API_BASE_URL}/run/preset/A`, async (route) => {
      await route.fulfill({
        status: 200,
        headers: { "content-type": "text/event-stream" },
        body: 'data: {"node":"data_ingest","result":{},"record":null}\n\n',
      })
    })

    await page.getByRole("button", { name: "Run agent" }).click()

    await expect(page.getByText("Decision stream ended before completion")).toBeVisible()
    await expect(page.getByRole("button", { name: "Run agent" })).toBeVisible()
  })

  test("reports an HTTP failure instead of treating its body as SSE", async ({ page }) => {
    await openDecisionPage(page)
    await page.route(`${API_BASE_URL}/run/preset/A`, async (route) => {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ detail: "unavailable" }),
      })
    })

    await page.getByRole("button", { name: "Run agent" }).click()

    await expect(page.getByText("Decision run failed (HTTP 503)")).toBeVisible()
  })

  test("cancels an in-flight request without reporting a completed outcome", async ({ page }) => {
    await openDecisionPage(page)
    await page.route(`${API_BASE_URL}/run/preset/A`, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1_000))
      await route.fulfill({
        status: 200,
        headers: { "content-type": "text/event-stream" },
        body: "event: done\ndata: {}\n\n",
      })
    })

    await page.getByRole("button", { name: "Run agent" }).click()
    await page.getByRole("button", { name: "Cancel run" }).click()

    await expect(page.getByRole("status")).toContainText("Demo run cancelled")
    await expect(page.getByRole("button", { name: "Run agent" })).toBeVisible()
  })
})
