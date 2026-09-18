import type { ComponentProps } from "react"

import RulesPerformanceReference, {
  type TableState as ReferenceTableState,
} from "@/references/RulesPerformanceReference"

export type TableState = ReferenceTableState

export default function RulesPerformance(
  props: ComponentProps<typeof RulesPerformanceReference>,
) {
  return <RulesPerformanceReference {...props} />
}
