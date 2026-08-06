import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UploadCloud, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { evidence } from "@/lib/mock-data";

export const Route = createFileRoute("/cases/$caseId/evidence")({ component: UploadPage });

type Row = { id: string; name: string; size: number; sha: string; tag: string };

const fakeHash = (s: string) =>
  Array.from({ length: 64 }, (_, i) => ((s.charCodeAt(i % s.length) + i * 13) % 16).toString(16)).join("");

const detectTag = (name: string) => {
  const n = name.toLowerCase();
  if (/\.(mp4|mov|avi|mkv)$/.test(n)) return "Video";
  if (/\.(jpg|jpeg|png|webp|heic)$/.test(n)) return "Image";
  if (/(chat|whatsapp|screenshot)/.test(n)) return "Chat";
  if (/(statement|invoice|txn|financial|bank)/.test(n)) return "Financial";
  if (/\.(evtx|log|txt)$/.test(n)) return "Log";
  return "Document";
};

function UploadPage() {
  const { caseId } = Route.useParams();
  const existing = evidence.filter((e) => e.caseId === caseId);
  const [rows, setRows] = useState<Row[]>([]);
  const [dragging, setDragging] = useState(false);

  const addFiles = (files: FileList | File[]) => {
    const newRows: Row[] = Array.from(files).map((f) => ({
      id: `EV-${Math.floor(Math.random() * 9000 + 1000)}`,
      name: f.name,
      size: f.size,
      sha: fakeHash(f.name + f.size),
      tag: detectTag(f.name),
    }));
    setRows((r) => [...newRows, ...r]);
    toast.success(`Added ${newRows.length} file(s) to ${caseId}`);
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold">Evidence Upload</h2>
        <p className="text-sm text-muted-foreground">Files uploaded here are attached to {caseId} and hashed with SHA-256.</p>
      </div>

      <Card>
        <CardContent
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files); }}
          className={`p-10 text-center border-2 border-dashed rounded-md transition m-6 ${dragging ? "border-primary bg-primary/5" : "border-border"}`}
        >
          <UploadCloud className="mx-auto h-8 w-8 text-primary" />
          <div className="mt-3 text-sm">Drag & drop evidence here</div>
          <div className="mt-4">
            <label>
              <input type="file" multiple className="hidden" onChange={(e) => e.target.files && addFiles(e.target.files)} />
              <Button asChild variant="outline"><span>Browse files</span></Button>
            </label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Files in this case</CardTitle>
          <CardDescription>{existing.length + rows.length} item(s)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {existing.map((e) => (
            <div key={e.id} className="flex items-center gap-3 rounded-md border border-border p-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-muted-foreground">{e.id}</span>
                  <span className="font-medium truncate">{e.name}</span>
                  <Badge variant="outline">{e.type}</Badge>
                </div>
                <div className="mt-1 font-mono text-[10px] text-muted-foreground truncate">SHA-256 {e.sha256}</div>
              </div>
            </div>
          ))}
          {rows.map((r) => (
            <div key={r.id} className="flex items-start gap-3 rounded-md border border-border p-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-muted-foreground">{r.id}</span>
                  <span className="font-medium truncate">{r.name}</span>
                  <Badge variant="outline">{(r.size / 1024).toFixed(1)} KB</Badge>
                </div>
                <div className="mt-1 font-mono text-[10px] text-muted-foreground truncate">SHA-256 {r.sha}</div>
              </div>
              <Select value={r.tag} onValueChange={(v) => setRows((rs) => rs.map((x) => x.id === r.id ? { ...x, tag: v } : x))}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Video","Image","Log","Financial","Chat","Document"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button variant="ghost" size="icon" onClick={() => setRows((rs) => rs.filter((x) => x.id !== r.id))}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
