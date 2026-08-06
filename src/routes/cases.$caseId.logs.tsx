import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { logs, riskColor, riskFromScore } from "@/lib/mock-data";

export const Route = createFileRoute("/cases/$caseId/logs")({ component: Logs });

function Logs() {
  const { caseId } = Route.useParams();
  const rows = logs.filter((l) => l.caseId === caseId);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold">Log Analysis</h2>
        <p className="text-sm text-muted-foreground">System events from files uploaded to this case. After-hours activity gets a higher score.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Log events</CardTitle>
          <CardDescription>{rows.length} event(s) for {caseId}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">No log files parsed for this case.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Risk</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((l) => {
                  const level = riskFromScore(l.riskScore);
                  return (
                    <TableRow key={l.id}>
                      <TableCell className="font-medium">{l.user}</TableCell>
                      <TableCell className="text-muted-foreground">{l.timestamp}</TableCell>
                      <TableCell><Badge variant="outline">{l.event}</Badge></TableCell>
                      <TableCell className="font-mono text-xs">{l.target}</TableCell>
                      <TableCell><Badge variant="outline" className={riskColor(level)}>{l.riskScore} · {level}</Badge></TableCell>
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
