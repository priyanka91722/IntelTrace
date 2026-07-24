import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { sampleOcr } from "@/lib/mock-data";
import { UploadCloud, ScanText } from "lucide-react";

export const Route = createFileRoute("/analysis/ocr")({
  head: () => ({
    meta: [
      { title: "OCR & Chat Analysis — IntelTrace" },
      { name: "description", content: "Extract text from chat screenshots and flag scam, phishing, and extortion keywords." },
      { property: "og:title", content: "OCR & Chat Analysis" },
      { property: "og:description", content: "Extract and classify text from chat screenshots." },
    ],
  }),
  component: OcrPage,
});

function OcrPage() {
  const [analyzed, setAnalyzed] = useState(true);
  const r = sampleOcr;

  const highlight = (text: string, terms: string[]) => {
    const pattern = new RegExp(`(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
    return text.split(pattern).map((chunk, i) =>
      terms.some((t) => t.toLowerCase() === chunk.toLowerCase())
        ? <mark key={i} className="bg-[color:var(--risk-high)]/25 text-[color:var(--risk-high)] rounded px-1">{chunk}</mark>
        : <span key={i}>{chunk}</span>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">OCR & Chat Analysis</h1>
        <p className="text-sm text-muted-foreground">Extract text from chat screenshots and classify by fraud category.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><UploadCloud className="h-4 w-4 text-primary" /> Chat Screenshot</CardTitle></CardHeader>
          <CardContent>
            <div className="rounded-md border-2 border-dashed border-border p-8 text-center">
              <div className="mx-auto w-64 rounded-md bg-[oklch(0.28_0.03_250)] p-4 text-left text-xs shadow-inner">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">WhatsApp · +91 98•••••23</div>
                <div className="rounded-md bg-[oklch(0.4_0.05_150)]/20 p-2 mb-1">Hi, congratulations! You have been shortlisted…</div>
                <div className="rounded-md bg-[oklch(0.4_0.05_150)]/20 p-2 mb-1">…pay a refundable security deposit of Rs 4,999 via UPI…</div>
                <div className="rounded-md bg-[oklch(0.4_0.05_150)]/20 p-2">Do not share this OTP with anyone else.</div>
              </div>
              <div className="mt-4">
                <Button onClick={() => setAnalyzed(true)}><ScanText className="mr-1 h-4 w-4" /> Run OCR & Classify</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Analysis Result</CardTitle>
            <CardDescription>
              {analyzed ? (
                <span className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[color:var(--risk-high)] border-[color:var(--risk-high)]/40 bg-[color:var(--risk-high)]/10">{r.category}</Badge>
                  <span className="text-xs">Confidence {(r.confidence * 100).toFixed(0)}%</span>
                </span>
              ) : "Run OCR to view results"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {analyzed && (
              <>
                <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Extracted Text</div>
                <p className="text-sm leading-relaxed rounded-md border border-border p-3 bg-muted/30">{highlight(r.raw, r.flagged)}</p>
                <div className="text-xs uppercase tracking-widest text-muted-foreground mt-4 mb-2">Flagged keywords</div>
                <div className="flex flex-wrap gap-1">
                  {r.flagged.map((k) => <Badge key={k} variant="outline" className="text-[color:var(--risk-high)] border-[color:var(--risk-high)]/40 bg-[color:var(--risk-high)]/10">{k}</Badge>)}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}