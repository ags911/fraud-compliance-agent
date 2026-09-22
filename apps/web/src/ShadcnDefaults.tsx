import { useState, type FormEvent } from "react"

import { RulesPerformanceChart } from "@/components/rules-performance-chart"
import {
  MetricCard,
  PaymentMethodChip,
  RuleToken,
  Section,
  StatusBadge,
  type PaymentStatus,
} from "@/components/payments"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Slider } from "@/components/ui/slider"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"

const colorTokens = [
  ["Primary", "var(--primary)"],
  ["Foreground", "var(--foreground)"],
  ["Muted", "var(--muted)"],
  ["Border", "var(--border)"],
  ["Successful", "var(--chart-successful)"],
  ["Blocked", "var(--chart-blocked)"],
  ["Refunded", "var(--chart-refunded)"],
  ["Disputed", "var(--chart-disputed)"],
  ["Fraud warning", "var(--chart-fraud-warning)"],
] as const

const metrics = [
  {
    label: "Payment success rate",
    value: "93.50%",
    delta: "+2.45%",
    favorable: true,
  },
  {
    label: "Accepted payments",
    value: "140.5K",
    delta: "−0.34%",
    favorable: false,
  },
  {
    label: "Accepted volume",
    value: "£11.6M",
    delta: "+1.56%",
    favorable: true,
  },
] as const

const rulesPerformanceData = [
  { date: "1 Sep", successful: 37, blocked: 8, refunded: 3, disputed: 2, fraudWarning: 1 },
  { date: "3 Sep", successful: 43, blocked: 9, refunded: 4, disputed: 1, fraudWarning: 2 },
  { date: "5 Sep", successful: 35, blocked: 7, refunded: 2, disputed: 3, fraudWarning: 1 },
  { date: "7 Sep", successful: 51, blocked: 10, refunded: 5, disputed: 2, fraudWarning: 2 },
  { date: "9 Sep", successful: 46, blocked: 11, refunded: 3, disputed: 1, fraudWarning: 2 },
  { date: "11 Sep", successful: 55, blocked: 9, refunded: 4, disputed: 3, fraudWarning: 1 },
  { date: "13 Sep", successful: 48, blocked: 12, refunded: 3, disputed: 2, fraudWarning: 2 },
  { date: "15 Sep", successful: 58, blocked: 10, refunded: 5, disputed: 1, fraudWarning: 1 },
  { date: "17 Sep", successful: 52, blocked: 11, refunded: 4, disputed: 2, fraudWarning: 3 },
  { date: "19 Sep", successful: 61, blocked: 9, refunded: 3, disputed: 2, fraudWarning: 1 },
  { date: "21 Sep", successful: 54, blocked: 12, refunded: 5, disputed: 3, fraudWarning: 2 },
  { date: "23 Sep", successful: 59, blocked: 10, refunded: 4, disputed: 2, fraudWarning: 2 },
]

const payments: Array<{
  amount: string
  status: PaymentStatus
  customer: string
}> = [
  { amount: "£141.00 GBP", status: "disputed", customer: "cus_example_001" },
  { amount: "£14.00 GBP", status: "succeeded", customer: "cus_example_002" },
  { amount: "£12.00 GBP", status: "fraudWarning", customer: "cus_example_003" },
  { amount: "£11.00 GBP", status: "pending", customer: "cus_example_004" },
]

