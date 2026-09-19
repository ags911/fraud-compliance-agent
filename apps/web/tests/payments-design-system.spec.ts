import { expect, test } from "./base"

async function waitForFonts(page: import("@playwright/test").Page) {
  await page.evaluate(() => document.fonts.ready)
}

async function readSidebarContract(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    function read(selector: string) {
      const element = document.querySelector<HTMLElement>(selector)
      if (!element) throw new Error(`Missing sidebar contract element: ${selector}`)
      const style = getComputedStyle(element)
      const rect = element.getBoundingClientRect()
      return {
        rect: [rect.x, rect.y, rect.width, rect.height],
        fontFamily: style.fontFamily,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        lineHeight: style.lineHeight,
        color: style.color,
        backgroundColor: style.backgroundColor,
        padding: style.padding,
        gap: style.gap,
        borderRadius: style.borderRadius,
      }
    }

    return {
      sidebar: read('[data-sidebar="sidebar"]'),
      header: read('[data-sidebar="header"]'),
      logo: read('[data-sidebar="header"] svg'),
      transaction: read(
        '[data-sidebar="menu-item"]:nth-child(2) [data-sidebar="menu-button"]',
      ),
      footer: read('[data-sidebar="footer"]'),
    }
  })
}

test.describe("Payments computed-style contracts", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/payments-design-system.html")
    await waitForFonts(page)
  })

  test("typography and control geometry are exact", async ({ page }) => {
    const title = page.getByRole("heading", { name: "Payments design system" })
    await expect(title).toHaveCSS("font-size", "26px")
    await expect(title).toHaveCSS("font-weight", "700")
    await expect(title).toHaveCSS("line-height", "31.2px")
    await expect(title).toHaveCSS("letter-spacing", "-0.65px")
    await expect(title).toHaveCSS("font-family", /Satoshi/)

    const button = page.getByRole("button", { name: "Default", exact: true })
    await expect(button).toHaveCSS("font-size", "13px")
    await expect(button).toHaveCSS("font-weight", "600")
    await expect(button).toHaveCSS("min-height", "34px")
    await expect(button).toHaveCSS("border-radius", "8px")
    await expect(button).toHaveCSS("padding-left", "12px")
    await expect(button).toHaveCSS("border-color", "rgb(227, 232, 238)")

    const date = page.getByRole("button", { name: "1–23 Sep 2026" })
    await expect(date).toHaveCSS("height", "32px")
    await expect(date).toHaveCSS("font-size", "14px")
    await expect(date).toHaveCSS("font-family", /Inter/)
  })

  test("selected navigation keeps its fill and underline", async ({ page }) => {
    const active = page.getByRole("button", { name: "Performance" })
    await expect(active).toHaveCSS("background-color", "rgb(240, 235, 255)")
    await expect(active).toHaveCSS("color", "rgb(85, 67, 205)")
    await expect(active).toHaveCSS("font-weight", "600")
    const underline = await active.evaluate((element) => {
      const style = getComputedStyle(element, "::after")
      return { height: style.height, background: style.backgroundColor, content: style.content }
    })
    expect(underline).toEqual({ height: "2px", background: "rgb(99, 91, 255)", content: '""' })
  })

  test("KPI strip, range toggle, status pills and table retain contracts", async ({ page }) => {
    const strip = page.locator('[data-payments-component="kpi-strip"]')
    await expect(strip).toHaveCSS("border-radius", "12px")
    await expect(strip).toHaveCSS("border-color", "rgb(227, 232, 238)")
    const firstKpi = strip.locator("div").first()
    await expect(firstKpi).toHaveCSS("padding", "15px 17px")
    const value = firstKpi.locator(".payments-kpi-strip__value")
    await expect(value).toHaveCSS("font-size", "20px")
    await expect(value).toHaveCSS("font-weight", "700")

    const selectedRange = page.getByRole("button", { name: "30D" }).first()
    await expect(selectedRange).toHaveCSS("height", "27px")
    await expect(selectedRange).toHaveCSS("border-radius", "6px")
    await expect(selectedRange).toHaveCSS("background-color", "rgb(255, 255, 255)")

    const success = page.locator('[data-payments-component="status-pill"][data-tone="success"]').first()
    await expect(success).toHaveCSS("font-size", "11px")
    await expect(success).toHaveCSS("min-height", "20px")
    await expect(success).toHaveCSS("background-color", "rgb(229, 247, 236)")
    await expect(success).toHaveCSS("color", "rgb(16, 185, 129)")

    const table = page.locator('[data-payments-component="table-panel"]')
    await expect(table).toHaveCSS("border-radius", "12px")
    await expect(table.locator("th").first()).toHaveCSS("height", "38px")
    await expect(table.locator("td").first()).toHaveCSS("height", "49px")
  })

  test("range toggle is keyboard-operable and stateful", async ({ page }) => {
    const range90 = page.getByRole("button", { name: "90D" }).first()
    await range90.focus()
    await page.keyboard.press("Enter")
    await expect(range90).toHaveAttribute("aria-pressed", "true")
  })
})

