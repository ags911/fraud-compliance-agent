import { test as base, expect } from "@playwright/test"

// Most tests open Overview directly and are not about the first-visit welcome dialog,
// so they start with it already answered. It is only skipped when nothing is stored,
// so a test that sets its own session is not overridden. Tests of the welcome dialog
// itself import from "@playwright/test" instead.
export const test = base.extend({
  page: async ({ page }, provide) => {
    await page.addInitScript(() => {
      const key = "kepler-demo-session"
      if (!window.sessionStorage.getItem(key)) {
        window.sessionStorage.setItem(key, JSON.stringify({ welcomeSeen: true }))
      }
    })
    await provide(page)
  },
})

export { expect }
