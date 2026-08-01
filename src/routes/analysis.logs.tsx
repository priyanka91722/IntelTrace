import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { logs, riskColor, riskFromScore } from "@/lib/mock-data";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export const Route = createFileRoute("/analysis/logs")({
  head: () => ({
    meta: [
      { title: "System Log Anomalies — IntelTrace" },
      { name: "description", content: "Parsed system events with AI-scored anomaly ratings for after-hours and unusual activity." },
      { property: "og:title", content: "System Log Anomalies" },
      { property: "og:description", content: "AI-scored system events with anomaly ratings." },
    ],
  }),
  component: Logs,
});

const timeSeries = Array.from({ length: 24 }, (_, h) => ({
  hour: `${h.toString().padStart(2, "0")}:00`,
  events: h < 5 ? (h === 2 ? 11 : 2) : h > 20 ? 3 : 4 + ((h * 3) % 12),
}));

function Logs() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Anomaly Detection · System Logs</h1>
        <p className="text-sm text-muted-foreground">After-hours activity, failed logons, and privilege escalations are flagged automatically.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Activity over 24h</CardTitle>
          <CardDescription>Event volume per hour · after-hours spikes elevate risk</CardDescription>
        </CardHeader>
        <CardContent className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={timeSeries}>
              <defs>
                <linearGradient id="ev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.6} />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="hour" stroke="var(--muted-foreground)" fontSize={11} interval={2} />
              <YAxis stroke="var(--muted-foreground)" fontSize={11} />
              <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--foreground)" }} />
              <Area type="monotone" dataKey="events" stroke="var(--primary)" fill="url(#ev)" />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Log Events</CardTitle>
          <CardDescription>Parsed from Windows EVTX and syslog sources</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
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
              {logs.map((l) => {
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
        </CardContent>
      </Card>
    </div>
  );
}