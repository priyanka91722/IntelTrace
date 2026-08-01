import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { transactions, riskColor, riskFromScore } from "@/lib/mock-data";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/analysis/financial")({
  head: () => ({
    meta: [
      { title: "Financial Anomaly Analyzer — IntelTrace" },
      { name: "description", content: "AI-scored transaction analysis to surface duplicates, layering, and late-night transfers." },
      { property: "og:title", content: "Financial Anomaly Analyzer" },
      { property: "og:description", content: "AI-scored transaction analysis with risk flags." },
    ],
  }),
  component: Financial,
});

function Financial() {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"risk" | "amount" | "time">("risk");

  const rows = useMemo(() => {
    const f = transactions.filter((t) => (t.id + t.sender + t.receiver).toLowerCase().includes(q.toLowerCase()));
    return f.sort((a, b) =>
      sort === "risk" ? b.riskScore - a.riskScore :
      sort === "amount" ? b.amount - a.amount :
      a.timestamp.localeCompare(b.timestamp)
    );
  }, [q, sort]);

  const dist = ["Low", "Medium", "High"].map((lvl) => ({
    level: lvl,
    count: transactions.filter((t) => riskFromScore(t.riskScore) === lvl).length,
  }));
  const distColor: Record<string, string> = { Low: "var(--risk-low)", Medium: "var(--risk-medium)", High: "var(--risk-high)" };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Financial Anomaly Analyzer</h1>
        <p className="text-sm text-muted-foreground">Every transaction is scored 0–100 based on duplication, timing, round-amount, and velocity heuristics.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Risk Distribution</CardTitle>
            <CardDescription>Across the {transactions.length} transactions in scope</CardDescription>
          </CardHeader>
          <CardContent className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dist}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="level" stroke="var(--muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} />
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--foreground)" }} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {dist.map((d) => <Cell key={d.level} fill={distColor[d.level]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-[color:var(--risk-high)]" /> Top signals</CardTitle>
            <CardDescription>Recurring flags across the dataset</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {["Rapid succession","Layering","Late-night","Round amount","Duplicate","High value","Unusual receiver"].map((s) => (
              <div key={s} className="flex items-center justify-between">
                <span>{s}</span>
                <Badge variant="outline">{transactions.filter(t => t.flags.includes(s)).length}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center gap-3 space-y-0">
          <CardTitle className="text-base flex-1">Transactions</CardTitle>
          <Input placeholder="Search sender / receiver / id" value={q} onChange={(e) => setQ(e.target.value)} className="w-64" />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as any)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="risk">Sort by risk</option>
            <option value="amount">Sort by amount</option>
            <option value="time">Sort by time</option>
          </select>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Txn ID</TableHead>
                <TableHead>Timestamp</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Sender</TableHead>
                <TableHead>Receiver</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Flags</TableHead>
                <TableHead>Risk</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((t) => {
                const level = riskFromScore(t.riskScore);
                return (
                  <TableRow key={t.id}>
                    <TableCell className="font-mono text-xs">{t.id}</TableCell>
                    <TableCell className="text-muted-foreground">{t.timestamp}</TableCell>
                    <TableCell className="font-medium">₹{t.amount.toLocaleString("en-IN")}</TableCell>
                    <TableCell>{t.sender}</TableCell>
                    <TableCell>{t.receiver}</TableCell>
                    <TableCell><Badge variant="outline">{t.type}</Badge></TableCell>
                    <TableCell><div className="flex flex-wrap gap-1">{t.flags.map((f) => <Badge key={f} variant="outline" className="text-[10px]">{f}</Badge>)}</div></TableCell>
                    <TableCell>
                      <Badge variant="outline" className={riskColor(level)}>{t.riskScore} · {level}</Badge>
                    </TableCell>
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