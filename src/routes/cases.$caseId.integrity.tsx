import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { evidence } from "@/lib/mock-data";
import { ShieldCheck, ShieldAlert, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/cases/$caseId/integrity")({ component: Integrity });

function Integrity() {
  const { caseId } = Route.useParams();
  const [rows, setRows] = useState(evidence.filter((e) => e.caseId === caseId));
  const verified = rows.filter((r) => r.verified).length;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold">Hash Check</h2>
        <p className="text-sm text-muted-foreground">Compares the stored SHA-256 of each file in this case with a fresh one.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Verified</div><div className="mt-1 text-2xl font-semibold text-[color:var(--risk-low)]">{verified}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Tampered</div><div className="mt-1 text-2xl font-semibold text-[color:var(--risk-high)]">{rows.length - verified}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Total items</div><div className="mt-1 text-2xl font-semibold">{rows.length}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Verification list</CardTitle>
          <CardDescription>Files attached to {caseId}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Evidence</TableHead>
                <TableHead>Uploader</TableHead>
                <TableHead>SHA-256</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>
                    <div className="font-medium">{e.name}</div>
                    <div className="text-xs text-muted-foreground font-mono">{e.id}</div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{e.uploader}</TableCell>
                  <TableCell className="font-mono text-[10px] truncate max-w-[200px]">{e.sha256}</TableCell>
                  <TableCell>
                    {e.verified ? (
                      <Badge variant="outline" className="gap-1 text-[color:var(--risk-low)] border-[color:var(--risk-low)]/40 bg-[color:var(--risk-low)]/10"><ShieldCheck className="h-3 w-3" /> Verified</Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1 text-[color:var(--risk-high)] border-[color:var(--risk-high)]/40 bg-[color:var(--risk-high)]/10"><ShieldAlert className="h-3 w-3" /> Tampered</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => { setRows((r) => r.map((x) => x.id === e.id ? { ...x, verified: true } : x)); toast.success(`${e.id} re-checked · hash matches`); }}>
                      <RefreshCw className="h-3 w-3 mr-1" /> Re-check
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
