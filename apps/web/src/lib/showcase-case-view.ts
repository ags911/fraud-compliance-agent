import type { ShowcaseCaseDetail, ShowcaseStoredEvent } from "@/lib/showcase-cases"
import type {
  ShowcaseInvestigationResultEvent,
  ShowcaseInvestigationSkippedEvent,
  ShowcaseRouteResolvedEvent,
  ShowcaseRunStartedEvent,
  ShowcaseToolCallEvent,
  ShowcaseToolResultEvent,
} from "@/lib/showcase-types"

export type ShowcaseCaseStage = "route" | "evidence" | "outcome"

// Which stage each stored event belongs to (spec 0002, AC-11).
const STAGE_OF: Record<string, ShowcaseCaseStage> = {
  run_started: "route",
  route_resolved: "route",
  investigation_skipped: "route",
  tool_call: "evidence",
  tool_result: "evidence",
  investigation_result: "outcome",
  run_result: "outcome",
}

/** One saved case read into its typed events and its three stages. */
export type ShowcaseCaseView = {
  runStarted: ShowcaseRunStartedEvent | undefined
  route: ShowcaseRouteResolvedEvent | undefined
  skipped: ShowcaseInvestigationSkippedEvent | undefined
  toolCalls: ShowcaseToolCallEvent[]
  toolResults: ShowcaseToolResultEvent[]
  investigation: ShowcaseInvestigationResultEvent | undefined
  stageEvents: Record<ShowcaseCaseStage, ShowcaseStoredEvent[]>
}

function payloadsOf<T>(events: readonly ShowcaseStoredEvent[], type: string): T[] {
  return events.filter((event) => event.event_type === type).map((event) => event.payload as T)
}

/**
 * Read a saved case's stored events. They are exactly the accepted payloads
 * the live trace renders, so each is typed by its event type.
 */
export function readShowcaseCase(detail: ShowcaseCaseDetail): ShowcaseCaseView {
  const { events } = detail
  const stageEvents: Record<ShowcaseCaseStage, ShowcaseStoredEvent[]> = { route: [], evidence: [], outcome: [] }
  for (const event of events) {
    const stage = STAGE_OF[event.event_type]
    if (stage) stageEvents[stage].push(event)
  }
  return {
    runStarted: payloadsOf<ShowcaseRunStartedEvent>(events, "run_started")[0],
    route: payloadsOf<ShowcaseRouteResolvedEvent>(events, "route_resolved")[0],
    skipped: payloadsOf<ShowcaseInvestigationSkippedEvent>(events, "investigation_skipped")[0],
    toolCalls: payloadsOf<ShowcaseToolCallEvent>(events, "tool_call"),
    toolResults: payloadsOf<ShowcaseToolResultEvent>(events, "tool_result"),
    investigation: payloadsOf<ShowcaseInvestigationResultEvent>(events, "investigation_result")[0],
    stageEvents,
  }
}