test.describe("Rules Performance behavior contracts", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/rules-performance.html")
    await waitForFonts(page)
  })

  test("date pill and chart preset share one state", async ({ page }) => {
    await page.getByRole("button", { name: "7D" }).click()
    await expect(page.getByRole("button", { name: "7D" })).toHaveAttribute("aria-pressed", "true")
    await expect(page.getByRole("button", { name: "Reporting period" })).toContainText("17–23 Sep 2026")
  })

  test("product typography roles include calendar, tooltip and expanded data", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Rules performance" })).toHaveCSS("font-size", "26px")
    await expect(page.getByRole("button", { name: "Create rule", exact: true })).toHaveCSS("font-weight", "600")
    await expect(page.getByText("Disputed", { exact: true }).last()).toHaveCSS("font-family", /Satoshi/)
    await expect(page.getByText("cus_JF019FNas284NF", { exact: true })).toHaveCSS("font-family", /monospace/)

    await page.getByRole("button", { name: /Successful: £.*% of visible volume/ }).focus()
    await expect(page.getByRole("tooltip")).toHaveCSS("font-family", /Satoshi/)
    await expect(page.getByRole("tooltip").locator("strong").first()).toHaveCSS("font-family", /^Inter,/)

    await page.getByRole("button", { name: "Reporting period" }).click()
    const calendar = page.locator('[data-slot="calendar"]')
    await expect(calendar.locator(".rdp-caption_label").first()).toHaveCSS("font-family", /Satoshi/)
    await expect(calendar.locator(".rdp-caption_label").first()).toHaveCSS("font-size", "15px")
    await expect(calendar.locator(".rdp-weekday").first()).toHaveCSS("font-size", "14px")
    await expect(calendar.locator("button[data-day]").first()).toHaveCSS("font-family", /^Inter,/)
    await page.keyboard.press("Escape")

    await page.getByText("View chart data", { exact: true }).click()
    await expect(page.locator("details tbody td").first()).toHaveCSS("font-family", /^Inter,/)
    await expect(page.locator("details tbody td").first()).toHaveCSS("font-size", "15px")
    await expect(page.locator("details th").first()).toHaveCSS("font-family", /Satoshi/)
  })

  test("distribution segment exposes value and share on focus", async ({ page }) => {
    const segment = page.getByRole("button", { name: /Successful: £.*% of visible volume/ })
    await segment.focus()
    const tooltip = page.getByRole("tooltip")
    await expect(tooltip).toContainText("Successful")
    await expect(tooltip).toContainText("£")
    await expect(tooltip).toContainText("Share")
    await expect(tooltip).toContainText("%")
  })

  test("sidebar toggle follows the shadcn desktop and mobile contracts", async ({ page }, testInfo) => {
    const toggle = page.getByRole("button", { name: "Toggle navigation menu" })
    await expect(toggle).toBeVisible()
    await expect(toggle).toHaveCSS("width", "28px")
    await expect(toggle).toHaveCSS("height", "28px")
    await expect(toggle).toHaveCSS("background-color", "rgba(0, 0, 0, 0)")

    const divider = page.locator('[data-payments-slot="topbar-divider"]')
    const search = page.locator('[data-payments-slot="topbar-search"]')
    const contentEdge = page.getByRole("heading", { name: "Rules performance" })
    await expect(divider).toHaveCSS("width", "1px")
    await expect(divider).toHaveCSS("height", "20px")
    const [toggleBox, dividerBox, searchBox] = await Promise.all([
      toggle.boundingBox(),
      divider.boundingBox(),
      search.boundingBox(),
    ])
    expect(toggleBox).not.toBeNull()
    expect(dividerBox).not.toBeNull()
    expect(searchBox).not.toBeNull()
    expect(dividerBox!.x - (toggleBox!.x + toggleBox!.width)).toBe(6)
    expect(dividerBox!.y + dividerBox!.height / 2).toBe(
      toggleBox!.y + toggleBox!.height / 2
    )
    const [toggleIconBox, contentEdgeBox] = await Promise.all([
      toggle.locator("svg").boundingBox(),
      contentEdge.boundingBox(),
    ])
    expect(toggleIconBox).not.toBeNull()
    expect(contentEdgeBox).not.toBeNull()
    expect(toggleIconBox!.x).toBe(contentEdgeBox!.x)
    expect(
      dividerBox!.x - (toggleIconBox!.x + toggleIconBox!.width)
    ).toBe(12)
    expect(searchBox!.x - (dividerBox!.x + dividerBox!.width)).toBe(12)

    if (testInfo.project.name === "desktop") {
      const sidebarIcons = page.locator(
        '[data-sidebar="header"] svg, [data-sidebar="menu-button"] svg'
      )
      const expandedIconPositions = await sidebarIcons.evaluateAll((icons) =>
        icons.map((icon) => {
          const rect = icon.getBoundingClientRect()
          return { x: rect.x, y: rect.y }
        })
      )

      await expect(toggle).toHaveAttribute("aria-expanded", "true")
      await toggle.hover()
      await expect(toggle).toHaveCSS("background-color", "rgb(246, 248, 250)")

      await toggle.click()
      await expect(toggle).toHaveAttribute("aria-expanded", "false")
      await page.waitForTimeout(80)
      const closingIconPositions = await sidebarIcons.evaluateAll((icons) =>
        icons.map((icon) => {
          const rect = icon.getBoundingClientRect()
          return { x: rect.x, y: rect.y }
        })
      )
      expect(closingIconPositions).toEqual(expandedIconPositions)
      await expect(page.locator('[data-slot="sidebar-gap"]')).toHaveCSS("width", "48px")
      const collapsedIconPositions = await sidebarIcons.evaluateAll((icons) =>
        icons.map((icon) => {
          const rect = icon.getBoundingClientRect()
          return { x: rect.x, y: rect.y }
        })
      )
      expect(collapsedIconPositions).toEqual(expandedIconPositions)

      await toggle.click()
      await expect(toggle).toHaveAttribute("aria-expanded", "true")
      await page.waitForTimeout(80)
      const openingIconPositions = await sidebarIcons.evaluateAll((icons) =>
        icons.map((icon) => {
          const rect = icon.getBoundingClientRect()
          return { x: rect.x, y: rect.y }
        })
      )
      expect(openingIconPositions).toEqual(expandedIconPositions)
      await expect(page.locator('[data-slot="sidebar-gap"]')).toHaveCSS("width", "240px")
      const reopenedIconPositions = await sidebarIcons.evaluateAll((icons) =>
        icons.map((icon) => {
          const rect = icon.getBoundingClientRect()
          return { x: rect.x, y: rect.y }
        })
      )
      expect(reopenedIconPositions).toEqual(expandedIconPositions)
    } else {
      await expect(toggle).toHaveAttribute("aria-expanded", "false")
      await toggle.click()
      const drawer = page.locator('[data-sidebar="sidebar"][data-mobile="true"]')
      await expect(drawer).toBeVisible()
      await expect(drawer).toHaveCSS("width", "240px")
      await page.keyboard.press("Escape")
      await expect(drawer).not.toBeVisible()

      await toggle.click()
      await page.getByRole("link", { name: "Rules", exact: true }).click()
      await expect(drawer).not.toBeVisible()
    }
  })
})

