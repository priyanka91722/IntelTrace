import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "../api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import SignaturePad from "@/components/SignaturePad";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function CertificateDialog({ caseId }: { caseId: string | number }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [designation, setDesignation] = useState("");
  const [place, setPlace] = useState("");
  const [signature, setSignature] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!name.trim() || !designation.trim()) {
      toast.error("Name and designation are required");
      return;
    }
    if (!signature) {
      toast.error("Please draw a signature before generating");
      return;
    }
    setBusy(true);
    try {
      const r = await api.post<{ download_url: string; file: string }>(
        `/api/cases/${caseId}/certificate`,
        { officer_name: name, officer_designation: designation, place, signature_data_url: signature }
      );
      await api.download(r.download_url, r.file);
      toast.success(`Certificate draft generated: ${r.file}`);
      setOpen(false);
      setName("");
      setDesignation("");
      setPlace("");
      setSignature(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Draft 65B Certificate</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Draft Section 65B(4) Certificate</DialogTitle>
          <DialogDescription>
            IntelTrace auto-fills the hashes, timestamps and custody log it can verify. The
            conditions about the source device's regular use and proper operation are yours to
            certify from your own knowledge — that part can't be automated.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-xs uppercase tracking-[0.04em] text-muted">
              Officer name
            </label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. R. Nair" />
          </div>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-[0.04em] text-muted">
              Designation (responsible official position)
            </label>
            <Input
              value={designation}
              onChange={(e) => setDesignation(e.target.value)}
              placeholder="e.g. Sub-Inspector, Cyber Cell"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-[0.04em] text-muted">
              Place
            </label>
            <Input value={place} onChange={(e) => setPlace(e.target.value)} placeholder="e.g. Mumbai" />
          </div>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-[0.04em] text-muted">
              Signature
            </label>
            <SignaturePad onChange={setSignature} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy && <Loader2 className="animate-spin" />}
            {busy ? "Generating…" : "Generate Draft"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
