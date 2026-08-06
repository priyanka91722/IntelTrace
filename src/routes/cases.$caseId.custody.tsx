import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { custody } from "@/lib/mock-data";

export const Route = createFileRoute("/cases/$caseId/custody")({ component: Custody });

function Custody() {
  const { caseId } = Route.useParams();
  const rows = custody.filter((c) => c.caseId === caseId);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold">Chain of Custody</h2>
        <p className="text-sm text-muted-foreground">Every action taken on the evidence of this case.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Audit trail</CardTitle>
          <CardDescription>{rows.length} entry(s) for {caseId}</CardDescription>
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
              {rows.map((c) => (
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
