import { BrowserRouter, Link, Outlet, Route, Routes, useLocation, useNavigate } from "react-router-dom"

import Dashboard from "@/Dashboard"
import { ModelBenchmarkPage } from "@/ModelBenchmark"
import { NewTransactionPage } from "@/NewTransaction"
import { ShowcaseInvestigationPage } from "@/ShowcaseInvestigation"
import { AppSidebar } from "@/components/app-sidebar"
import { DemoSessionProvider } from "@/components/demo-session"
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
    referenceHref: "/references/rules-performance.html",
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

/**
 * The Payments shell, for every page that is not the Overview dashboard.
 *
 * The Overview carries its own header, section tabs, and Explain drawer, so it is
 * routed outside this layout. The rest of the console keeps the approved Payments
 * sidebar and top bar until a shell migration is approved.
 */
function PaymentsShellLayout() {
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
      <Outlet />
    </PaymentsAppShell>
  )
}

function ProductRoutes() {
  return (
    <Routes>
      {/* The dashboard is the Overview. The former Payments Overview remains as a
          design reference at /references/overview-reference.html and is no longer a
          product route. */}
      <Route path="/" element={<Dashboard />} />
      <Route path="/overview" element={<Dashboard />} />
      <Route element={<PaymentsShellLayout />}>
        <Route path="/insights" element={<ModelBenchmarkPage />} />
        <Route path="/transactions/new" element={<NewTransactionPage />} />
        {/* The SDK-free showcase investigation is its own surface. The legacy
            A-F workspace above stays until an explicit cutover decision. */}
        <Route path="/transactions/investigation" element={<ShowcaseInvestigationPage />} />
        {Object.entries(plannedRoutes).map(([path, route]) => (
          <Route key={path} path={path} element={<PlannedPage route={route} />} />
        ))}
        <Route path="*" element={<MissingPage />} />
      </Route>
    </Routes>
  )
}

export default function ProductApp() {
  return (
    <BrowserRouter>
      {/* One demo session for every route: the Overview's scenario control and the
          Payments pages' control are the same state, so they cannot disagree. */}
      <DemoSessionProvider>
        <ProductRoutes />
      </DemoSessionProvider>
    </BrowserRouter>
  )
}
