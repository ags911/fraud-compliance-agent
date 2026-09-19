// Records an animated walkthrough of the Overview demo, starting from the first-visit
// welcome dialog: open the scenario dropdown, choose a scenario, press Run, then see the results. It drives the
// real app in a headless browser, draws a visible cursor with click ripples, and
// writes an MP4 and a GIF.
//
// Usage (the web app must already be running):
//   npm run dev -- --host 127.0.0.1 --port 5173
//   node scripts/record-walkthrough.mjs [--flow overview|tour] [--url http://127.0.0.1:5173] [--out ../../docs/media]
//   --flow overview  skip the welcome, then the dropdown, Run, and the results (default)
//   --flow tour      take the tour from the welcome dialog and follow it
//
// Requires ffmpeg on the PATH. The Overview demo data is generated in the browser,
// so no API is needed for this walkthrough.
import { execFileSync } from "node:child_process"
import { mkdirSync, renameSync, rmSync } from "node:fs"
import path from "node:path"
import { chromium } from "@playwright/test"

const args = process.argv.slice(2)
const option = (name, fallback) => {
  const index = args.indexOf(name)
  return index >= 0 ? args[index + 1] : fallback
}
const baseUrl = option("--url", "http://127.0.0.1:5173")
const outDir = path.resolve(option("--out", "../../docs/media"))
const flow = option("--flow", "overview")
const name = flow === "tour" ? "overview-tour-walkthrough" : "overview-walkthrough"
const size = { width: 1280, height: 800 }
const scratch = path.join(outDir, ".recording")

// A cursor and a click ripple are drawn in the page, because a headless browser
// records the page but not the operating system's pointer.
const cursorOverlay = () => {
  const install = () => {
    const style = document.createElement("style")
    style.textContent = `
      #__cursor { position: fixed; z-index: 2147483647; pointer-events: none; left: 0; top: 0;
        width: 26px; height: 26px; margin: -3px 0 0 -3px; transition: transform 90ms ease-out; }
      #__cursor.down { transform: scale(0.82); }
      .__ripple { position: fixed; z-index: 2147483646; pointer-events: none; width: 44px; height: 44px;
        margin: -22px 0 0 -22px; border-radius: 50%; border: 3px solid rgba(99, 91, 255, 0.8);
        animation: __ripple 520ms ease-out forwards; }
      @keyframes __ripple { from { transform: scale(0.2); opacity: 1; } to { transform: scale(1.5); opacity: 0; } }`
    document.head.appendChild(style)
    const cursor = document.createElement("div")
    cursor.id = "__cursor"
    cursor.innerHTML = `<svg width="26" height="26" viewBox="0 0 24 24"><path d="M3 2l7.5 18 2.6-7.4L20.5 10z"
      fill="#0a2540" stroke="#ffffff" stroke-width="1.6" stroke-linejoin="round"/></svg>`
    document.body.appendChild(cursor)
    document.addEventListener("mousemove", (event) => {
      cursor.style.left = `${event.clientX}px`
      cursor.style.top = `${event.clientY}px`
    }, true)
    document.addEventListener("mousedown", (event) => {
      cursor.classList.add("down")
      const ripple = document.createElement("div")
      ripple.className = "__ripple"
      ripple.style.left = `${event.clientX}px`
      ripple.style.top = `${event.clientY}px`
      document.body.appendChild(ripple)
      setTimeout(() => ripple.remove(), 600)
    }, true)
    document.addEventListener("mouseup", () => cursor.classList.remove("down"), true)
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install)
  else install()
}

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2)
let pointer = { x: size.width / 2, y: size.height / 2 }

async function glide(page, locator, steps = 42) {
  const box = await locator.boundingBox()
  if (!box) throw new Error("Cannot move the cursor to an element that is not visible.")
  const target = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  const from = pointer
  for (let step = 1; step <= steps; step += 1) {
    const t = ease(step / steps)
    await page.mouse.move(from.x + (target.x - from.x) * t, from.y + (target.y - from.y) * t)
    await page.waitForTimeout(14)
  }
  pointer = target
}

