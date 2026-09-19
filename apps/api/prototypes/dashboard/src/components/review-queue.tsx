import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

const cases = [
  { id: "TXN-48291", amount: "£7,800.00", score: "0.94", reason: "Authority denied", age: "4m", hold: true },
  { id: "TXN-48277", amount: "£2,430.00", score: "0.72", reason: "APP concern", age: "11m" },
  { id: "TXN-48263", amount: "£980.00", score: "0.67", reason: "New payee", age: "18m" },
  { id: "TXN-48240", amount: "£4,200.00", score: "0.81", reason: "Pre-execution approval", age: "38m", hold: true },
]

export function ReviewQueue() {
  return <Card>
    <CardHeader><div className="flex items-start justify-between gap-3"><div><CardTitle>Requires attention</CardTitle><CardDescription>Ordered by urgency and value</CardDescription></div><Badge variant="secondary">7 open</Badge></div></CardHeader>
    <CardContent>{cases.map((item,index) => <div key={item.id}>{index > 0 && <Separator />}<button className="w-full py-3 text-left"><div className="flex items-center justify-between gap-3"><span className="font-medium tabular-nums">{item.amount}</span><Badge variant={item.hold ? "destructive" : "outline"}>{item.hold ? "HOLD" : "REVIEW"} · {item.score}</Badge></div><div className="mt-1 flex justify-between gap-3 text-xs text-muted-foreground"><span>{item.id} · {item.reason}</span><span>{item.age}</span></div></button></div>)}</CardContent>
    <CardFooter><Button className="w-full" variant="outline">Open review queue</Button></CardFooter>
  </Card>
}
