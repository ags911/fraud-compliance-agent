import { showcaseBrowserHeaders } from "@/lib/showcase-browser-id"
import type { ShowcaseScenarioId } from "@/lib/showcase-types"

/**
 * Types and fetchers for durable showcase cases, mirroring the proposed
 * `docs/proposals/schemas/showcase-cases.v0.proposed.schema.json` (spec 0002).
 * Internal and not yet an accepted contract.
 */

export type ShowcaseCaseSummary = {
  case_id: string
  scenario_id: ShowcaseScenarioId
  requested_mode: "recorded" | "live"
  execution_mode: "recorded" | "live"
  fallback_reason: "live_disabled" | "admission_limited" | "provider_unavailable" | null
  provider: "groq" | null
  model_id: string | null
  deterministic_route: "PASS" | "HOLD" | "INVESTIGATE"
  investigation_status: "skipped" | "complete" | "incomplete"
  recommendation: "PASS" | "CHALLENGE" | "HOLD"
  recommendation_basis: "deterministic" | "evidence_grounded" | "fail_safe"
  failure_reason:
    | "provider_unavailable"
    | "tool_failed"
    | "invalid_output"
    | "timeout"
    | "tool_budget_exhausted"
    | null
  authority_status: "not_evaluated"
  tool_call_count: number
  evidence_count: number
  event_count: number
  fixture_version: string | null
  started_at: string
  completed_at: string
  expires_at: string
  contract_version: "1.0"
}

export type ShowcaseStoredEvent = {
  sequence: number
  event_id: string
  event_type: string
  recorded_at: string
  /** One accepted public-showcase-events.v1 payload, exactly as emitted. */
  payload: Record<string, unknown>
}

export type ShowcaseCaseDetail = {
  contract_version: "1.0"
  case: ShowcaseCaseSummary
  events: ShowcaseStoredEvent[]
}

/** How a case read ended: found, one message for every "not found", or storage off. */
export type ShowcaseCaseResult =
  | { status: "found"; detail: ShowcaseCaseDetail }
  | { status: "not_found" }
  | { status: "unavailable" }

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8010"
const CASE_ID = /^run_[a-z0-9_]{3,64}$/

/** Whether an ID has the only accepted case ID form (checked before any request). */
export function isShowcaseCaseId(value: string | undefined): value is string {
  return typeof value === "string" && CASE_ID.test(value)
}

/**
 * Read one case for this browser.
 *
 * A missing, expired, or other browser's case all return `not_found`; a
 * disabled store, a missing browser key, or an unreachable API return
 * `unavailable`. Any other failure throws, so the page can offer a retry.
 */
export async function fetchShowcaseCase(caseId: string, signal?: AbortSignal): Promise<ShowcaseCaseResult> {
  if (!isShowcaseCaseId(caseId)) return { status: "not_found" }
  const headers = showcaseBrowserHeaders()
  if (!Object.keys(headers).length) return { status: "unavailable" }

  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}/cases/${encodeURIComponent(caseId)}`, { headers, signal })
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error
    return { status: "unavailable" }
  }
  if (response.status === 404) {
    // Until the /cases routes exist, FastAPI answers 404 with its own body;
    // only the contract's own code means "this case is not yours or is gone".
    const body = (await response.json().catch(() => null)) as { detail?: { code?: string } } | null
    return body?.detail?.code === "case_not_found" ? { status: "not_found" } : { status: "unavailable" }
  }
  if (response.status === 503) return { status: "unavailable" }
  if (!response.ok) throw new Error(`Case request failed with status ${response.status}`)
  return { status: "found", detail: (await response.json()) as ShowcaseCaseDetail }
}

export type ShowcaseRecommendationCounts = { PASS: number; CHALLENGE: number; HOLD: number }

export type ShowcaseCaseTotals = {
  total: number
  by_recommendation: ShowcaseRecommendationCounts
  by_scenario: Record<string, ShowcaseRecommendationCounts>
  deterministic_passes: number
  fail_safe_holds: number
  completed_investigations: number
}

export type ShowcaseCasePage = {
  contract_version: "1.0"
  items: ShowcaseCaseSummary[]
  next_cursor: string | null
  totals: ShowcaseCaseTotals
}

export type ShowcaseCaseFilters = {
  scenarioId?: ShowcaseScenarioId
  recommendation?: ShowcaseCaseSummary["recommendation"]
}

/** How a list read ended: a page, or case history unavailable (AC-10 fallback). */
export type ShowcaseCaseListResult = { status: "ok"; page: ShowcaseCasePage } | { status: "unavailable" }

/**
 * Read one newest first page of this browser's cases.
 *
 * Any failure (storage off, no browser key, the API unreachable or erroring)
 * returns `unavailable`, which the Cases tab turns into its session fallback.
 */
export async function fetchShowcaseCases(
  filters: ShowcaseCaseFilters = {},
  cursor?: string | null,
  signal?: AbortSignal,
): Promise<ShowcaseCaseListResult> {
  const headers = showcaseBrowserHeaders()
  if (!Object.keys(headers).length) return { status: "unavailable" }
  const params = new URLSearchParams()
  if (filters.scenarioId) params.set("scenario_id", filters.scenarioId)
  if (filters.recommendation) params.set("recommendation", filters.recommendation)
  if (cursor) params.set("cursor", cursor)
  const query = params.toString()
  try {
    const response = await fetch(`${API_BASE_URL}/cases${query ? `?${query}` : ""}`, { headers, signal })
    if (!response.ok) return { status: "unavailable" }
    return { status: "ok", page: (await response.json()) as ShowcaseCasePage }
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error
    return { status: "unavailable" }
  }
}

/**
 * Whether a finished run was saved: it is on the unfiltered newest first page.
 * A run missing from that page was not saved (AC-4, AC-10).
 */
export async function checkShowcaseCaseSaved(runId: string): Promise<"saved" | "not_saved" | "unavailable"> {
  const result = await fetchShowcaseCases()
  if (result.status === "unavailable") return "unavailable"
  return result.page.items.some((item) => item.case_id === runId) ? "saved" : "not_saved"
}
