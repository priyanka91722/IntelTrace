import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { timeline, riskColor } from "@/lib/mock-data";
import { KeyRound, Usb, FileText, Banknote, Video, MessageSquare } from "lucide-react";

export const Route = createFileRoute("/timeline")({
  head: () => ({
    meta: [
      { title: "Case Timeline — IntelTrace" },
      { name: "description", content: "Chronological reconstruction of authentication, device, file, and financial events." },
      { property: "og:title", content: "Case Timeline" },
      { property: "og:description", content: "Chronological reconstruction of case events." },
    ],
  }),
  component: Timeline,
});

const iconFor = {
  auth: KeyRound,
  device: Usb,
  file: FileText,
  financial: Banknote,
  media: Video,
  chat: MessageSquare,
} as const;

function Timeline() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Timeline Reconstruction</h1>
        <p className="text-sm text-muted-foreground">Cross-source chronological view · CASE-002 · Insider Data Leak</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Reconstructed Sequence</CardTitle>
          <CardDescription>Merged from system logs, financial ledger, and messaging evidence</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="relative border-l border-border ml-3">
            {timeline.map((t, i) => {
              const Icon = iconFor[t.type];
              return (
                <li key={i} className="mb-6 ml-6">
                  <span className={`absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-background ${t.risk === "High" ? "bg-[color:var(--risk-high)]/20 text-[color:var(--risk-high)]" : t.risk === "Medium" ? "bg-[color:var(--risk-medium)]/20 text-[color:var(--risk-medium)]" : "bg-[color:var(--risk-low)]/20 text-[color:var(--risk-low)]"}`}>
                    <Icon className="h-3 w-3" />
                  </span>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs text-muted-foreground">{t.time}</span>
                    <span className="font-medium">{t.label}</span>
                    <Badge variant="outline" className={riskColor(t.risk)}>{t.risk}</Badge>
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">{t.detail}</div>
                </li>
              );
            })}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}