export default function ShadcnDefaults() {
  const [allocation, setAllocation] = useState(50)
  const [selectedMetric, setSelectedMetric] = useState(0)
  const [rule, setRule] = useState("")
  const [feedback, setFeedback] = useState("")
  const [invalid, setInvalid] = useState(false)

  function handleRuleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const hasRule = rule.trim().length > 0
    setInvalid(!hasRule)
    setFeedback(
      hasRule
        ? "Expression entered. This reference does not execute rules."
        : "Enter a rule expression."
    )
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-8">
      <header className="space-y-3 pb-8">
        <Badge variant="secondary">Payments design system</Badge>
        <h1 className="text-3xl font-semibold tracking-tight">
          Payments foundations and patterns
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          Radix Nova primitives, Geist typography, accessible data
          visualization, and the Payments semantic color system.
        </p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <a
            className="inline-flex text-primary underline underline-offset-4"
            href="/"
          >
            Return to the fraud compliance console
          </a>
          <a
            className="inline-flex text-primary underline underline-offset-4"
            href="/references/rules-performance.html"
          >
            View the Rules performance page built on this system
          </a>
        </div>
      </header>

      <Separator />

      <Section
        title="Color"
        description="Product colors are exposed through semantic tokens so meaning is consistent across charts, statuses, and interaction states."
      >
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-9">
          {colorTokens.map(([name, color]) => (
            <div key={name} className="space-y-2">
              <div
                className="h-14 rounded-lg border"
                style={{ background: color }}
              />
              <p className="text-xs text-muted-foreground">{name}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Actions and status"
        description="Generated primitive geometry is preserved; domain variants change semantic color only."
      >
        <Card>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Button>Primary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="ghost">Ghost</Button>
              <Button disabled>Disabled</Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <StatusBadge status="succeeded" />
              <StatusBadge status="blocked" />
              <StatusBadge status="refunded" />
              <StatusBadge status="disputed" />
              <StatusBadge status="fraudWarning" />
              <StatusBadge status="failed" />
              <PaymentMethodChip>Cards</PaymentMethodChip>
              <RuleToken>:amount_in_usd:</RuleToken>
            </div>
          </CardContent>
        </Card>
      </Section>

      <Section
        title="Data visualization"
        description="An original Rules Performance composition inspired by the reference hierarchy, with responsive rendering and an inspectable data table."
      >
        <RulesPerformanceChart
          data={rulesPerformanceData}
          matchingPayments={3424}
        />
      </Section>

      <Section
        title="Product patterns"
        description="Interactive examples composed from the same primitives and semantic tokens."
      >
        <Tabs defaultValue="metrics">
          <TabsList aria-label="Product pattern examples">
            <TabsTrigger value="metrics">Metrics</TabsTrigger>
            <TabsTrigger value="experiment">Experiment</TabsTrigger>
            <TabsTrigger value="rules">Rule editor</TabsTrigger>
          </TabsList>

          <TabsContent value="metrics">
            <div className="grid gap-4 pt-4 sm:grid-cols-3">
              {metrics.map((metric, index) => (
                <MetricCard
                  key={metric.label}
                  {...metric}
                  selected={selectedMetric === index}
                  onSelect={() => setSelectedMetric(index)}
                />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="experiment">
            <div className="pt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Review your experiment</CardTitle>
                  <CardDescription>
                    Adjust the illustrative session split.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div className="flex justify-between gap-4">
                      <Label id="default-allocation">
                        Allocate session traffic
                      </Label>
                      <output aria-live="polite">{allocation}%</output>
                    </div>
                    <Slider
                      aria-labelledby="default-allocation"
                      min={1}
                      max={99}
                      value={[allocation]}
                      onValueChange={(value) =>
                        setAllocation(value[0] ?? allocation)
                      }
                    />
                    <Separator />
                    {["Treatment", "Control"].map((group, index) => (
                      <div key={group} className="space-y-3">
                        <p>
                          {group} ·{" "}
                          {index === 0 ? allocation : 100 - allocation}% of
                          sessions
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {(index === 0
                            ? [
                                "Apple Pay",
                                "Cards",
                                "Cash App Pay",
                                "Google Pay",
                              ]
                            : ["Apple Pay", "Cards", "Google Pay"]
                          ).map((method) => (
                            <PaymentMethodChip key={method}>
                              {method}
                            </PaymentMethodChip>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
                <CardFooter>
                  <p className="text-sm text-muted-foreground">
                    Demo only; no experiment is launched.
                  </p>
                </CardFooter>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="rules">
            <form className="pt-4" onSubmit={handleRuleSubmit} noValidate>
              <Card>
                <CardHeader>
                  <CardTitle>Add a blocking rule</CardTitle>
                  <CardDescription>
                    Default input, label, badge, button, and card behavior.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <Label htmlFor="default-rule">Rule expression</Label>
                    <Input
                      id="default-rule"
                      placeholder="Block if :amount_in_usd: > 1000"
                      value={rule}
                      onChange={(event) => {
                        setRule(event.target.value)
                        if (invalid) setInvalid(false)
                      }}
                      aria-invalid={invalid}
                      aria-describedby="default-feedback"
                    />
                    <p className="flex flex-wrap items-center gap-2">
                      Block if <RuleToken>:card_funding:</RuleToken> =
                      &apos;prepaid&apos;
                    </p>
                    <p
                      id="default-feedback"
                      aria-live="polite"
                      className={
                        invalid
                          ? "min-h-5 text-destructive"
                          : "min-h-5 text-muted-foreground"
                      }
                    >
                      {feedback}
                    </p>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button type="submit">Test rule</Button>
                </CardFooter>
              </Card>
            </form>
          </TabsContent>
        </Tabs>
      </Section>

      <Section
        title="Payments table"
        description="Status meaning is communicated with text as well as color."
      >
        <Card>
          <CardHeader>
            <CardTitle>Recent payments</CardTitle>
            <CardDescription>
              Illustrative records using the generated Table primitive.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Customer</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => (
                  <TableRow key={payment.customer}>
                    <TableCell>{payment.amount}</TableCell>
                    <TableCell>
                      <StatusBadge status={payment.status} />
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {payment.customer}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </Section>

      <footer className="pt-8 text-sm text-muted-foreground">
        Independent theme entry · Existing console preserved · Light theme
      </footer>
    </main>
  )
}
