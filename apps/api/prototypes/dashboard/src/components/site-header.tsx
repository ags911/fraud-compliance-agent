import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { SearchIcon } from "lucide-react"

export function SiteHeader() {
  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        <div className="relative max-w-md flex-1">
          <SearchIcon className="absolute top-2.5 left-3 size-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search transaction, customer, or review ID" />
        </div>
        <Badge variant="secondary" className="ml-auto hidden sm:inline-flex">Sandbox</Badge>
      </div>
    </header>
  )
}
