import { CheckCircle2, ShieldAlert, XCircle } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { SimulatedTransaction } from "@/lib/simulation-data"

/**
 * Presentational only: renders one escalated transaction's mock audit trail.
 * Everything on this drawer is simulated — the reasoning text, the policy
 * codes, and the compliance hash are generated client-side and do not come
 * from a real LLM call, a real policy engine, or a real FCA log.
 */
export function AuditDrawer({
  transaction,
  open,
  onOpenChange,
  onApprove,
  onBlock,
}: {
  transaction: SimulatedTransaction | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onApprove: (id: string) => void
  onBlock: (id: string) => void
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-lg" side="right">
        {transaction ? (
          <>
            <SheetHeader className="border-b">
              <SheetTitle className="font-mono text-sm">{transaction.id}</SheetTitle>
              <SheetDescription>LLM Escalation Audit Trail — simulated, demo only</SheetDescription>
            </SheetHeader>

            <Tabs defaultValue="reasoning" className="flex-1 gap-0 px-4 py-3">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="reasoning">LLM Reasoning</TabsTrigger>
                <TabsTrigger value="payload">Payload &amp; Features</TabsTrigger>
                <TabsTrigger value="log">Statutory Log</TabsTrigger>
              </TabsList>

              <TabsContent value="reasoning" className="mt-4 flex flex-col gap-4">
                <div className="rounded-lg border bg-muted/40 p-3">
                  <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <ShieldAlert className="size-3.5" aria-hidden="true" />
                    Agent evaluation summary
                  </p>
                  <p className="text-sm">{transaction.llmReasoning || "This transaction was not escalated to the LLM agent."}</p>
                </div>

                <div>
                  <p className="mb-2 text-xs font-medium text-muted-foreground">Triggered policy violations</p>
                  <div className="flex flex-wrap gap-1.5">
                    {transaction.policyViolations.length === 0 ? (
                      <span className="text-sm text-muted-foreground">None recorded.</span>
                    ) : (
                      transaction.policyViolations.map((code) => (
                        <Badge key={code} variant="destructive" className="font-mono text-[11px]">
                          {code}
                        </Badge>
                      ))
                    )}
                  </div>
                </div>

                <div className="mt-2 flex gap-2 border-t pt-4">
                  <Button className="flex-1" variant="outline" onClick={() => onApprove(transaction.id)}>
                    <CheckCircle2 aria-hidden="true" />
                    Approve transaction
                  </Button>
                  <Button className="flex-1" variant="destructive" onClick={() => onBlock(transaction.id)}>
                    <XCircle aria-hidden="true" />
                    Confirm block
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Simulated human override — no real transaction, account, or payment is affected.
                </p>
              </TabsContent>

              <TabsContent value="payload" className="mt-4 flex flex-col gap-3">
                <div>
                  <p className="mb-1.5 text-xs font-medium text-muted-foreground">Sparkov baseline attributes (synthetic)</p>
                  <pre className="overflow-x-auto rounded-lg border bg-muted/40 p-3 font-mono text-xs">
                    {JSON.stringify(transaction.payload.sparkovBaseline, null, 2)}
                  </pre>
                </div>
                <div>
                  <p className="mb-1.5 text-xs font-medium text-muted-foreground">Plaid-derived enriched fields (sandbox fixture)</p>
                  <pre className="overflow-x-auto rounded-lg border bg-muted/40 p-3 font-mono text-xs">
                    {JSON.stringify(transaction.payload.plaidEnriched, null, 2)}
                  </pre>
                </div>
              </TabsContent>

              <TabsContent value="log" className="mt-4 flex flex-col gap-3">
                <div className="rounded-lg border bg-muted/40 p-3">
                  <p className="text-xs font-medium text-muted-foreground">Verification hash (simulated)</p>
                  <p className="mt-1 font-mono text-xs break-all">{transaction.auditHash}</p>
                </div>
                <div className="rounded-lg border bg-muted/40 p-3">
                  <p className="text-xs font-medium text-muted-foreground">Recorded at</p>
                  <p className="mt-1 font-mono text-xs">{transaction.auditTimestamp}</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  This hash and timestamp are generated in the browser for this demo. They are not an FCA compliance
                  record and confirm nothing about a real regulatory filing.
                </p>
              </TabsContent>
            </Tabs>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
