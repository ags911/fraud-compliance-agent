import { BrowserRouter, Link, Route, Routes, useLocation, useNavigate } from "react-router-dom"

import { OverviewContent } from "@/Overview"
import { ModelBenchmarkPage } from "@/ModelBenchmark"
import { NewTransactionPage } from "@/NewTransaction"
import { AppSidebar } from "@/components/app-sidebar"
import {
  PaymentsAppShell,
  PaymentsPageHeading,
  PaymentsPageMain,
  PaymentsTopBar,
} from "@/components/payments-ui"

type ProductRoute = {
  title: string
  description: string
  referenceHref?: string
}

const plannedRoutes: Record<string, ProductRoute> = {
  "/transactions": {
    title: "Transactions",
    description: "Search and inspect durable transaction decisions once the processing API is available.",
  },
  "/reviews": {
    title: "Reviews",
    description: "The review queue will appear when authenticated, versioned review contracts are available.",
  },
  "/rules/performance": {
    title: "Rules performance",
    description: "This operational view remains unavailable until rules and performance data have a versioned API contract.",
    referenceHref: "/rules-performance.html",
  },
  "/insights": {
    title: "Insights",
    description: "Model and drift insights will appear only when measured API data is available.",
  },
  "/settings": {
    title: "Settings",
    description: "Role-aware policy, integration, and environment settings require authenticated API contracts.",
  },
}

function activeItemFor(pathname: string) {
  if (pathname.startsWith("/transactions")) return "Transactions"
  if (pathname.startsWith("/reviews")) return "Reviews"
  if (pathname.startsWith("/rules")) return "Rules"
  if (pathname.startsWith("/insights")) return "Insights"
  if (pathname.startsWith("/settings")) return "Settings"
  return "Overview"
}

function PlannedPage({ route }: { route: ProductRoute }) {
  return (
    <>
      <PaymentsTopBar demoSession={false} />
      <PaymentsPageMain>
        <PaymentsPageHeading title={route.title} description={route.description} />
        <section className="rounded-xl border border-border bg-card px-6 py-8 text-center">
          <p className="payments-type-section-title">Planned operational surface</p>
          <p className="mx-auto mt-2 max-w-prose payments-type-body text-muted-foreground">
            This page intentionally has no representative metrics, queue counts, or actions until its backend contract is implemented.
          </p>
          {route.referenceHref ? (
            <a className="payments-button mt-5 inline-flex" data-emphasis="primary" href={route.referenceHref}>
              Open the visual reference
            </a>
          ) : null}
        </section>
      </PaymentsPageMain>
    </>
  )
}

function MissingPage() {
  return (
    <>
      <PaymentsTopBar demoSession={false} />
      <PaymentsPageMain>
        <PaymentsPageHeading title="Page not found" description="The page you requested is not part of this dashboard." />
        <section className="rounded-xl border border-border bg-card px-6 py-8 text-center">
          <Link className="payments-button inline-flex" data-emphasis="primary" to="/overview">
            Return to Overview
          </Link>
        </section>
      </PaymentsPageMain>
    </>
  )
}

function ProductRoutes() {
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <PaymentsAppShell
      sidebar={
        <AppSidebar
          activeItem={activeItemFor(location.pathname)}
          onNavigate={(href) => navigate(href)}
          showStaticBadges={false}
        />
      }
    >
      <Routes>
        <Route path="/" element={<OverviewContent />} />
        <Route path="/overview" element={<OverviewContent />} />
        <Route path="/insights" element={<ModelBenchmarkPage />} />
        <Route path="/transactions/new" element={<NewTransactionPage />} />
        {Object.entries(plannedRoutes).map(([path, route]) => (
          <Route key={path} path={path} element={<PlannedPage route={route} />} />
        ))}
        <Route path="*" element={<MissingPage />} />
      </Routes>
    </PaymentsAppShell>
  )
}

export default function ProductApp() {
  return (
    <BrowserRouter>
      <ProductRoutes />
    </BrowserRouter>
  )
}
