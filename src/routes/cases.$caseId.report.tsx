import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getCase, evidence, riskColor } from "@/lib/mock-data";
import { Download, FileSignature, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/cases/$caseId/report")({ component: Report });

function Report() {
  const { caseId } = Route.useParams();
  const c = getCase(caseId)!;
  const items = evidence.filter((e) => e.caseId === caseId);
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-base font-semibold">Report</h2>
          <p className="text-sm text-muted-foreground">Summary of this case with its evidence and hash values.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setOpen(true)}><FileSignature className="mr-1 h-4 w-4" /> Section 65B</Button>
          <Button onClick={() => toast.success(`Report exported as inteltrace_${c.id}.pdf`)}>
            <Download className="mr-1 h-4 w-4" /> Download PDF
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Case Summary — {c.id} · {c.name}</CardTitle>
          <CardDescription>{c.description}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3 text-sm">
          <div><div className="text-xs text-muted-foreground">Opened</div><div className="mt-1">{c.dateOpened}</div></div>
          <div><div className="text-xs text-muted-foreground">Risk</div><div className="mt-1"><Badge variant="outline" className={riskColor(c.riskLevel)}>{c.riskLevel}</Badge></div></div>
          <div><div className="text-xs text-muted-foreground">Assigned</div><div className="mt-1">{c.investigators.join(", ")}</div></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Evidence Manifest</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {items.map((e) => (
            <div key={e.id} className="flex items-center justify-between rounded-md border border-border p-3 text-sm">
              <div className="min-w-0">
                <div className="flex items-center gap-2"><span className="font-mono text-xs text-muted-foreground">{e.id}</span><span className="font-medium truncate">{e.name}</span><Badge variant="outline">{e.type}</Badge></div>
                <div className="font-mono text-[10px] text-muted-foreground truncate">SHA-256 {e.sha256}</div>
              </div>
              <Badge variant="outline" className="gap-1 text-[color:var(--risk-low)] border-[color:var(--risk-low)]/40 bg-[color:var(--risk-low)]/10"><ShieldCheck className="h-3 w-3" /> Verified</Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Section 65B Certificate</DialogTitle></DialogHeader>
          <div className="rounded-md border border-border bg-muted/30 p-5 text-sm font-serif leading-relaxed max-h-[60vh] overflow-auto">
            <p className="text-center font-semibold">Certificate under Section 65B(4)</p>
            <p className="mt-4">I, <b>{c.investigators[0]}</b>, hereby certify in relation to case <b>{c.id} — {c.name}</b> that:</p>
            <ol className="list-decimal list-inside space-y-2 mt-3">
              <li>The electronic records were produced using the IntelTrace system, which was working normally at the time.</li>
              <li>The SHA-256 hash values below verify the integrity of each item:
                <ul className="list-disc list-inside ml-4 mt-1 font-mono text-[11px]">
                  {items.map((e) => <li key={e.id}>{e.id} · {e.name} · {e.sha256.slice(0, 32)}…</li>)}
                </ul>
              </li>
            </ol>
            <div className="mt-8 grid grid-cols-2 gap-4 text-xs">
              <div>
                <div className="border-t border-border pt-1">Signature</div>
                <div className="mt-1">{c.investigators[0]}</div>
              </div>
              <div>
                <div className="border-t border-border pt-1">Date</div>
                <div className="mt-1">{new Date().toISOString().slice(0, 10)}</div>
              </div>
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={() => { setOpen(false); toast.success("Certificate generated"); }}>Done</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
