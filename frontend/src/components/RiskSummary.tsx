import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "../api";
import type { RiskSummary as RiskSummaryData } from "../api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { CountUp } from "@/components/CountUp";
import { useFadeIn } from "@/lib/motion";
import { motion } from "motion/react";

const RISK_COLOR: Record<string, string> = {
  High: "var(--color-red)",
  Medium: "var(--color-amber)",
  Low: "var(--color-muted)",
};

const RISK_BADGE_VARIANT: Record<string, "destructive" | "warning" | "outline"> = {
  High: "destructive",
  Medium: "warning",
  Low: "outline",
};

function StatTile({
  label,
  value,
  total,
  colorClass,
}: {
  label: string;
  value: number;
  total?: number;
  colorClass: string;
}) {
  const pct = total && total > 0 ? Math.round((value / total) * 100) : null;
  return (
    <Card>
      <CardContent className="py-4">
        <div className="text-xs uppercase tracking-[0.08em] text-muted">{label}</div>
        <div className="flex items-baseline gap-1.5">
          <CountUp value={value} className={`mono block text-3xl font-semibold ${colorClass}`} />
          {pct !== null && <span className="mono text-xs text-muted">{pct}%</span>}
        </div>
      </CardContent>
    </Card>
  );
}

function RiskMixBar({ high, medium, low }: { high: number; medium: number; low: number }) {
  const total = high + medium + low;
  if (total === 0) return null;
  const segs = [
    { label: "High", value: high, color: RISK_COLOR.High },
    { label: "Medium", value: medium, color: RISK_COLOR.Medium },
    { label: "Low", value: low, color: RISK_COLOR.Low },
  ].filter((s) => s.value > 0);
  return (
    <div>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-line">
        {segs.map((s, i) => (
          <div
            key={s.label}
            style={{
              width: `${(s.value / total) * 100}%`,
              background: s.color,
              marginLeft: i > 0 ? 2 : 0,
            }}
            title={`${s.label}: ${s.value} (${Math.round((s.value / total) * 100)}%)`}
          />
        ))}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {segs.map((s) => (
          <span key={s.label} className="flex items-center gap-1.5 text-muted">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: s.color }} />
            {s.label} {Math.round((s.value / total) * 100)}%
          </span>
        ))}
      </div>
    </div>
  );
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-line bg-panel px-3 py-2 text-xs shadow-lg">
      <div className="mb-1 font-medium text-text">{label}</div>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-1.5 text-muted">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: p.color }} />
          {p.name}: <span className="mono text-text">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

const fmtDay = (iso: string) =>
  new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short" });

