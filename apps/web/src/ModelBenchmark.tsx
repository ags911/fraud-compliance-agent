import { useEffect, useState } from "react"
import { ChevronDown, ShieldCheck } from "lucide-react"
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"

import {
  PaymentsKpiStrip,
  PaymentsPageHeading,
  PaymentsPageMain,
  PaymentsPanel,
  PaymentsStatePanel,
  PaymentsTonePill,
  PaymentsTopBar,
} from "@/components/payments-ui"
import { SectionTabs } from "@/components/section-tabs"
import { Slider } from "@/components/ui/slider"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  fetchDemoModelSummary,
  type DemoModelSummary,
} from "@/lib/demo-model-summary"

function metric(value: number): string {
  return value.toFixed(4)
}

function percentage(value: number): string {
  return `${(value * 100).toFixed(3)}%`
}

const comparisonChartConfig = {
  prAuc: { label: "PR-AUC", color: "var(--chart-1)" },
  rocAuc: { label: "ROC-AUC", color: "var(--chart-3)" },
} satisfies ChartConfig

const thresholdChartConfig = {
  recall: { label: "Recall", color: "var(--chart-3)" },
  falsePositiveRate: { label: "False-positive rate", color: "var(--chart-5)" },
} satisfies ChartConfig

const sliceChartConfig = {
  prAuc: { label: "PR-AUC", color: "var(--chart-1)" },
} satisfies ChartConfig

export function ModelBenchmarkPage() {
  const [summary, setSummary] = useState<DemoModelSummary | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    fetchDemoModelSummary()
      .then((response) => {
        if (active) setSummary(response)
      })
      .catch(() => {
        if (active) setError("Benchmark evidence is unavailable. Start the local demo API to inspect the recorded evaluation.")
      })
    return () => {
      active = false
    }
  }, [])

  return (
    <>
      <PaymentsTopBar demoSession={false} searchPlaceholder="Search is unavailable on this read-only benchmark view" showSidebarTrigger={false} />
      <PaymentsPageMain>
        <PaymentsPageHeading
          title="Benchmark insights"
          description="A reproducible Sparkov demonstration of the data, feature, evaluation, and audit workflow—not a live fraud model."
        />
        <SectionTabs />
        {error ? <PaymentsStatePanel title="Benchmark evidence unavailable" description={error} tone="danger" className="mt-6" /> : null}
        {!summary && !error ? <PaymentsStatePanel title="Loading benchmark evidence" description="Reading the sanitised local evaluation report." className="mt-6" /> : null}
        {summary ? <div className="mt-6"><BenchmarkEvidence summary={summary} /></div> : null}
      </PaymentsPageMain>
    </>
  )
}

