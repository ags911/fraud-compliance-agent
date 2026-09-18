import type { ReactNode } from "react"

import {
  PaymentsAppShell,
  PaymentsButton,
  PaymentsPageHeading,
  PaymentsPageMain,
  PaymentsSubnav,
} from "@/components/payments-ui"

export function PaymentsPageTemplate<T extends string>({
  sidebar,
  title,
  description,
  tabs,
  activeTab,
  onTabChange,
  primaryAction,
  secondaryAction,
  density = "comfortable",
  children,
}: {
  sidebar: ReactNode
  title: string
  description: string
  tabs: readonly T[]
  activeTab: T
  onTabChange: (tab: T) => void
  primaryAction?: { label: string; onClick: () => void }
  secondaryAction?: { label: string; onClick: () => void }
  density?: "comfortable" | "compact"
  children: ReactNode
}) {
  return (
    <PaymentsAppShell sidebar={sidebar}>
      <PaymentsPageMain density={density}>
        <PaymentsPageHeading
          title={title}
          description={description}
          actions={
            primaryAction || secondaryAction ? (
              <>
                {secondaryAction ? <PaymentsButton onClick={secondaryAction.onClick}>{secondaryAction.label}</PaymentsButton> : null}
                {primaryAction ? <PaymentsButton emphasis="primary" onClick={primaryAction.onClick}>{primaryAction.label}</PaymentsButton> : null}
              </>
            ) : undefined
          }
        />
        <PaymentsSubnav label={`${title} navigation`} items={tabs} value={activeTab} onChange={onTabChange} />
        {children}
      </PaymentsPageMain>
    </PaymentsAppShell>
  )
}