export default function RiskSummaryPanel({ caseId }: { caseId: string | number }) {
  const [data, setData] = useState<RiskSummaryData | null>(null);
  const [error, setError] = useState("");
  const fadeIn = useFadeIn();

  useEffect(() => {
    api
      .get<RiskSummaryData>(`/api/cases/${caseId}/risk-summary`)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [caseId]);

  if (error) return <div className="py-8 text-center text-sm text-red">{error}</div>;
  if (!data) {
    return (
      <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
    );
  }

  if (data.total_flagged === 0) {
    return (
      <div className="py-10 text-center text-sm text-muted">
        No findings yet — upload evidence and run analysis to see the risk breakdown here.
      </div>
    );
  }

  const { High, Medium, Low } = data.by_risk_level;

  const moduleData = Object.entries(data.by_module).map(([module, count]) => ({
    name: `${module.replace(/_/g, " ")} (${count})`,
    count,
    pct: Math.round((count / data.total_flagged) * 100),
  }));

  const perFileData = data.per_evidence
    .filter((e) => e.flagged > 0)
    .map((e) => {
      const short = e.file_name.length > 20 ? e.file_name.slice(0, 18) + "…" : e.file_name;
      return {
        name: `${short} (${e.flagged})`,
        fullName: e.file_name,
        High: e.high,
        Medium: e.medium,
        Low: e.low,
      };
    });

  const timeSeries = data.timeline_series.map((d) => ({
    day: fmtDay(d.date),
    High: d.high,
    Medium: d.medium,
    Low: d.low,
  }));

  return (
    <motion.div {...fadeIn} className="flex flex-col gap-4">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3.5">
        <StatTile label="Total findings" value={data.total_flagged} colorClass="text-text" />
        <StatTile label="High risk" value={High} total={data.total_flagged} colorClass="text-red" />
        <StatTile label="Medium risk" value={Medium} total={data.total_flagged} colorClass="text-amber" />
        <StatTile label="Low risk" value={Low} total={data.total_flagged} colorClass="text-muted" />
      </div>

      <Card>
        <CardContent className="py-4">
          <h3 className="mb-2.5 text-sm font-medium text-text">Risk mix</h3>
          <RiskMixBar high={High} medium={Medium} low={Low} />
        </CardContent>
      </Card>

      {timeSeries.length > 1 && (
        <Card>
          <CardContent>
            <h3 className="mb-3 text-sm font-medium text-text">Findings over time</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={timeSeries} barCategoryGap={timeSeries.length > 20 ? 1 : 8}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" vertical={false} />
                <XAxis
                  dataKey="day"
                  stroke="var(--color-muted)"
                  fontSize={11}
                  tick={{ fill: "var(--color-muted)" }}
                  interval={timeSeries.length > 14 ? Math.floor(timeSeries.length / 10) : 0}
                />
                <YAxis allowDecimals={false} stroke="var(--color-muted)" fontSize={11} width={36} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--color-line)", opacity: 0.3 }} />
                <Legend wrapperStyle={{ fontSize: 12, color: "var(--color-muted)" }} iconType="circle" iconSize={8} />
                <Bar dataKey="High" stackId="risk" fill={RISK_COLOR.High} />
                <Bar dataKey="Medium" stackId="risk" fill={RISK_COLOR.Medium} />
                <Bar dataKey="Low" stackId="risk" fill={RISK_COLOR.Low} radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {perFileData.length > 0 && (
          <Card>
            <CardContent>
              <h3 className="mb-3 text-sm font-medium text-text">Findings per file, by risk level</h3>
              <ResponsiveContainer width="100%" height={Math.max(120, perFileData.length * 46)}>
                <BarChart data={perFileData} layout="vertical" barCategoryGap={12}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} stroke="var(--color-muted)" fontSize={11} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    stroke="var(--color-muted)"
                    fontSize={11}
                    width={170}
                    tick={{ fill: "var(--color-muted)" }}
                  />
                  <Tooltip
                    content={<ChartTooltip />}
                    cursor={{ fill: "var(--color-line)", opacity: 0.3 }}
                  />
                  <Bar dataKey="High" stackId="risk" fill={RISK_COLOR.High} />
                  <Bar dataKey="Medium" stackId="risk" fill={RISK_COLOR.Medium} />
                  <Bar dataKey="Low" stackId="risk" fill={RISK_COLOR.Low} radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {moduleData.length > 0 && (
          <Card>
            <CardContent>
              <h3 className="mb-3 text-sm font-medium text-text">Findings by analysis module</h3>
              <ResponsiveContainer width="100%" height={Math.max(120, moduleData.length * 46)}>
                <BarChart data={moduleData} layout="vertical" barCategoryGap={12}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} stroke="var(--color-muted)" fontSize={11} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    stroke="var(--color-muted)"
                    fontSize={11}
                    width={170}
                    tick={{ fill: "var(--color-muted)" }}
                  />
                  <Tooltip
                    content={
                      <ChartTooltip />
                    }
                    cursor={{ fill: "var(--color-line)", opacity: 0.3 }}
                  />
                  <Bar dataKey="count" name="findings" fill="var(--color-phosphor)" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {data.top_signals.length > 0 && (
        <Card>
          <CardContent>
            <h3 className="mb-3 text-sm font-medium text-text">Top signals — recurring reasons</h3>
            <div className="flex flex-wrap gap-2">
              {data.top_signals.map((s) => (
                <div
                  key={s.signal}
                  className="flex items-center gap-2 rounded-lg border border-line bg-panel-2 px-3 py-1.5"
                >
                  <span className="text-xs text-text">{s.signal.replace(/_/g, " ")}</span>
                  <Badge variant={RISK_BADGE_VARIANT[s.risk_level] ?? "outline"} className="mono">
                    {s.count}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {data.top_keywords.length > 0 && (
        <Card>
          <CardContent>
            <h3 className="mb-3 text-sm font-medium text-text">
              Top matched keywords/phrases
            </h3>
            <div className="flex flex-wrap gap-2">
              {data.top_keywords.map((k) => (
                <div
                  key={`${k.category}:${k.keyword}`}
                  className="flex items-center gap-2 rounded-lg border border-line bg-panel-2 px-3 py-1.5"
                  title={`Category: ${k.category}${k.downgraded ? " — downgraded on receipt-shaped documents" : ""}`}
                >
                  <span className="mono text-xs text-text">“{k.keyword}”</span>
                  <span className="text-[10px] uppercase tracking-wide text-muted">
                    {k.category.replace(/_/g, " ")}
                  </span>
                  <Badge variant={RISK_BADGE_VARIANT[k.risk_level] ?? "outline"} className="mono">
                    {k.count}
                  </Badge>
                  {k.downgraded && <span className="text-[10px] text-muted">(routine)</span>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent>
          <h3 className="mb-3 text-sm font-medium text-text">Per-file breakdown</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>File</TableHead>
                <TableHead>Records analyzed</TableHead>
                <TableHead>Flagged</TableHead>
                <TableHead>Risk</TableHead>
                <TableHead>Top reasons</TableHead>
              </TableRow>
            </TableHeader>
            <tbody>
              {data.per_evidence.map((e) => {
                const pct =
                  e.records_analyzed && e.records_analyzed > 0
                    ? ((e.flagged / e.records_analyzed) * 100).toFixed(1)
                    : null;
                return (
                  <TableRow key={e.evidence_id}>
                    <TableCell className="mono text-text">{e.file_name}</TableCell>
                    <TableCell className="mono text-muted">
                      {e.records_analyzed ?? "—"}
                    </TableCell>
                    <TableCell className="mono text-text">
                      {e.flagged}
                      {pct && <span className="text-muted"> ({pct}%)</span>}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2 text-xs mono">
                        {e.high > 0 && <span className="text-red">{e.high} High</span>}
                        {e.medium > 0 && <span className="text-amber">{e.medium} Med</span>}
                        {e.low > 0 && <span className="text-muted">{e.low} Low</span>}
                        {e.flagged === 0 && <span className="text-muted">normal</span>}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[280px] whitespace-normal text-xs text-muted">
                      {e.top_event_types.map((t) => `${t.event_type} (${t.count})`).join(", ") || "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </tbody>
          </Table>
        </CardContent>
      </Card>
    </motion.div>
  );
}
