import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cases, evidence, riskColor } from "@/lib/mock-data";
import { ArrowLeft, FileText, Upload, Clock, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/cases/$caseId")({
  loader: ({ params }) => {
    const c = cases.find((x) => x.id === params.caseId);
    if (!c) throw notFound();
    return { c, items: evidence.filter((e) => e.caseId === c.id) };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData ? `${loaderData.c.name} — IntelTrace` : "Case — IntelTrace" },
      { name: "description", content: loaderData?.c.description ?? "Case detail" },
      { property: "og:title", content: loaderData ? loaderData.c.name : "Case" },
      { property: "og:description", content: loaderData?.c.description ?? "Case detail" },
    ],
  }),
  component: CaseDetail,
  notFoundComponent: () => <div className="text-sm text-muted-foreground">Case not found.</div>,
});

function CaseDetail() {
  const { c, items } = Route.useLoaderData();
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/cases" className="flex items-center gap-1 hover:text-primary"><ArrowLeft className="h-3 w-3" /> Cases</Link>
        <span>/</span>
        <span className="font-mono">{c.id}</span>
      </div>

      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{c.name}</h1>
          <p className="text-sm text-muted-foreground max-w-2xl">{c.description}</p>
          <div className="mt-3 flex items-center gap-2">
            <Badge variant="outline">{c.status}</Badge>
            <Badge variant="outline" className={riskColor(c.riskLevel)}>{c.riskLevel} Risk</Badge>
            <span className="text-xs text-muted-foreground">Opened {c.dateOpened}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild><Link to="/evidence/upload"><Upload className="mr-1 h-4 w-4" /> Add Evidence</Link></Button>
          <Button variant="outline" asChild><Link to="/timeline"><Clock className="mr-1 h-4 w-4" /> Timeline</Link></Button>
          <Button asChild><Link to="/report"><FileText className="mr-1 h-4 w-4" /> Generate Report</Link></Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardContent className="p-4"><div className="text-xs uppercase tracking-widest text-muted-foreground">Evidence items</div><div className="text-2xl font-semibold mt-1">{items.length}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs uppercase tracking-widest text-muted-foreground">Investigators</div><div className="text-sm mt-2">{c.investigators.join(", ")}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs uppercase tracking-widest text-muted-foreground">Integrity</div><div className="mt-2 flex items-center gap-2 text-sm"><ShieldCheck className="h-4 w-4 text-[color:var(--risk-low)]" /> {items.filter(i => i.verified).length}/{items.length} hash-verified</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Evidence in this case</CardTitle>
          <CardDescription>Items ingested and their integrity status</CardDescription>
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
                <TableHead>SHA-256</TableHead>
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
                  <TableCell className="font-mono text-[10px] truncate max-w-[220px]">{e.sha256}</TableCell>
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
    </div>
  );
}