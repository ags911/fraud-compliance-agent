import { ChevronDown } from "lucide-react"
import { Link, useLocation } from "react-router-dom"

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

type Tab = { title: string; href: string }

// Live pages are tabs. Everything the plan lists that is not built yet sits under "More",
// grouped by section, so nothing looks finished that is not. Shared by the Overview
// dashboard and every Payments page, so navigation is identical everywhere.
const liveTabs: Tab[] = [
  { title: "Overview", href: "/overview" },
  { title: "Analyse a transaction", href: "/transactions/new" },
  { title: "Insights", href: "/insights" },
]

type PlannedItem = {
  title: string
  // A planned page that already exists as a labelled placeholder. Views with no page are disabled.
  href?: string
}

const plannedSections: Array<{ section: string; items: PlannedItem[] }> = [
  { section: "Transactions", items: [{ title: "All decisions", href: "/transactions" }] },
  { section: "Reviews", items: [{ title: "Queue", href: "/reviews" }] },
  { section: "Rules", items: [{ title: "Performance", href: "/rules/performance" }, { title: "Changes" }] },
  { section: "Insights", items: [{ title: "Drift" }] },
  { section: "Settings", items: [{ title: "Policies" }, { title: "Access" }, { title: "Integrations" }] },
]

function SoonBadge() {
  return <span className="rounded-full border px-1.5 text-[10px] leading-4 text-muted-foreground">Soon</span>
}

const tabClass = (active: boolean) =>
  `-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 pb-3 text-sm font-medium outline-none focus-visible:rounded-sm focus-visible:ring-3 focus-visible:ring-ring/50 ${active ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`

/**
 * The page tabs. These are links between pages rather than panels of this one, so they are a
 * navigation landmark, not ARIA tabs. "More" lists the planned sections that have no live page.
 *
 * The same tabs render on the Overview dashboard and every Payments page, so which one is
 * "active" follows the current route rather than being fixed per caller.
 */
export function SectionTabs() {
  const location = useLocation()
  const isActive = (href: string) => location.pathname === href || (href === "/overview" && location.pathname === "/")

  return (
    <nav aria-label="Sections" className="-mx-4 mt-4 flex gap-6 overflow-x-auto border-b px-4 md:-mx-6 md:px-6">
      {liveTabs.map((tab) => (
        <Link key={tab.title} to={tab.href} aria-current={isActive(tab.href) ? "page" : undefined} className={tabClass(isActive(tab.href))}>
          {tab.title}
        </Link>
      ))}
      <Popover>
        <PopoverTrigger asChild>
          <button type="button" className={tabClass(false)}>
            More
            <ChevronDown className="size-3.5" aria-hidden="true" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 p-2">
          <p className="px-2 pb-1 text-xs text-muted-foreground">Planned, not built yet</p>
          {plannedSections.map((group) => (
            <div key={group.section} className="pt-2">
              <p className="px-2 text-[10px] tracking-[0.14em] text-muted-foreground uppercase">{group.section}</p>
              <ul className="flex flex-col">
                {group.items.map((item) => (
                  <li key={item.title}>
                    {item.href ? (
                      <Link to={item.href} className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring">
                        {item.title}
                        <SoonBadge />
                      </Link>
                    ) : (
                      <span aria-disabled="true" className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground">
                        {item.title}
                        <SoonBadge />
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </PopoverContent>
      </Popover>
    </nav>
  )
}