async function click(page, locator) {
  await glide(page, locator)
  await page.waitForTimeout(180)
  await page.mouse.down()
  await page.waitForTimeout(110)
  await page.mouse.up()
}

rmSync(scratch, { recursive: true, force: true })
mkdirSync(scratch, { recursive: true })

// Use the installed Chrome, as the browser tests do, so nothing needs downloading.
const browser = await chromium.launch({ channel: "chrome" })
const context = await browser.newContext({ viewport: size, recordVideo: { dir: scratch, size } })
await context.addInitScript(cursorOverlay)
const page = await context.newPage()

await page.goto(`${baseUrl}/overview`)
const welcome = page.getByRole("dialog", { name: "Welcome to the payment risk demo" })
await welcome.waitFor()
await page.evaluate(() => document.fonts.ready)
await page.mouse.move(pointer.x, pointer.y)
await page.waitForTimeout(2800)

if (flow === "tour") {
  // Start the tour, then follow it: it advances from the user's real actions.
  await click(page, welcome.getByRole("button", { name: "Take the tour" }))
  await page.locator(".driver-popover-title", { hasText: "Choose a scenario" }).waitFor()
  await page.waitForTimeout(2200)
  await click(page, page.locator("#payments-demo-scenario-trigger"))
  await page.getByRole("radio").first().waitFor()
  await page.waitForTimeout(900)
  await click(page, page.getByRole("radio", { name: /Mixed 30-day portfolio/ }))
  await page.locator(".driver-popover-title", { hasText: "Run it" }).waitFor()
  await page.waitForTimeout(2200)
  await click(page, page.locator("#payments-demo-run"))
  await page.locator(".driver-popover-title", { hasText: "Inspect the results" }).waitFor()
  await page.waitForTimeout(2400)
  await click(page, page.locator(".driver-popover").getByRole("button", { name: "View results" }))
  await page.locator(".driver-overlay").waitFor({ state: "detached" })
  await page.waitForTimeout(2400)
} else {
  // 1. Skip the welcome, then open the scenario dropdown and choose a scenario.
  await click(page, welcome.getByRole("button", { name: "Skip" }))
  await welcome.waitFor({ state: "detached" })
  await page.waitForTimeout(900)
  await click(page, page.locator("#payments-demo-scenario-trigger"))
  await page.getByRole("radio").first().waitFor()
  await page.waitForTimeout(700)
  await glide(page, page.getByRole("radio", { name: /Trusted returning customer/ }))
  await page.waitForTimeout(450)
  await click(page, page.getByRole("radio", { name: /Mixed 30-day portfolio/ }))
  await page.waitForTimeout(1300)

  // 2. Press Run and let the results populate.
  await click(page, page.getByRole("button", { name: "Run", exact: true }))
  await page.getByText("TXN-DEMO-").first().waitFor()
  await page.waitForTimeout(2000)

  // 3. Scroll down to the decisions the scenario produced.
  await page.evaluate(() => document.getElementById("overview-results")?.scrollIntoView({ behavior: "smooth", block: "start" }))
  await page.waitForTimeout(2600)
}

await context.close()
const recorded = await page.video().path()
await browser.close()

mkdirSync(outDir, { recursive: true })
const webm = path.join(outDir, `${name}.webm`)
renameSync(recorded, webm)
rmSync(scratch, { recursive: true, force: true })

// Skip the blank frames before the first paint, then encode.
const mp4 = path.join(outDir, `${name}.mp4`)
const gif = path.join(outDir, `${name}.gif`)
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-ss", "0.5", "-i", webm, "-vf", "fps=30,scale=1280:-2",
  "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", "-movflags", "+faststart", mp4])
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-ss", "0.5", "-i", webm, "-vf",
  "fps=12,scale=960:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=160[p];[b][p]paletteuse=dither=bayer:bayer_scale=4", gif])
rmSync(webm)
console.log(`Wrote ${mp4}\nWrote ${gif}`)