test.describe("Overview behavior contracts", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/overview-reference.html")
    await waitForFonts(page)
  })

  test("marks mock data, selects Overview, and filters populated decisions", async ({ page }, testInfo) => {
    await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible()
    await expect(page.getByText("Demo data", { exact: true })).toBeVisible()
    const reportingPeriod = page.getByRole("button", { name: "Reporting period" })
    await expect(reportingPeriod).toHaveText("1–23 Sep 2026")
    await expect(reportingPeriod).toHaveCSS("height", "32px")
    await expect(reportingPeriod).toHaveCSS("border-radius", "8px")
    await reportingPeriod.click()
    const calendar = page.locator('[data-slot="calendar"]')
    await expect(calendar).toBeVisible()
    await calendar.locator('button[data-day="9/24/2026"]').click()
    await expect(reportingPeriod).toHaveText("1–24 Sep 2026")
    await page.getByRole("button", { name: "How this demo works" }).click()
    const demoGuide = page.getByRole("dialog", { name: "Explore the fraud decision workflow" })
    await expect(demoGuide).toBeVisible()
    await expect(demoGuide.getByText("Choose a scenario", { exact: true })).toBeVisible()
    await page.getByRole("button", { name: "Got it" }).click()

    if (testInfo.project.name === "mobile") {
      await page.getByRole("button", { name: "Toggle navigation menu" }).click()
    }
    const overviewNavigation = page.getByRole("link", { name: "Overview", exact: true })
    await expect(overviewNavigation).toHaveAttribute("data-active", "true")
    await expect(overviewNavigation).toHaveCSS("color", "rgb(99, 91, 255)")
    if (testInfo.project.name === "mobile") {
      // Close the drawer without following the link: Overview is an app route now.
      await page.keyboard.press("Escape")
    }

    const search = page.getByRole("searchbox", {
      name: "Search transaction, customer, or review ID",
    })
    await page.getByRole("button", { name: "Select demo scenario" }).click()
    await page.getByRole("radio", { name: /Mixed 30-day portfolio/ }).click()
    await page.getByRole("button", { name: "Run", exact: true }).click()
    await search.fill("velocity")
    await expect(page.getByText("TXN-DEMO-1047", { exact: true })).toBeVisible()
    await expect(page.getByText("TXN-DEMO-1048", { exact: true })).not.toBeVisible()
    if (testInfo.project.name === "desktop") {
      await expect(page.getByText("1 of 5", { exact: true })).toBeVisible()
    }

    await search.fill("not-a-transaction")
    await expect(page.getByText("No decisions match “not-a-transaction”.")).toBeVisible()
  })

  test("starts at zero and populates only the selected scenario after Run", async ({ page }) => {
    const kpis = page.locator('[data-payments-component="kpi-strip"] .payments-kpi-strip__value')
    await expect(kpis).toHaveText(["£0.00", "0", "£0.00", "0"])
    await expect(page.getByText("No results yet. Select a demo scenario in the header, then choose Run.")).toBeVisible()
    const run = page.getByRole("button", { name: "Run", exact: true })
    await expect(run).toBeDisabled()

    const outcomeRows = page.locator(".overview-outcome")
    const passed = outcomeRows.filter({ hasText: "Passed" })
    const challenged = outcomeRows.filter({ hasText: "Challenged" })
    const held = outcomeRows.filter({ hasText: "Held" })
    await expect(passed.locator(".overview-outcome__marker")).toHaveCSS(
      "background-color",
      "rgb(16, 185, 129)",
    )
    await expect(challenged.locator(".overview-outcome__marker")).toHaveCSS(
      "background-color",
      "rgb(234, 179, 8)",
    )
    await expect(held.locator(".overview-outcome__marker")).toHaveCSS(
      "background-color",
      "rgb(184, 57, 45)",
    )
    await expect(passed.getByText("Passed", { exact: true })).toHaveCSS(
      "color",
      "rgb(10, 37, 64)",
    )
    const passedLabelBox = await passed.getByText("Passed", { exact: true }).boundingBox()
    const passedCountBox = await passed.getByText("0 transactions", { exact: true }).boundingBox()
    expect(passedLabelBox).not.toBeNull()
    expect(passedCountBox).not.toBeNull()
    expect(passedCountBox!.y).toBeGreaterThan(passedLabelBox!.y)
    expect(passedCountBox!.x).toBe(passedLabelBox!.x)
    await expect(
      page.getByRole("progressbar", {
        name: "Passed: £0.00, 0 transactions, 0%",
      }),
    ).toHaveAttribute("aria-valuenow", "0")
    await expect(page.getByText("0%", { exact: true }).last()).toBeVisible()

    await page.getByRole("button", { name: "Select demo scenario" }).click()
    const picker = page.locator(".payments-demo-session__picker")
    await expect(picker).toBeVisible()
    await expect(picker).toHaveCSS("width", "356px")
    await expect(page.getByText("Demo scenarios", { exact: true })).toBeVisible()
    await expect(page.getByText("A new device requires additional verification.")).toBeVisible()
    await expect(page.getByRole("radio")).toHaveCount(4)
    await page.getByRole("radio", { name: /New-device purchase/ }).click()
    await expect(picker).not.toBeVisible()
    await expect(kpis).toHaveText(["£0.00", "0", "£0.00", "0"])

    await expect(run).toBeEnabled()
    await expect(run).toHaveCSS("display", "flex")
    await expect(run).toHaveCSS("height", "30px")
    await expect(run).toHaveCSS("border-radius", "8px")
    await expect(run).toHaveCSS("background-color", "rgb(99, 91, 255)")
    await run.click()

    await expect(kpis).toHaveText(["£320.00", "1", "£0.00", "1"])
    await expect(page.getByText("TXN-DEMO-1046", { exact: true })).toBeVisible()
    await expect(page.getByRole("status")).toContainText("New-device purchase scenario completed")
    await page.getByRole("button", { name: "Dismiss", exact: true }).click()
    await expect(page.getByRole("status")).not.toBeVisible()
  })

  test("sidebar typography and geometry match the Rules page", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "mobile", "Desktop sidebar is represented by a Sheet on mobile")

    await page.goto("/rules-performance-reference.html")
    await waitForFonts(page)
    const reference = await readSidebarContract(page)

    await page.goto("/overview-reference.html")
    await waitForFonts(page)
    const overview = await readSidebarContract(page)

    expect(overview).toEqual(reference)
    expect(overview.transaction.fontSize).toBe("14px")
    expect(overview.transaction.lineHeight).toBe("20px")
    expect(overview.footer.fontSize).toBe("13px")
    expect(overview.transaction.fontWeight).toBe("400")
    expect(overview.transaction.borderRadius).toBe("6px")
    expect(overview.transaction.rect).toEqual([8, 104, 223, 32])
  })
})

