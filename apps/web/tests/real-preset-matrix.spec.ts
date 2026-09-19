import { expect, test } from "@playwright/test"

// This matrix intentionally uses the local FastAPI process rather than routing
// requests. It confirms the six fixed vendor scenarios still render as terminal,
// explicitly simulated traces in the browser.
test.skip(!process.env.RUN_LOCAL_API_MATRIX, "requires a separately started local FastAPI process")

const scenarios = [
  { id: "A", label: /High-risk HOLD/ },
  { id: "B", label: /Low-risk PASS/ },
  { id: "C", label: /Near-threshold PASS/ },
  { id: "D", label: /account drain, new payee/ },
  { id: "E", label: /established payee/ },
  { id: "F", label: /mule pattern/ },
]

test.describe.configure({ mode: "serial" })

test("all fixed presets complete as labelled simulated traces", async ({ page }) => {
  await page.goto("/transactions/new")
  await expect(page.getByRole("heading", { name: "Analyse a transaction" })).toBeVisible()
  await expect(page.getByText("It cannot approve, release, or execute a payment.")).toBeVisible()

  for (const scenario of scenarios) {
    await page.getByRole("button", { name: scenario.label }).click()
    await page.getByRole("button", { name: "Run agent" }).click()
    await expect(page.getByText("Features computed")).toBeVisible()
    await expect(page.getByRole("button", { name: "Run agent" })).toBeVisible()
    await expect(page.locator("text=The simulated decision trace could not finish")).toHaveCount(0)
  }
})

test("the disclosed custom baseline completes the default HOLD trace", async ({ page }) => {
  await page.goto("/transactions/new")
  await page.getByRole("button", { name: "Custom transaction" }).click()
  await expect(page.getByText("Synthetic 30-day baseline: 10 prior demo transactions averaging £210.")).toBeVisible()
  await page.getByRole("button", { name: "Run agent" }).click()
  await expect(page.getByText("Features computed")).toBeVisible()
  await expect(page.getByText("processing_failed", { exact: true })).toHaveCount(0)
})

test("the explicit outage control produces a visible fail-safe simulated outcome", async ({ page }) => {
  await page.goto("/transactions/new")
  await page.getByRole("button", { name: /High-risk HOLD/ }).click()
  await page.getByRole("switch", { name: "Simulate LLM outage" }).click()
  await page.getByRole("button", { name: "Run agent" }).click()

  await expect(page.getByText("Stage 2 unavailable — fail-safe")).toBeVisible()
  await expect(page.getByText("Demo data only")).toBeVisible()
  await expect(page.locator("text=The simulated decision trace could not finish")).toHaveCount(0)
})
