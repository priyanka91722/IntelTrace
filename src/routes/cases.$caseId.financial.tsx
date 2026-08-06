import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { transactions, riskColor, riskFromScore } from "@/lib/mock-data";

export const Route = createFileRoute("/cases/$caseId/financial")({ component: Financial });

function Financial() {
  const { caseId } = Route.useParams();
  const rows = transactions.filter((t) => t.caseId === caseId).sort((a, b) => b.riskScore - a.riskScore);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold">Financial Anomaly</h2>
        <p className="text-sm text-muted-foreground">Transactions linked to this case, scored 0–100 using simple rules (amount, timing, receiver).</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Transactions</CardTitle>
          <CardDescription>{rows.length} record(s) for {caseId}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">No transactions added for this case.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Txn ID</TableHead>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Sender</TableHead>
                  <TableHead>Receiver</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Flags</TableHead>
                  <TableHead>Risk</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((t) => {
                  const level = riskFromScore(t.riskScore);
                  return (
                    <TableRow key={t.id}>
                      <TableCell className="font-mono text-xs">{t.id}</TableCell>
                      <TableCell className="text-muted-foreground">{t.timestamp}</TableCell>
                      <TableCell className="font-medium">₹{t.amount.toLocaleString("en-IN")}</TableCell>
                      <TableCell>{t.sender}</TableCell>
                      <TableCell>{t.receiver}</TableCell>
                      <TableCell><Badge variant="outline">{t.type}</Badge></TableCell>
                      <TableCell><div className="flex flex-wrap gap-1">{t.flags.map((f) => <Badge key={f} variant="outline" className="text-[10px]">{f}</Badge>)}</div></TableCell>
                      <TableCell><Badge variant="outline" className={riskColor(level)}>{t.riskScore} · {level}</Badge></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
