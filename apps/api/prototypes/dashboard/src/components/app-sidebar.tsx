import * as React from "react"

import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { ChartNoAxesCombinedIcon, CircleGaugeIcon, ListChecksIcon, PlugZapIcon, ReceiptTextIcon, ScaleIcon, SearchIcon, Settings2Icon, ShieldCheckIcon } from "lucide-react"

const data = {
  user: {
    name: "Fraud operator",
    email: "operator@northstar.test",
    avatar: "",
  },
  navMain: [
    { title: "Overview", url: "#", icon: <CircleGaugeIcon /> },
    { title: "Transactions", url: "#", icon: <ReceiptTextIcon /> },
    { title: "Review queue", url: "#", icon: <ListChecksIcon /> },
    { title: "Rules & policies", url: "#", icon: <ScaleIcon /> },
    { title: "Decision insights", url: "#", icon: <ChartNoAxesCombinedIcon /> },
    { title: "Integrations", url: "#", icon: <PlugZapIcon /> },
  ],
  navSecondary: [
    { title: "Search", url: "#", icon: <SearchIcon /> },
    { title: "Settings", url: "#", icon: <Settings2Icon /> },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:p-1.5!"
            >
              <a href="#">
                <ShieldCheckIcon className="size-5!" />
                <span className="text-base font-semibold">Risk Console</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  )
}
