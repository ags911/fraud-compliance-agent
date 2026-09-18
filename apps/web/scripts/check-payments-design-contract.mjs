import { readFileSync, readdirSync, statSync } from "node:fs"
import { extname, join, relative, resolve } from "node:path"

const root = resolve(import.meta.dirname, "..")
const cssPath = join(root, "src/payments-design-system.css")
const typographyPath = join(root, "src/payments-typography.css")
const css = readFileSync(cssPath, "utf8") + "\n" + readFileSync(typographyPath, "utf8")

const requiredTokens = {
  "--payments-color-background": "var(--payments-white)",
  "--payments-color-foreground": "var(--payments-ink-900)",
  "--payments-color-border": "var(--payments-grey-200)",
  "--payments-color-primary": "var(--payments-purple-500)",
  "--payments-font-ui": '"Satoshi", Inter, ui-sans-serif, system-ui, -apple-system, sans-serif',
  "--payments-font-data": "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif",
  "--payments-type-page-title-size": "1.625rem",
  "--payments-type-metric-value-size": "1.25rem",
  "--payments-type-metric-value-weight": "700",
  "--payments-type-control-size": "0.8125rem",
  "--payments-type-control-weight": "600",
  "--payments-type-section-title-size": "1rem",
  "--payments-type-status-size": "0.6875rem",
  "--payments-radius-panel": "12px",
  "--payments-control-height": "34px",
  "--payments-table-row-height": "49px",
  "--payments-sidebar-width": "240px",
}

const failures = []

if (/font-weight:\s*(650|670)\b|\[font-weight:(650|670)\]/.test(css)) {
  failures.push("Product typography must use the standardized 400/500/600/700 weights")
}

for (const [token, expected] of Object.entries(requiredTokens)) {
  const match = css.match(new RegExp(`${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:\\s*([^;]+);`))
  if (!match) failures.push(`Missing required token ${token}`)
  else if (match[1].trim().replace(/\s+/g, " ") !== expected) {
    failures.push(`${token} must be ${expected}; found ${match[1].trim()}`)
  }
}

const paymentsRootBlock = css.match(/\.payments-ui\s*\{[\s\S]*?\n\}/)?.[0] ?? ""
if (!/line-height:\s*1\.5;/.test(paymentsRootBlock)) {
  failures.push(".payments-ui must retain the reference line-height of 1.5")
}

const inheritedControlsBlock =
  css.match(/\.payments-ui\s+:where\(button, input, select\)\s*\{[\s\S]*?\n\}/)?.[0] ?? ""
if (/(?:^|[;{])\s*font\s*:/.test(inheritedControlsBlock)) {
  failures.push("Payments controls must never use the font shorthand because it resets component size, weight, and line-height")
}
if (!/font-family:\s*inherit;/.test(inheritedControlsBlock)) {
  failures.push("Payments controls must inherit font-family without resetting other typography")
}

const statusBlock = css.match(/\.payments-status-pill\s*\{[\s\S]*?\n\}/)?.[0] ?? ""
if (/--chart-/.test(statusBlock)) {
  failures.push("Status pills must not consume chart-series tokens")
}

function walk(directory) {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name)
    return statSync(path).isDirectory() ? walk(path) : [path]
  })
}

const exempt = new Set([
  "src/PaymentsDesignSystem.tsx",
  "src/RulesPerformance.tsx",
  "src/components/rules-performance-chart.tsx",
])

for (const path of walk(join(root, "src"))) {
  if (![".tsx", ".ts"].includes(extname(path))) continue
  const name = relative(root, path)
  const source = readFileSync(path, "utf8")
  if (["src/references/RulesPerformanceReference.tsx", "src/components/app-sidebar.tsx", "src/components/rules-performance-chart.tsx"].includes(name)) {
    if (/text-\[\d+(?:\.\d+)?(?:px|rem)\]|\[font-weight:\d+\]/.test(source)) {
      failures.push(`${name}: use shared product typography roles instead of local size/weight recipes`)
    }
  }
  if (exempt.has(name)) continue
  const isPaymentsConsumer =
    source.includes("@/components/payments-ui") ||
    source.includes("@/templates/payments-page-template")
  if (!isPaymentsConsumer) continue

  const literalColor = source.match(/#[0-9a-fA-F]{3,8}\b/)
  const arbitraryPixel = source.match(/(?:p|m|gap|h|w|text|rounded|top|right|bottom|left)[xytrbl]?-\[\d+(?:\.\d+)?px\]/)
  if (literalColor) failures.push(`${name}: use a Payments token instead of ${literalColor[0]}`)
  if (arbitraryPixel) failures.push(`${name}: use a Payments contract instead of ${arbitraryPixel[0]}`)
}

if (failures.length) {
  console.error(`Payments design contract failed:\n- ${failures.join("\n- ")}`)
  process.exit(1)
}

console.log("Payments design contract passed")