function BenchmarkEvidence({ summary }: { summary: DemoModelSummary }) {
  const xgboost = summary.model_results.find((model) => model.model_id === "xgboost_candidate")
  const [selectedThresholdIndex, setSelectedThresholdIndex] = useState(0)
  const comparisonData = summary.model_results.map((model) => ({
    model: model.label.replace(" candidate", "").replace(" baseline", ""),
    prAuc: Number((model.pr_auc * 100).toFixed(2)),
    rocAuc: Number((model.roc_auc * 100).toFixed(2)),
  }))
  const thresholdData = (xgboost?.threshold_sweep ?? []).map((point) => ({
    threshold: point.threshold.toFixed(2),
    recall: Number((point.recall * 100).toFixed(2)),
    falsePositiveRate: Number((point.false_positive_rate * 100).toFixed(2)),
  }))
  const amountBandData = (xgboost?.slice_metrics ?? [])
    .filter((metric) => metric.slice === "amount_band")
    .map((metric) => ({
      cohort: metric.value.replaceAll("_", " ").replace("up to", "≤").replace("over", ">"),
      prAuc: Number((metric.pr_auc * 100).toFixed(2)),
    }))
  const selectedThreshold = xgboost?.threshold_sweep[selectedThresholdIndex] ?? null

  return (
    <div className="grid gap-4">
      <section className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-border bg-card px-5 py-4" aria-label="Benchmark status">
        <div className="grid gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <PaymentsTonePill tone="neutral">Synthetic benchmark</PaymentsTonePill>
            <strong className="payments-type-section-title">Research evidence only</strong>
          </div>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Checksum-pinned evaluation of simulated data. It cannot score a transaction, select a runtime threshold, or authorise a payment.
          </p>
        </div>
        <span className="payments-type-support whitespace-nowrap text-muted-foreground">Read-only</span>
      </section>
      <PaymentsKpiStrip
        ariaLabel="Synthetic benchmark evaluation summary"
        items={[
          { label: "Training rows", value: summary.partition_counts.train.toLocaleString() },
          { label: "Held-out test rows", value: summary.partition_counts.test.toLocaleString() },
          { label: "Test prevalence", value: percentage(summary.test_prevalence) },
          { label: "Best PR-AUC", value: xgboost ? metric(xgboost.pr_auc) : "Unavailable" },
        ]}
      />
      <div className="grid gap-4 xl:grid-cols-2">
        <PaymentsPanel
          title="Model comparison"
          description="Held-out PR-AUC and ROC-AUC. Higher is better; values are percentages for readability."
        >
          <ChartContainer config={comparisonChartConfig} className="payments-chart-compact w-full aspect-auto">
            <BarChart accessibilityLayer data={comparisonData} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="model" axisLine={false} tickLine={false} tickMargin={8} />
              <YAxis axisLine={false} tickLine={false} tickFormatter={(value) => `${value}%`} width={44} />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    className="min-w-40 gap-2 px-3 py-2"
                    labelFormatter={(_, payload) => String(payload[0]?.payload?.model ?? "")}
                  />
                }
                cursor={false}
                isAnimationActive={false}
                shared={false}
              />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar dataKey="prAuc" fill="var(--color-prAuc)" radius={[3, 3, 0, 0]} />
              <Bar dataKey="rocAuc" fill="var(--color-rocAuc)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </PaymentsPanel>
        <PaymentsPanel
          title="Threshold trade-off"
          description="Held-out recall and false positives. No threshold is selected for payment action."
        >
          {thresholdData.length ? (
            <ChartContainer config={thresholdChartConfig} className="payments-chart-compact w-full aspect-auto">
              <LineChart accessibilityLayer data={thresholdData} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="threshold" axisLine={false} tickLine={false} tickMargin={8} label={{ value: "Recorded score threshold", position: "insideBottom", offset: -2 }} />
                <YAxis axisLine={false} tickLine={false} tickFormatter={(value) => `${value}%`} width={44} />
                <ChartTooltip content={<ChartTooltipContent className="min-w-40 gap-2 px-3 py-2" labelKey="threshold" />} cursor={false} isAnimationActive={false} />
                <ChartLegend content={<ChartLegendContent />} />
                <Line dataKey="recall" stroke="var(--color-recall)" strokeWidth={2} dot={false} type="monotone" />
                <Line dataKey="falsePositiveRate" stroke="var(--color-falsePositiveRate)" strokeWidth={2} dot={false} type="monotone" />
              </LineChart>
            </ChartContainer>
          ) : <p className="payments-chart-compact flex items-center justify-center text-sm text-muted-foreground">Recorded threshold sweep unavailable for this report version.</p>}
        </PaymentsPanel>
      </div>
      {selectedThreshold && xgboost ? (
        <PaymentsPanel
          title="Explore recorded operating points"
          description="Read-only evaluation evidence. Moving this control changes the displayed recorded point only; it does not configure policy or a payment decision."
        >
          <div className="grid gap-5">
            <Slider
              aria-label="Recorded evaluation operating point"
              min={0}
              max={xgboost.threshold_sweep.length - 1}
              step={1}
              value={[selectedThresholdIndex]}
              onValueChange={([index]) => setSelectedThresholdIndex(index ?? 0)}
            />
            <dl className="grid gap-3 sm:grid-cols-4 payments-data">
              <MetricPoint label="Recorded score threshold" value={selectedThreshold.threshold.toFixed(2)} />
              <MetricPoint label="Precision" value={percentage(selectedThreshold.precision)} />
              <MetricPoint label="Recall" value={percentage(selectedThreshold.recall)} />
              <MetricPoint label="Block rate" value={percentage(selectedThreshold.block_rate)} />
            </dl>
          </div>
        </PaymentsPanel>
      ) : null}
      <details className="group rounded-xl border border-border bg-card">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 [&::-webkit-details-marker]:hidden">
          <span><strong className="payments-type-section-title">Explore cohort diagnostics</strong><span className="mt-1 block text-sm text-muted-foreground">Amount-band variation in the simulated held-out evaluation.</span></span>
          <ChevronDown className="shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" size={18} />
        </summary>
        <div className="border-t border-border px-5 py-4">
          <ChartContainer config={sliceChartConfig} className="payments-chart-compact w-full aspect-auto">
            <BarChart accessibilityLayer data={amountBandData} layout="vertical" margin={{ top: 12, right: 16, left: 20, bottom: 0 }}>
              <CartesianGrid horizontal={false} />
              <XAxis type="number" axisLine={false} tickLine={false} tickFormatter={(value) => `${value}%`} />
              <YAxis dataKey="cohort" type="category" axisLine={false} tickLine={false} width={92} />
              <ChartTooltip content={<ChartTooltipContent className="min-w-40 gap-2 px-3 py-2" />} cursor={false} isAnimationActive={false} />
              <Bar dataKey="prAuc" fill="var(--color-prAuc)" radius={[0, 3, 3, 0]} />
            </BarChart>
          </ChartContainer>
          <p className="mt-3 text-sm text-muted-foreground">This indicates variation in a simulated benchmark only; it is not a fairness or production-performance claim.</p>
        </div>
      </details>
      <details className="group rounded-xl border border-border bg-card">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 [&::-webkit-details-marker]:hidden">
          <span><strong className="payments-type-section-title">Method, boundary and reproducibility</strong><span className="mt-1 block text-sm text-muted-foreground">Features, release limitations, and checksums for a technical review.</span></span>
          <ChevronDown className="shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" size={18} />
        </summary>
        <div className="grid gap-5 border-t border-border px-5 py-4 xl:grid-cols-2">
          <div className="grid gap-3 text-sm text-muted-foreground">
            <p><strong className="text-foreground">Data source</strong><br />{summary.data_source}</p>
            <p><strong className="text-foreground">Features</strong><br />{summary.feature_columns.join(", ")}</p>
            <ul className="grid gap-2">
              {summary.release_boundary.map((boundary) => (
                <li className="flex gap-2" key={boundary}><ShieldCheck className="mt-0.5 shrink-0 text-primary" aria-hidden="true" size={16} strokeWidth={1.6} /><span>{boundary}</span></li>
              ))}
            </ul>
          </div>
          <dl className="grid content-start gap-3 payments-type-data tabular-nums">
            <div><dt className="text-muted-foreground">Dataset SHA-256</dt><dd className="break-all">{summary.dataset_sha256}</dd></div>
            <div><dt className="text-muted-foreground">Evaluation report SHA-256</dt><dd className="break-all">{summary.report_sha256}</dd></div>
          </dl>
        </div>
      </details>
    </div>
  )
}

function MetricPoint({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted px-3 py-2.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-base font-semibold text-foreground">{value}</dd>
    </div>
  )
}
