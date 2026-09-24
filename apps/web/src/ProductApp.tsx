import { BrowserRouter, Link, Outlet, Route, Routes } from "react-router-dom"

import { CaseDetailPage } from "@/CaseDetail"
import Dashboard from "@/Dashboard"
import { ModelBenchmarkPage } from "@/ModelBenchmark"
import { NewTransactionPage } from "@/NewTransaction"
import RadarPage from "@/Radar"
import { ShowcaseInvestigationPage } from "@/ShowcaseInvestigation"
import SimulationPage from "@/Simulation"
import { DemoSessionProvider } from "@/components/demo-session"
import {
  PaymentsAppShell,
  PaymentsPageHeading,
  PaymentsPageMain,
  PaymentsTopBar,
} from "@/components/payments-ui"
import { SectionTabs } from "@/components/section-tabs"

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

function PlannedPage({ route }: { route: ProductRoute }) {
  return (
    <>
      <PaymentsTopBar demoSession={false} showSidebarTrigger={false} />
      <PaymentsPageMain>
        <PaymentsPageHeading title={route.title} description={route.description} />
        <SectionTabs />
        <section className="mt-6 rounded-xl border border-border bg-card px-6 py-8 text-center">
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
      <PaymentsTopBar demoSession={false} showSidebarTrigger={false} />
      <PaymentsPageMain>
        <PaymentsPageHeading title="Page not found" description="The page you requested is not part of this dashboard." />
        <SectionTabs />
        <section className="mt-6 rounded-xl border border-border bg-card px-6 py-8 text-center">
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
 * It used to carry its own left sidebar (AppSidebar); the console has since
 * standardised on the Overview dashboard's navigation — a top bar with the
 * Averlynx brand plus the same section tabs, no left rail — so every page
 * under this shell renders that instead.
 */
function PaymentsShellLayout() {
  return (
    <PaymentsAppShell>
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
      {/* Brings its own chrome (dark, standalone top nav), like the Overview
          dashboard, rather than the shared Payments shell. Client-side
          simulated demo only; see src/lib/simulation-data.ts. */}
      <Route path="/simulation" element={<SimulationPage />} />
      {/* Embeds references/radar-reference.html, an exact unmodified copy of
          the RADAR-AGENT Overview mockup artifact, via an iframe — see
          src/Radar.tsx. Not adapted to this app's design system; a starting
          point for further iteration. */}
      <Route path="/radar" element={<RadarPage />} />
      <Route element={<PaymentsShellLayout />}>
        <Route path="/insights" element={<ModelBenchmarkPage />} />
        <Route path="/transactions/new" element={<NewTransactionPage />} />
        {/* The SDK-free showcase investigation is its own surface. The legacy
            A-F workspace above stays until an explicit cutover decision. */}
        <Route path="/transactions/investigation" element={<ShowcaseInvestigationPage />} />
        {/* One durable showcase case (spec 0002). React Router ranks the static
            /transactions/new and /transactions/investigation routes above this
            dynamic one, so they keep their pages. */}
        <Route path="/transactions/:caseId" element={<CaseDetailPage />} />
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
