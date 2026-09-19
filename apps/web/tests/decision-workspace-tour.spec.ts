import { expect, test } from "@playwright/test"

const API_BASE_URL = "http://localhost:8010"

test("the decision workspace tour is opt-in and explains the three evidence surfaces", async ({ page }) => {
  await page.route(`${API_BASE_URL}/scenarios`, (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify([{ id: "A", label: "Scenario A — Synthetic HOLD" }]),
  }))
  await page.goto("/transactions/new")
  await expect(page.getByRole("heading", { name: "Analyse a transaction" })).toBeVisible()
  await expect(page.locator(".driver-overlay")).toHaveCount(0)

  await page.getByRole("button", { name: "Tour this workspace" }).click()
  await expect(page.locator(".driver-popover-title")).toHaveText("Choose a simulated path")
  await expect(page.locator(".driver-popover-progress-text")).toHaveText("Step 1 of 3")
  await page.locator(".driver-popover-next-btn").click()
  await expect(page.locator(".driver-popover-title")).toHaveText("Follow the decision flow")
  await page.locator(".driver-popover-next-btn").click()
  await expect(page.locator(".driver-popover-title")).toHaveText("Inspect the audit record")
})
