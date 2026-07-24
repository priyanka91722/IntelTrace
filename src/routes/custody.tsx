import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { custody } from "@/lib/mock-data";

export const Route = createFileRoute("/custody")({
  head: () => ({
    meta: [
      { title: "Chain of Custody — IntelTrace" },
      { name: "description", content: "Immutable audit log of every action taken on every piece of evidence." },
      { property: "og:title", content: "Chain of Custody" },
      { property: "og:description", content: "Immutable audit log of evidence actions." },
    ],
  }),
  component: Custody,
});

function Custody() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Chain of Custody Log</h1>
        <p className="text-sm text-muted-foreground">Every ingest, view, analysis, and export is recorded and hash-anchored.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Audit Trail</CardTitle>
          <CardDescription>Immutable · appended in insertion order</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Entry</TableHead>
                <TableHead>Timestamp</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Target</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {custody.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-xs">{c.id}</TableCell>
                  <TableCell className="text-muted-foreground">{c.when}</TableCell>
                  <TableCell className="font-medium">{c.actor}</TableCell>
                  <TableCell><Badge variant="outline">{c.action}</Badge></TableCell>
                  <TableCell className="font-mono text-xs">{c.target}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}