import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { evidence, transactions, logs, custody, type Evidence } from "@/lib/mock-data";
import { Upload, FileText, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/cases/$caseId/")({
  component: CaseOverview,
});

function CaseOverview() {
  const { caseId } = Route.useParams();
  const items = evidence.filter((e) => e.caseId === caseId);
  const txns = transactions.filter((t) => t.caseId === caseId);
  const evts = logs.filter((l) => l.caseId === caseId);
  const trail = custody.filter((c) => c.caseId === caseId);

  return (
    <div className="space-y-5">
      <div className="flex gap-2 flex-wrap">
        <Button variant="outline" asChild><Link to="/cases/$caseId/evidence" params={{ caseId }}><Upload className="mr-1 h-4 w-4" /> Add Evidence</Link></Button>
        <Button asChild><Link to="/cases/$caseId/report" params={{ caseId }}><FileText className="mr-1 h-4 w-4" /> Report</Link></Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Evidence items</div><div className="text-2xl font-semibold mt-1">{items.length}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Transactions</div><div className="text-2xl font-semibold mt-1">{txns.length}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Log events</div><div className="text-2xl font-semibold mt-1">{evts.length}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Integrity</div><div className="mt-2 flex items-center gap-2 text-sm"><ShieldCheck className="h-4 w-4 text-[color:var(--risk-low)]" /> {items.filter((i: Evidence) => i.verified).length}/{items.length} verified</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Evidence in this case</CardTitle>
          <CardDescription>Items uploaded so far</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>File</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Uploader</TableHead>
                <TableHead>Uploaded</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-mono text-xs">{e.id}</TableCell>
                  <TableCell className="font-medium">{e.name}</TableCell>
                  <TableCell><Badge variant="outline">{e.type}</Badge></TableCell>
                  <TableCell className="text-muted-foreground">{e.uploader}</TableCell>
                  <TableCell className="text-muted-foreground">{e.uploadedAt}</TableCell>
                  <TableCell>
                    {e.verified
                      ? <Badge variant="outline" className="text-[color:var(--risk-low)] border-[color:var(--risk-low)]/40 bg-[color:var(--risk-low)]/10">Verified</Badge>
                      : <Badge variant="outline" className="text-[color:var(--risk-high)] border-[color:var(--risk-high)]/40 bg-[color:var(--risk-high)]/10">Tampered</Badge>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Recent activity</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          {trail.map((c) => (
            <div key={c.id} className="flex items-center gap-2">
              <span className="text-muted-foreground text-xs">{c.when}</span>
              <span className="font-medium">{c.actor}</span>
              <span className="text-muted-foreground">{c.action.toLowerCase()}</span>
              <span className="font-mono text-xs">{c.target}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
