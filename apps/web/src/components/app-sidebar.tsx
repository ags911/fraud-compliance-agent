import {
  ArrowLeftRight,
  BarChart3,
  Eye,
  LayoutGrid,
  Settings,
  Shield,
  type LucideIcon,
} from "lucide-react"

import { AverlynxBrand } from "@/components/averlynx-logo"
import { cn } from "@/lib/utils"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"

type NavItem = {
  title: string
  icon: LucideIcon
  badge?: string
  href: string
}

const navItems: NavItem[] = [
  { title: "Overview", icon: LayoutGrid, href: "/overview" },
  { title: "Transactions", icon: ArrowLeftRight, href: "/transactions" },
  { title: "Reviews", icon: Eye, badge: "7", href: "/reviews" },
  { title: "Rules", icon: Shield, href: "/rules/performance" },
  { title: "Insights", icon: BarChart3, href: "/insights" },
  { title: "Settings", icon: Settings, href: "/settings" },
]

const focusRing =
  "focus-visible:ring-0 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[rgba(99,91,255,0.32)]"

export function AppSidebar({
  activeItem = "Rules",
  className,
  onNavigate,
  showStaticBadges = true,
}: {
  activeItem?: NavItem["title"]
  className?: string
  /** The routed dashboard uses this to change main content without reloads.
   * Static visual-reference entries omit it and retain regular links. */
  onNavigate?: (href: string) => void
  /** The frozen static visual reference retains its approved badge geometry.
   * Product routes suppress it until a real review-count contract exists. */
  showStaticBadges?: boolean
}) {
  const { isMobile, setOpenMobile } = useSidebar()

  return (
    <Sidebar
      collapsible="icon"
      widthPx={240}
      iconWidthPx={48}
      mobileWidthPx={240}
      className={cn("gap-2 border-r border-sidebar-border px-2 pt-[18px] pb-2", className)}
    >
      <SidebarHeader className="h-5 justify-center p-0">
        <AverlynxBrand className="px-1 payments-type-brand" />
      </SidebarHeader>
      <SidebarContent className="mt-[30px] gap-0 p-0">
        <SidebarGroup className="p-0">
          <SidebarMenu className="gap-1">
            {navItems.map((item) => {
              const content = (
                <>
                  <span className="flex min-w-0 items-center gap-2">
                    <item.icon strokeWidth={1.5} />
                    <span className="group-data-[collapsible=icon]:hidden">{item.title}</span>
                  </span>
                  {showStaticBadges && item.badge ? (
                    <span className={cn("pointer-events-none flex h-5 min-w-5 items-center justify-center rounded-[6px] px-1 payments-type-metadata payments-type-medium text-sidebar-foreground/70 tabular-nums group-data-[collapsible=icon]:hidden")}>
                      {item.badge}
                    </span>
                  ) : null}
                </>
              )
              // The mockup's link itself is justify-content:space-between
              // (badge is a normal flex child, not an absolutely
              // positioned overlay like shadcn's default SidebarMenuBadge
              // pattern), hover only ever changes background (never
              // text color), and every row has a 2px-offset focus ring.
              const sharedClassName = cn(
                "justify-between rounded-[6px] payments-type-navigation data-active:bg-transparent data-active:font-bold data-active:text-primary data-active:hover:bg-sidebar-accent data-active:hover:text-primary",
                focusRing
              )

              return (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={item.title === activeItem}
                    tooltip={{ children: item.title, className: "payments-type-support" }}
                    className={cn("cursor-pointer hover:text-sidebar-foreground", sharedClassName)}
                  >
                    <a
                      href={item.href}
                      onClick={(event) => {
                        if (
                          onNavigate
                          && event.button === 0
                          && !event.metaKey
                          && !event.ctrlKey
                          && !event.shiftKey
                          && !event.altKey
                        ) {
                          event.preventDefault()
                          onNavigate(item.href)
                        }
                        if (isMobile) setOpenMobile(false)
                      }}
                    >
                      {content}
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className={cn("gap-[5px] border-t border-sidebar-border p-2 payments-type-metadata group-data-[collapsible=icon]:items-center")}>
        <p className="font-medium group-data-[collapsible=icon]:hidden">Policy set v12</p>
        <p className="flex items-center gap-[7px] text-sidebar-foreground/70 group-data-[collapsible=icon]:gap-0">
          <span className="size-[7px] shrink-0 rounded-full bg-[#087f45]" aria-hidden="true" />
          <span className="group-data-[collapsible=icon]:hidden">All systems operational</span>
        </p>
      </SidebarFooter>
    </Sidebar>
  )
}
