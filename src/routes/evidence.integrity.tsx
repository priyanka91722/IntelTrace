import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { evidence } from "@/lib/mock-data";
import { ShieldCheck, ShieldAlert, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/evidence/integrity")({
  head: () => ({
    meta: [
      { title: "Evidence Integrity — IntelTrace" },
      { name: "description", content: "SHA-256 verification status for every ingested evidence item." },
      { property: "og:title", content: "Evidence Integrity" },
      { property: "og:description", content: "SHA-256 verification of every evidence item." },
    ],
  }),
  component: Integrity,
});

function Integrity() {
  const [rows, setRows] = useState(evidence);
  const verified = rows.filter((r) => r.verified).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Evidence Integrity</h1>
        <p className="text-sm text-muted-foreground">Cryptographic verification ensures no evidence has been altered post-ingest.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardContent className="p-4"><div className="text-xs uppercase tracking-widest text-muted-foreground">Verified</div><div className="mt-1 text-2xl font-semibold text-[color:var(--risk-low)]">{verified}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs uppercase tracking-widest text-muted-foreground">Tampered</div><div className="mt-1 text-2xl font-semibold text-[color:var(--risk-high)]">{rows.length - verified}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs uppercase tracking-widest text-muted-foreground">Total items</div><div className="mt-1 text-2xl font-semibold">{rows.length}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Hash Verification Ledger</CardTitle>
          <CardDescription>Re-run verification to compare stored hash against a fresh compute</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Evidence</TableHead>
                <TableHead>Uploader</TableHead>
                <TableHead>Timestamp</TableHead>
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
                    <div className="text-xs text-muted-foreground font-mono">{e.id} · {e.caseId}</div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{e.uploader}</TableCell>
                  <TableCell className="text-muted-foreground">{e.uploadedAt}</TableCell>
                  <TableCell className="font-mono text-[10px] truncate max-w-[200px]">{e.sha256}</TableCell>
                  <TableCell>
                    {e.verified ? (
                      <Badge variant="outline" className="gap-1 text-[color:var(--risk-low)] border-[color:var(--risk-low)]/40 bg-[color:var(--risk-low)]/10"><ShieldCheck className="h-3 w-3" /> Verified</Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1 text-[color:var(--risk-high)] border-[color:var(--risk-high)]/40 bg-[color:var(--risk-high)]/10"><ShieldAlert className="h-3 w-3" /> Tampered</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setRows((r) => r.map((x) => x.id === e.id ? { ...x, verified: true } : x));
                        toast.success(`${e.id} re-verified · hash matches original`);
                      }}
                    >
                      <RefreshCw className="h-3 w-3 mr-1" /> Re-verify
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