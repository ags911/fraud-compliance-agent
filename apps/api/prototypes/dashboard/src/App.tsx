import { AppSidebar } from "@/components/app-sidebar"
import { ReviewQueue } from "@/components/review-queue"
import { RiskChart } from "@/components/risk-chart"
import { SectionCards } from "@/components/section-cards"
import { SiteHeader } from "@/components/site-header"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { CircleCheckIcon, InfoIcon } from "lucide-react"

export function App() {
  return (
    <TooltipProvider>
      <SidebarProvider style={{ "--sidebar-width": "17rem", "--header-height": "4rem" } as React.CSSProperties}>
        <AppSidebar variant="inset" />
        <SidebarInset>
          <SiteHeader />
          <div className="@container/main flex flex-1 flex-col gap-5 p-4 lg:p-6">
            <Alert className="border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-100">
              <InfoIcon /><AlertTitle>Sandbox environment</AlertTitle>
              <AlertDescription>Every payment action shown here is simulated.</AlertDescription>
            </Alert>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div><h1 className="text-2xl font-semibold tracking-tight">Risk operations</h1><p className="text-sm text-muted-foreground">Monitor decisions, exposure, and cases that need attention.</p></div>
              <Badge variant="outline" className="gap-1.5 py-1.5"><CircleCheckIcon className="size-3.5 text-emerald-600" />Decision service operational</Badge>
            </div>
            <SectionCards />
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]"><RiskChart /><ReviewQueue /></div>
            <div className="grid gap-5 lg:grid-cols-2">
              <StatusCard title="Decision service" rows={[["Active policy set","policy-set-v12"],["p95 scoring latency","38 ms"],["Action success","100%"],["Reviews within SLA","96.4%"]]} />
              <StatusCard title="Integration health" rows={[["Payment feed","Connected"],["Feature freshness","18 seconds"],["Action executor","Healthy"],["Arbiris integration","Connected"]]} healthy />
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}

function StatusCard({ title, rows, healthy = false }: { title: string; rows: string[][]; healthy?: boolean }) {
  return <Card><CardHeader><CardTitle>{title}</CardTitle></CardHeader><CardContent className="grid gap-3 text-sm sm:grid-cols-2">{rows.map(([label,value]) => <div className="rounded-lg border p-3" key={label}><div className="text-xs text-muted-foreground">{label}</div><div className="mt-1 flex items-center gap-2 font-medium">{healthy && <span className="size-2 rounded-full bg-emerald-500" />}{value}</div></div>)}</CardContent></Card>
}

export default App
