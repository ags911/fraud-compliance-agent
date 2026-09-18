import { useState } from "react"

import {
  PaymentsButton,
  PaymentsDateRange,
  PaymentsKpiStrip,
  PaymentsPageHeading,
  PaymentsPageMain,
  PaymentsPagination,
  PaymentsPanel,
  PaymentsRangeToggle,
  PaymentsStatePanel,
  PaymentsStatusPill,
  PaymentsSubnav,
  PaymentsTablePanel,
  type PaymentsStatus,
} from "@/components/payments-ui"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const colors = [
  ["Background", "--payments-color-background", "#ffffff"],
  ["Foreground", "--payments-color-foreground", "#0a2540"],
  ["Muted surface", "--payments-color-muted-background", "#f6f8fa"],
  ["Muted text", "--payments-color-muted-foreground", "#5f708a"],
  ["Border", "--payments-color-border", "#e3e8ee"],
  ["Primary", "--payments-color-primary", "#635bff"],
  ["Success", "--payments-color-success", "#10b981"],
  ["Warning", "--payments-color-warning", "#eab308"],
  ["Danger", "--payments-color-danger", "#b8392d"],
] as const

const statuses: PaymentsStatus[] = [
  "succeeded",
  "disputed",
  "failed",
  "pending",
  "blocked",
  "refunded",
  "fraudWarning",
]

const kpis = [
  { label: "Matching payments", value: "3,424" },
  { label: "Success rate", value: "93.5%" },
  { label: "Failed & blocked", value: "6.8%" },
  { label: "Early warnings", value: "18" },
] as const

const tabs = ["Overview", "Performance", "Lists", "Activity"] as const

export default function PaymentsDesignSystem() {
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]>("Performance")
  const [range, setRange] = useState<7 | 30 | 90>(30)

  return (
    <div className="payments-ui payments-catalog">
      <PaymentsPageMain>
        <PaymentsPageHeading
          title="Payments design system"
          description="Approved tokens, typography and reusable dashboard contracts."
          actions={
            <>
              <PaymentsButton>Secondary action</PaymentsButton>
              <PaymentsButton emphasis="primary">Primary action</PaymentsButton>
            </>
          }
        />

        <PaymentsSubnav
          label="Design system sections"
          items={tabs}
          value={activeTab}
          onChange={setActiveTab}
        />

        <section className="payments-catalog__section" aria-labelledby="colors-title">
          <div className="payments-catalog__heading">
            <h2 id="colors-title">Semantic colour tokens</h2>
            <p>Status colours communicate meaning; chart colours identify datasets.</p>
          </div>
          <div className="payments-catalog__swatches">
            {colors.map(([label, token, value]) => (
              <article className="payments-catalog__swatch" key={token}>
                <span style={{ background: `var(${token})` }} aria-hidden="true" />
                <strong>{label}</strong>
                <code>{token}</code>
                <small>{value}</small>
              </article>
            ))}
          </div>
        </section>

        <section className="payments-catalog__section" aria-labelledby="type-title">
          <div className="payments-catalog__heading">
            <h2 id="type-title">Typography contracts</h2>
            <p>Satoshi for UI, Inter for numbers and dates, monospace for identifiers. Weights: 400, 500, 600 and 700.</p>
          </div>
          <div className="payments-catalog__type-grid">
            <div><span>Page title</span><strong className="payments-type-page-title">Rules performance</strong></div>
            <div><span>Body</span><strong className="payments-type-body">Monitor payment outcomes and rule behaviour.</strong></div>
            <div><span>Panel title</span><strong className="payments-type-panel-title">Payment outcomes</strong></div>
            <div><span>Data value</span><strong className="payments-type-data-value">£3,424.00</strong></div>
            <div><span>Table data</span><strong className="payments-type-table-data">Today, 09:54</strong></div>
            <div><span>Control · 13px / 600</span><strong className="payments-type-control">Create rule</strong></div>
            <div><span>Identifier · 12px / 400</span><strong className="payments-type-identifier">cus_JF019FNas284NF</strong></div>
            <div><span>Status · 11px / 700</span><strong className="payments-type-status">Succeeded</strong></div>
            <div><span>Micro data</span><strong className="payments-type-micro-data">1–4 of 3,424 payments</strong></div>
          </div>
        </section>

        <section className="payments-catalog__section" aria-labelledby="controls-title">
          <div className="payments-catalog__heading"><h2 id="controls-title">Controls and states</h2></div>
          <div className="payments-catalog__controls">
            <PaymentsButton>Default</PaymentsButton>
            <PaymentsButton emphasis="primary">Primary</PaymentsButton>
            <PaymentsButton disabled>Disabled</PaymentsButton>
            <PaymentsDateRange>1–23 Sep 2026</PaymentsDateRange>
            <PaymentsRangeToggle label="Reporting period" options={[7, 30, 90]} value={range} onChange={setRange} />
          </div>
          <div className="payments-catalog__statuses">
            {statuses.map((status) => <PaymentsStatusPill key={status} status={status} />)}
          </div>
        </section>

        <PaymentsKpiStrip items={kpis} ariaLabel="KPI strip example" />

        <PaymentsPanel
          title="Panel contract"
          description="Shared header, border, radius and content spacing."
          labelledBy="panel-contract-title"
          action={<PaymentsRangeToggle label="Panel range" options={[7, 30, 90]} value={range} onChange={setRange} />}
        >
          <div className="payments-catalog__panel-placeholder">Panel content</div>
        </PaymentsPanel>

        <PaymentsTablePanel
          footer={<><span>1–2 of 3,424 payments</span><PaymentsPagination previousDisabled /></>}
        >
          <Table aria-label="Payments table example">
            <TableHeader><TableRow><TableHead>AMOUNT</TableHead><TableHead>STATUS</TableHead><TableHead>CUSTOMER</TableHead><TableHead>DATE</TableHead></TableRow></TableHeader>
            <TableBody>
              <TableRow><TableCell><strong>£141.00 GBP</strong></TableCell><TableCell><PaymentsStatusPill status="disputed" /></TableCell><TableCell className="payments-type-identifier">cus_JF019FNas284NF</TableCell><TableCell>Today, 09:54</TableCell></TableRow>
              <TableRow><TableCell><strong>£84.20 GBP</strong></TableCell><TableCell><PaymentsStatusPill status="succeeded" /></TableCell><TableCell className="payments-type-identifier">cus_NAQk8Q825nadfh</TableCell><TableCell>Today, 09:41</TableCell></TableRow>
            </TableBody>
          </Table>
        </PaymentsTablePanel>

        <section className="payments-catalog__state-grid" aria-label="Page states">
          <PaymentsStatePanel title="No matching payments" description="Try widening the date range." />
          <PaymentsStatePanel tone="danger" title="Payments could not be loaded" description="Retry the request or return later." />
        </section>
      </PaymentsPageMain>
    </div>
  )
}
