import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, FileSearch, FolderKanban, ShieldCheck, TrendingUp, Activity } from "lucide-react";
import { cases, stats, custody, riskColor } from "@/lib/mock-data";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — IntelTrace" },
      { name: "description", content: "Investigation overview: active cases, pending analysis, and high-risk flags." },
      { property: "og:title", content: "IntelTrace Dashboard" },
      { property: "og:description", content: "Investigation overview and high-risk flags." },
    ],
  }),
  component: Dashboard,
});

const activityData = [
  { day: "Mon", uploads: 4, flags: 1 },
  { day: "Tue", uploads: 7, flags: 3 },
  { day: "Wed", uploads: 5, flags: 2 },
  { day: "Thu", uploads: 9, flags: 5 },
  { day: "Fri", uploads: 12, flags: 6 },
  { day: "Sat", uploads: 3, flags: 1 },
  { day: "Sun", uploads: 2, flags: 0 },
];

function Stat({ icon: Icon, label, value, hint, tone = "primary" }: { icon: any; label: string; value: string | number; hint?: string; tone?: "primary" | "high" | "medium" | "low" }) {
  const toneCls = tone === "high" ? "text-[color:var(--risk-high)]" : tone === "medium" ? "text-[color:var(--risk-medium)]" : tone === "low" ? "text-[color:var(--risk-low)]" : "text-primary";
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{label}</span>
          <Icon className={`h-4 w-4 ${toneCls}`} />
        </div>
        <div className={`mt-2 text-2xl font-semibold ${toneCls}`}>{value}</div>
        {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  );
}

function Dashboard() {
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Summary of the cases and evidence stored in the system (sample data).</p>
        </div>
        <Link to="/cases" className="text-sm text-primary hover:underline">View all cases</Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Stat icon={FolderKanban} label="Total Cases" value={stats.totalCases} hint={`${stats.openCases} currently open`} />
        <Stat icon={FileSearch} label="Pending Analysis" value={stats.pendingAnalysis} hint="Evidence awaiting AI review" tone="medium" />
        <Stat icon={AlertTriangle} label="High-Risk Flags" value={stats.highRiskFlags} hint="Across all active cases" tone="high" />
        <Stat icon={ShieldCheck} label="Evidence Items" value={stats.evidenceItems} hint="Hash-verified in vault" tone="low" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" /> Uploads This Week</CardTitle>
            <CardDescription>Number of files uploaded and how many were flagged</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={activityData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} />
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--foreground)" }} />
                <Bar dataKey="uploads" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="flags" fill="var(--risk-high)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Activity className="h-4 w-4 text-primary" /> Recent Activity</CardTitle>
            <CardDescription>Last few custody log entries</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {custody.slice(-6).reverse().map((c) => (
              <div key={c.id} className="flex items-start gap-3 text-sm">
                <div className="mt-1 h-2 w-2 rounded-full bg-primary shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="truncate">
                    <span className="font-medium">{c.actor}</span>{" "}
                    <span className="text-muted-foreground">{c.action.toLowerCase()}</span>{" "}
                    <span className="text-foreground/90">{c.target}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">{c.when}</div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Active Cases</CardTitle>
          <CardDescription>Cases that are still open or under review</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {cases.filter(c => c.status !== "Closed").map((c) => (
            <Link key={c.id} to="/cases/$caseId" params={{ caseId: c.id }} className="block rounded-md border border-border p-4 hover:bg-accent/40 transition">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">{c.id}</span>
                    <span className="font-medium">{c.name}</span>
                    <Badge variant="outline" className="text-[10px]">{c.status}</Badge>
                    <Badge variant="outline" className={`text-[10px] ${riskColor(c.riskLevel)}`}>{c.riskLevel} Risk</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 max-w-2xl">{c.description}</p>
                </div>
                <div className="text-xs text-muted-foreground text-right">
                  <div>Opened {c.dateOpened}</div>
                  <div>{c.evidenceCount} items · {c.investigators.length} assigned</div>
                </div>
              </div>
              <div className="mt-3">
                <Progress value={c.riskLevel === "High" ? 85 : c.riskLevel === "Medium" ? 55 : 25} />
              </div>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}