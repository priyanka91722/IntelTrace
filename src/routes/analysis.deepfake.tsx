import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { sampleDeepfake } from "@/lib/mock-data";
import { ShieldAlert, ShieldCheck, PlayCircle } from "lucide-react";

export const Route = createFileRoute("/analysis/deepfake")({
  head: () => ({
    meta: [
      { title: "Deepfake & Media Verification — IntelTrace" },
      { name: "description", content: "AI verdict on video and image authenticity with GAN and lip-sync analysis." },
      { property: "og:title", content: "Deepfake Verification" },
      { property: "og:description", content: "AI verdict on video and image authenticity." },
    ],
  }),
  component: Deepfake,
});

function Deepfake() {
  const r = sampleDeepfake;
  const bad = r.verdict === "Manipulated";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Deepfake & Media Verification</h1>
        <p className="text-sm text-muted-foreground">Detects GAN fingerprints, blink-rate inconsistency, and audio-lip desynchronization.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Media Preview</CardTitle></CardHeader>
          <CardContent>
            <div className="aspect-video rounded-md bg-gradient-to-br from-[oklch(0.25_0.03_250)] to-[oklch(0.18_0.02_250)] flex items-center justify-center border border-border">
              <PlayCircle className="h-16 w-16 text-primary/60" />
            </div>
            <div className="mt-3 text-xs text-muted-foreground font-mono">extortion_video.mp4 · 00:00:47 · 88 MB</div>
          </CardContent>
        </Card>

        <Card className={bad ? "border-[color:var(--risk-high)]/40" : "border-[color:var(--risk-low)]/40"}>
          <CardHeader>
            <CardTitle className="text-base">Verdict</CardTitle>
            <CardDescription>Model: IntelTrace-DFv3 · GAN + biometric</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className={`flex items-center gap-3 rounded-md border p-4 ${bad ? "bg-[color:var(--risk-high)]/10 border-[color:var(--risk-high)]/30" : "bg-[color:var(--risk-low)]/10 border-[color:var(--risk-low)]/30"}`}>
              {bad
                ? <ShieldAlert className="h-8 w-8 text-[color:var(--risk-high)]" />
                : <ShieldCheck className="h-8 w-8 text-[color:var(--risk-low)]" />}
              <div>
                <div className={`text-lg font-semibold ${bad ? "text-[color:var(--risk-high)]" : "text-[color:var(--risk-low)]"}`}>{r.verdict}</div>
                <div className="text-xs text-muted-foreground">Confidence {(r.confidence * 100).toFixed(1)}%</div>
              </div>
            </div>

            <div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Detection cues</div>
              <div className="space-y-1">
                {r.cues.map((c) => (
                  <div key={c} className="flex items-center justify-between text-sm">
                    <span>{c}</span>
                    <Badge variant="outline" className="text-[color:var(--risk-high)] border-[color:var(--risk-high)]/40 bg-[color:var(--risk-high)]/10">flagged</Badge>
                  </div>
                ))}
              </div>
            </div>

            <Button variant="outline" className="w-full">Attach verdict to case CASE-2403</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}