test.describe("Product router", () => {
  test("keeps the Payments shell while product navigation changes the main route", async ({ page }, testInfo) => {
    await page.goto("/insights")
    await expect(page.getByRole("heading", { name: "Benchmark insights" })).toBeVisible()

    const shell = page.locator('[data-payments-component="app-shell"]')
    await expect(shell).toBeVisible()

    if (testInfo.project.name === "mobile") {
      await page.getByRole("button", { name: "Toggle navigation menu" }).click()
    }
    await page.getByRole("link", { name: "Transactions", exact: true }).click()
    await expect(page).toHaveURL(/\/transactions$/)
    await expect(page.getByRole("heading", { name: "Transactions" })).toBeVisible()
    await expect(shell).toBeVisible()
    if (testInfo.project.name !== "mobile") {
      await expect(page.getByRole("link", { name: "Transactions", exact: true })).toHaveAttribute("data-active", "true")
    }
  })

  test("the Overview route is the dashboard, outside the Payments shell", async ({ page }) => {
    for (const path of ["/", "/overview"]) {
      await page.goto(path)
      await expect(page.getByRole("heading", { name: "Fraud risk", level: 1 })).toBeVisible()
      await expect(page.locator('[data-payments-component="app-shell"]')).toHaveCount(0)
    }

    // The Payments Overview stays available as a design reference, not a route.
    await page.goto("/overview-reference.html")
    await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible()
    await expect(page.locator('[data-payments-component="app-shell"]')).toBeVisible()
  })

  test("the dashboard theme is scoped to its route and leaves the Payments pages alone", async ({ page }) => {
    const primary = () => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--primary").trim())

    await page.goto("/overview")
    expect(await primary()).toBe("#0b0b0b")
    expect(await page.locator("html").getAttribute("data-app-theme")).toBe("dashboard")

    // Navigating away must restore the Payments tokens, not leave the page restyled.
    await page.goto("/insights")
    expect(await primary()).toBe("#635bff")
    expect(await page.locator("html").getAttribute("data-app-theme")).toBeNull()
  })

  test("supports deep links and keeps visual references outside the product routes", async ({ page }) => {
    await page.goto("/reviews")
    await expect(page.getByRole("heading", { name: "Reviews" })).toBeVisible()
    await expect(page.getByText("Planned operational surface")).toBeVisible()

    await page.goto("/rules-performance.html")
    await expect(page.getByRole("heading", { name: "Rules performance" })).toBeVisible()
  })
})

test.describe("Payments visual contracts", () => {
  test("component catalog", async ({ page }, testInfo) => {
    await page.goto("/payments-design-system.html")
    await waitForFonts(page)
    await expect(page).toHaveScreenshot(`payments-design-system-${testInfo.project.name}.png`, { fullPage: true })
  })

  test("rules performance", async ({ page }, testInfo) => {
    await page.goto("/rules-performance.html")
    await waitForFonts(page)
    await expect(page).toHaveScreenshot(`rules-performance-${testInfo.project.name}.png`, { fullPage: true })
  })

  test("rules performance reference", async ({ page }, testInfo) => {
    await page.goto("/rules-performance-reference.html")
    await waitForFonts(page)
    await expect(page).toHaveScreenshot(
      `rules-performance-reference-${testInfo.project.name}.png`,
      { fullPage: true },
    )
  })

  test("overview", async ({ page }, testInfo) => {
    await page.goto("/overview-reference.html")
    await waitForFonts(page)
    await expect(page).toHaveScreenshot(`overview-${testInfo.project.name}.png`, { fullPage: true })
  })
})
