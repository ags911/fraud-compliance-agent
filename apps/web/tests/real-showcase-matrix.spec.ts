import { expect, test } from "@playwright/test"

// This opt-in matrix exercises the actual SDK-free FastAPI route. Unit tests
// and routed browser fixtures cannot detect transport, CORS, or SSE integration
// drift between the two applications.
test.skip(!process.env.RUN_LOCAL_SHOWCASE_MATRIX, "requires a separately started local FastAPI process")

test.describe.configure({ mode: "serial" })

test("S01-S05 complete through the real local public-showcase API", async ({ page }, testInfo) => {
  await page.goto("/transactions/investigation")
  await expect(page.getByRole("heading", { name: "Showcase investigation" })).toBeVisible()
  if (testInfo.project.name === "mobile") {
    await page.getByRole("button", { name: "Toggle navigation menu" }).click()
  }
  await expect(page.getByTestId("api-health")).toHaveAttribute("data-status", "ready")
  if (testInfo.project.name === "mobile") await page.keyboard.press("Escape")

  for (const scenario of ["S01", "S02", "S03"]) {
    await page.getByRole("radio", { name: new RegExp(scenario) }).check()
    await page.getByRole("button", { name: "Run investigation" }).click()
    await expect(page.getByTestId("showcase-skipped")).toBeVisible()
    await expect(page.getByTestId("showcase-run-result")).toBeVisible()
  }

  await page.getByRole("radio", { name: /S04/ }).check()
  await page.getByRole("button", { name: "Run investigation" }).click()
  await expect(page.getByTestId("showcase-evidence")).toContainText("Payee evidence")
  await expect(page.getByTestId("showcase-evidence")).toContainText("Device session evidence")
  await expect(page.getByTestId("showcase-outcome")).toContainText("Investigation complete")

  await page.getByRole("radio", { name: /S05/ }).check()
  await page.getByRole("button", { name: "Run investigation" }).click()
  await expect(page.getByTestId("showcase-outcome")).toContainText("Investigation incomplete")
  await expect(page.getByTestId("showcase-outcome")).toContainText("Fail-safe")
  await expect(page.getByText("The investigation could not run")).toHaveCount(0)
})
