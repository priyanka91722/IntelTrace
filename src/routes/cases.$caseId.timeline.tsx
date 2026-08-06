import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { timeline, riskColor } from "@/lib/mock-data";
import { KeyRound, Usb, FileText, Banknote, Video, MessageSquare } from "lucide-react";

export const Route = createFileRoute("/cases/$caseId/timeline")({ component: Timeline });

const iconFor = { auth: KeyRound, device: Usb, file: FileText, financial: Banknote, media: Video, chat: MessageSquare } as const;

function Timeline() {
  const { caseId } = Route.useParams();
  const items = timeline.filter((t) => t.caseId === caseId);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold">Timeline</h2>
        <p className="text-sm text-muted-foreground">Events for this case put in order from the uploaded evidence.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sequence of events</CardTitle>
          <CardDescription>{items.length} event(s) for {caseId}</CardDescription>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <div className="text-sm text-muted-foreground">Nothing added to the timeline yet.</div>
          ) : (
            <ol className="relative border-l border-border ml-3">
              {items.map((t, i) => {
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
