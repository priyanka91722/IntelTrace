import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useParams, Link } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import {
  Loader2,
  KeyRound,
  Usb,
  FileX,
  FileUp,
  FileText,
  Banknote,
  Video,
  MessageSquare,
  Fingerprint,
  Network,
  HelpCircle,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import {
  api,
  getAuth,
  type Case,
  type Evidence,
  type FlaggedEvent,
  type TimelineItem,
  type CustodyEntry,
  type CrossCaseLink,
} from "../api";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useCrossfade, useFadeIn, tapScale } from "@/lib/motion";
import RiskSummaryPanel from "@/components/RiskSummary";
import EntityGraph from "@/components/EntityGraph";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import CertificateDialog from "@/components/CertificateDialog";

const FILE_TYPES: [string, string][] = [
  ["auto", "Auto-detect"],
  ["log", "System log (Windows CSV / .evtx, Linux auth.log, CERT CSV)"],
  ["chat_screenshot", "Chat screenshot"],
  ["financial_csv", "Financial transactions CSV"],
  ["image", "Image"],
  ["video", "Video"],
  ["pdf", "PDF document"],
  ["xlsx", "Spreadsheet (.xlsx — auto-converted to PDF for analysis)"],
  ["deepfake_manifest", "Deepfake/liveness label manifest (JSON)"],
  ["other", "Other"],
];

const TABS: [string, (n: { evidence: number; flagged: number; links: number; custody: number }) => string][] = [
  ["summary", () => "Risk Summary"],
  ["evidence", (n) => `Evidence (${n.evidence})`],
  ["flagged", (n) => `Flagged events (${n.flagged})`],
  ["timeline", () => "Timeline"],
  ["links", (n) => `Cross-case links (${n.links})`],
  ["custody", (n) => `Chain of custody (${n.custody})`],
];

const RISK_BADGE: Record<string, "destructive" | "warning" | "outline"> = {
  High: "destructive",
  Medium: "warning",
  Low: "outline",
};

const RISK_TEXT: Record<string, string> = {
  High: "text-red",
  Medium: "text-amber",
  Low: "text-muted",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface RunResult {
  flagged?: number;
  verdict?: string;
  new_cross_case_links?: number;
  modules?: string[];
  total_flagged_after_dedup?: number;
  total_flagged_before_dedup?: number;
  unique_entities?: number;
  cross_case_links?: number;
  errors?: { error: string }[];
}

const fmtTs = (t?: string | null) => (t ? new Date(t).toLocaleString("en-IN", { hour12: false }) : "—");

function iconForEvent(eventType: string, module: string): LucideIcon {
  const et = eventType.toLowerCase();
  if (et.includes("usb")) return Usb;
  if (et.includes("logon") || et.includes("logoff") || et.includes("auth")) return KeyRound;
  if (et.includes("file_delete")) return FileX;
  if (et.includes("file_transfer")) return FileUp;
  if (et.includes("file")) return FileText;
  if (et.includes("spoof")) return Fingerprint;
  if (et.startsWith("keyword:")) return MessageSquare;
  if (et.startsWith("media_")) return Video;
  if (
    et.includes("transaction") ||
    et.startsWith("linked_to_illicit") ||
    et.startsWith("known_illicit") ||
    et.startsWith("statistical_outlier")
  )
    return Banknote;
  if (module.includes("financial_graph")) return Network;
  return HelpCircle;
}

function IntegrityChip({ ev }: { ev: Evidence }) {
  const ok = ev.integrity_status === "Verified";
  return (
    <span className="hashchip" title={ev.original_hash}>
      <span className={`dot ${ok ? "ok" : "bad"}`} />
      sha256:{ev.original_hash.slice(0, 14)}…
    </span>
  );
}

export default function CasePage() {
  const { caseId } = useParams();
  const [caseData, setCaseData] = useState<Case | null>(null);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [flagged, setFlagged] = useState<FlaggedEvent[]>([]);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [custody, setCustody] = useState<CustodyEntry[]>([]);
  const [links, setLinks] = useState<CrossCaseLink[]>([]);
  const [tab, setTab] = useState("summary");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const canEdit = ["admin", "investigator"].includes(getAuth()?.role ?? "");

  const [files, setFiles] = useState<File[]>([]);
  const [fileType, setFileType] = useState("auto");
  const [machineId, setMachineId] = useState("");

  const fadeIn = useFadeIn();
  const reducedMotion = useReducedMotion();

  // tracks which flagged-event ids are new since the previous load, so their
  // rows can flash-highlight instead of just silently appearing in the table
  const prevFlaggedIds = useRef<Set<number> | null>(null);
  const [newFlaggedIds, setNewFlaggedIds] = useState<Set<number>>(new Set());

  const loadAll = useCallback(async () => {
    if (!caseId) return;
    try {
      const [c, ev, fl, cu, ln] = await Promise.all([
        api.get<Case>(`/api/cases/${caseId}`),
        api.get<Evidence[]>(`/api/cases/${caseId}/evidence`),
        api.get<FlaggedEvent[]>(`/api/cases/${caseId}/flagged`),
        api.get<CustodyEntry[]>(`/api/cases/${caseId}/custody`),
        api.get<CrossCaseLink[]>(`/api/cases/${caseId}/links`),
      ]);
      setCaseData(c);
      setEvidence(ev);
      if (prevFlaggedIds.current) {
        const added = fl.filter((f) => !prevFlaggedIds.current!.has(f.id)).map((f) => f.id);
        if (added.length) setNewFlaggedIds(new Set(added));
      }
      prevFlaggedIds.current = new Set(fl.map((f) => f.id));
      setFlagged(fl);
      setCustody(cu);
      setLinks(ln);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [caseId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (tab === "timeline") {
      api
        .get<TimelineItem[]>(`/api/cases/${caseId}/timeline`)
        .then(setTimeline)
        .catch((e) => toast.error(e.message));
    }
  }, [tab, caseId, flagged.length]);

  async function upload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (files.length === 0) return;
    // Capture the form node synchronously — React nulls out
    // SyntheticEvent.currentTarget once this handler yields at the first
    // await, so reading e.currentTarget after the upload resolves throws
    // "Cannot read properties of null (reading 'reset')" on large/slow uploads.
    const form = e.currentTarget;

    if (files.length === 1) {
      const single = files[0];
      setBusy("upload");
      try {
        const fd = new FormData();
        fd.append("file", single);
        fd.append("file_type", fileType);
        fd.append("machine_id", machineId || "unknown");
        const ev = await api.upload<Evidence>(`/api/cases/${caseId}/evidence`, fd);
        const summary = ev.parsed_summary ?? {};
        const fmt = summary.detected_format;
        const xlsxSheets = summary.sheets;
        toast.success(
          `Uploaded ${ev.file_name} — ${ev.integrity_status}` +
            (fmt
              ? ` · parsed as ${fmt} (${summary.total_events} events, OS: ${(summary.source_os || []).join("/") || "n/a"})`
              : "") +
            (xlsxSheets ? ` · converted to PDF (${xlsxSheets.length} sheet(s), ${summary.total_rows} row(s))` : "") +
            (summary.conversion_error ? ` · PDF conversion failed: ${summary.conversion_error}` : "")
        );
        setFiles([]);
        form.reset();
        loadAll();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy("");
      }
      return;
    }

    // Multiple files: upload one at a time (the endpoint only accepts a
    // single file) and report a combined summary rather than one toast per
    // file, which would be noisy for a batch.
    let succeeded = 0;
    const failures: string[] = [];
    for (let i = 0; i < files.length; i++) {
      setBusy(`upload (${i + 1}/${files.length})`);
      try {
        const fd = new FormData();
        fd.append("file", files[i]);
        fd.append("file_type", fileType);
        fd.append("machine_id", machineId || "unknown");
        await api.upload<Evidence>(`/api/cases/${caseId}/evidence`, fd);
        succeeded++;
      } catch (err) {
        failures.push(`${files[i].name}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    setBusy("");
    if (succeeded > 0) toast.success(`Uploaded ${succeeded} of ${files.length} file(s)`);
    if (failures.length > 0) {
      toast.error(`${failures.length} file(s) failed: ${failures.join("; ")}`);
    }
    setFiles([]);
    form.reset();
    loadAll();
  }

  async function run(path: string, label: string) {
    setBusy(label);
    try {
      const r = await api.post<RunResult>(path);
      if (r.modules) {
        toast.success(
          `${label}: ${r.modules.length} module(s) run (${r.modules.join(", ")}) · ` +
            `${r.total_flagged_after_dedup} finding(s)` +
            (r.total_flagged_before_dedup && r.total_flagged_before_dedup > (r.total_flagged_after_dedup ?? 0)
              ? ` (de-duplicated from ${r.total_flagged_before_dedup})`
              : "") +
            ` · ${r.unique_entities} entit${r.unique_entities === 1 ? "y" : "ies"}` +
            (r.cross_case_links ? ` · ${r.cross_case_links} new cross-case link(s)` : "") +
            (r.errors?.length ? ` · ${r.errors.length} skipped: ${r.errors.map((x) => x.error).join("; ")}` : "")
        );
      } else {
        toast.success(
          `${label}: ${r.flagged ?? 0} finding(s)` +
            (r.verdict ? ` · verdict: ${r.verdict}` : "") +
            (r.new_cross_case_links ? ` · ${r.new_cross_case_links} cross-case link(s)` : "")
        );
      }
      loadAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy("");
    }
  }

  async function verify(evId: number) {
    setBusy(`verify${evId}`);
    try {
      await api.post(`/api/evidence/${evId}/verify`);
      loadAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy("");
    }
  }

  async function makeReport() {
    setBusy("report");
    try {
      const r = await api.post<{ download_url: string; file: string }>(`/api/cases/${caseId}/report`);
      await api.download(r.download_url, r.file);
      toast.success(`Report generated: ${r.file}`);
      loadAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy("");
    }
  }

  const analysisFor = (ev: Evidence): [string, string][] => {
    const actions: [string, string][] = [];
    const summary = ev.parsed_summary ?? {};
    // log and xlsx evidence are both content-probed at upload time (see
    // routers/evidence.py::_ingest_log_events / _looks_financial) — these
    // modules are only offered when that probe actually found something,
    // not just because the file was typed/guessed as "log". A CSV that
    // only matched the generic fallback (no real log signal) won't show
    // Log anomaly; if it looks like a transaction ledger instead, it gets
    // Financial regardless of what type it was uploaded/guessed as.
    if ((ev.file_type === "log" && summary.log_parse_confidence === "high") ||
        (ev.file_type === "xlsx" && summary.log_events))
      actions.push(["Log anomaly", `/api/evidence/${ev.id}/analyze/log-anomaly`]);
    if (["chat_screenshot", "image", "pdf", "xlsx"].includes(ev.file_type))
      actions.push(["OCR + chat", `/api/evidence/${ev.id}/analyze/ocr-chat`]);
    if (ev.file_type === "financial_csv" ||
        ((ev.file_type === "log" || ev.file_type === "xlsx") && summary.looks_financial))
      actions.push(["Financial", `/api/evidence/${ev.id}/analyze/financial`]);
    if (["image", "video", "chat_screenshot"].includes(ev.file_type))
      actions.push(["Media verify", `/api/evidence/${ev.id}/analyze/media`]);
    if (ev.file_type === "deepfake_manifest")
      actions.push(["Deepfake manifest", `/api/evidence/${ev.id}/analyze/deepfake-manifest`]);
    return actions;
  };

  if (!caseData) {
    return (
      <>
        <Skeleton className="mb-4 h-14 w-full max-w-md" />
        <Skeleton className="mb-4 h-9 w-full max-w-lg" />
        <Skeleton className="h-64 w-full" />
        {error && <div className="mt-3 text-sm text-red">{error}</div>}
      </>
    );
  }

  const counts = { evidence: evidence.length, flagged: flagged.length, links: links.length, custody: custody.length };

  return (
    <>
      <div className="mb-4 flex items-center gap-2">
        <Button asChild variant="outline" size="sm">
          <Link to="/">← Back to Dashboard</Link>
        </Button>
      </div>
      <motion.div {...fadeIn} className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="font-mono text-xs tracking-[0.06em] text-phosphor">{caseData.case_number}</span>
          <h1 className="mb-1 mt-0.5 text-2xl font-semibold tracking-tight">{caseData.name}</h1>
          <p className="text-muted">{caseData.description || "No description."}</p>
        </div>
        <div className="flex items-center gap-2.5">
          <Badge variant={caseData.status === "open" ? "phosphor" : "outline"}>{caseData.status}</Badge>
          {canEdit && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                api
                  .patch(`/api/cases/${caseId}/status?status=${caseData.status === "open" ? "closed" : "open"}`)
                  .then(loadAll)
              }
            >
              Mark {caseData.status === "open" ? "closed" : "open"}
            </Button>
          )}
        </div>
      </motion.div>

      {canEdit && (
        <div className="mt-4 flex flex-wrap gap-2.5">
          <motion.div whileTap={tapScale}>
            <Button disabled={!!busy} onClick={() => run(`/api/cases/${caseId}/analyze/all`, "Run all modules")}>
              {busy === "Run all modules" && <Loader2 className="animate-spin" />}
              {busy === "Run all modules" ? "Analyzing…" : "Run all analysis modules"}
            </Button>
          </motion.div>
          <motion.div whileTap={tapScale}>
            <Button
              variant="outline"
              disabled={!!busy}
              onClick={() =>
                run(`/api/cases/${caseId}/analyze/transaction-graph`, "Transaction graph")
              }
            >
              {busy === "Transaction graph" && <Loader2 className="animate-spin" />}
              {busy === "Transaction graph" ? "Joining files…" : "Analyze transaction graph"}
            </Button>
          </motion.div>
          <motion.div whileTap={tapScale}>
            <Button variant="outline" disabled={!!busy} onClick={makeReport}>
              {busy === "report" && <Loader2 className="animate-spin" />}
              {busy === "report" ? "Building PDF…" : "Generate PDF report"}
            </Button>
          </motion.div>
          <motion.div whileTap={tapScale}>
            <CertificateDialog caseId={caseId!} />
          </motion.div>
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab} className="mt-5">
        <TabsList variant="line" className="h-auto w-full justify-start gap-4 border-b border-line bg-transparent p-0">
          {TABS.map(([id, label]) => (
            <TabsTrigger
              key={id}
              value={id}
              onClick={() => setTab(id)}
              className="rounded-none border-0 px-1 pb-2.5 pt-1 text-[13.5px] text-muted data-[state=active]:text-phosphor data-[state=active]:after:bg-phosphor data-[state=active]:shadow-none"
            >
              {label(counts)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <motion.div
        key={tab}
        initial={{ opacity: 0, y: reducedMotion ? 0 : 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reducedMotion ? 0 : 0.16, ease: "easeOut" }}
        className="mt-4"
      >
          {tab === "summary" && caseId && (
            <ErrorBoundary>
              <RiskSummaryPanel caseId={caseId} />
            </ErrorBoundary>
          )}

          {tab === "evidence" && (
            <>
              {canEdit && (
                <Card className="mb-4">
                  <CardContent>
                    <form onSubmit={upload} className="flex flex-wrap items-end gap-2.5">
                      <div className="min-w-[200px] flex-[2]">
                        <label className="mb-1 block text-xs uppercase tracking-[0.04em] text-muted">
                          Evidence file
                        </label>
                        <Input
                          type="file"
                          multiple
                          onChange={(e: ChangeEvent<HTMLInputElement>) =>
                            setFiles(Array.from(e.target.files ?? []))
                          }
                          required
                        />
                        {files.length > 1 && (
                          <div className="mt-1 text-xs text-muted">{files.length} files selected</div>
                        )}
                      </div>
                      <div className="min-w-[220px] flex-[2]">
                        <label className="mb-1 block text-xs uppercase tracking-[0.04em] text-muted">
                          Evidence type
                        </label>
                        <Select value={fileType} onValueChange={setFileType}>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {FILE_TYPES.map(([v, l]) => (
                              <SelectItem key={v} value={v}>
                                {l}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="min-w-[150px] flex-1">
                        <label className="mb-1 block text-xs uppercase tracking-[0.04em] text-muted">
                          Source machine
                        </label>
                        <Input
                          value={machineId}
                          onChange={(e) => setMachineId(e.target.value)}
                          placeholder="e.g. LAPTOP-PDFEK5V5"
                        />
                      </div>
                      <Button type="submit" disabled={busy.startsWith("upload")}>
                        {busy.startsWith("upload") && <Loader2 className="animate-spin" />}
                        {busy.startsWith("upload")
                          ? busy === "upload"
                            ? "Hashing…"
                            : busy.replace("upload", "Hashing")
                          : "Upload & hash"}
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              )}
              <Card>
                <CardContent>
                  {evidence.length === 0 ? (
                    <div className="py-8 text-center text-sm text-muted">No evidence uploaded yet.</div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>File</TableHead>
                          <TableHead>Type / OS</TableHead>
                          <TableHead>Integrity</TableHead>
                          <TableHead>Parsed</TableHead>
                          <TableHead>Uploaded</TableHead>
                          {canEdit && <TableHead>Analyze</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <tbody>
                        {evidence.map((ev) => {
                          const summary = ev.parsed_summary ?? {};
                          return (
                            <TableRow key={ev.id}>
                              <TableCell className="whitespace-normal">
                                <div className="mono text-text">{ev.file_name}</div>
                                <IntegrityChip ev={ev} />
                              </TableCell>
                              <TableCell>
                                <Badge variant="phosphor">{ev.file_type}</Badge>
                                {ev.source_os && (
                                  <Badge variant="outline" className="ml-1.5">
                                    {ev.source_os}
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                <Badge variant={ev.integrity_status === "Verified" ? "success" : "destructive"}>
                                  {ev.integrity_status}
                                </Badge>
                                <div>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="mt-1.5"
                                    onClick={() => verify(ev.id)}
                                    disabled={busy === `verify${ev.id}`}
                                  >
                                    Re-verify
                                  </Button>
                                </div>
                              </TableCell>
                              <TableCell className="mono max-w-[240px] whitespace-normal text-muted">
                                {summary.detected_format ? (
                                  `${summary.detected_format} · ${summary.total_events} events`
                                ) : summary.financial ? (
                                  `${summary.financial.total_transactions} txns`
                                ) : summary.sheets ? (
                                  `${summary.sheets.length} sheet(s), ${summary.total_rows} rows → PDF`
                                ) : summary.conversion_error ? (
                                  "PDF conversion failed"
                                ) : summary.ocr_chars ? (
                                  <div className="flex flex-col gap-1">
                                    <div className="flex items-center gap-1.5">
                                      <span>{summary.ocr_chars} chars OCR</span>
                                      {summary.ocr_verdict && (
                                        <Badge
                                          variant={
                                            summary.ocr_verdict.verdict === "clean" ? "success" : "destructive"
                                          }
                                          className="text-[10px]"
                                        >
                                          {summary.ocr_verdict.verdict === "clean"
                                            ? "No Risk"
                                            : summary.ocr_verdict.risk_level}
                                        </Badge>
                                      )}
                                    </div>
                                    {summary.receipt_fields && (
                                      <div className="text-[11px] leading-snug text-muted">
                                        {summary.receipt_fields.vendor && (
                                          <div className="truncate">Vendor: {summary.receipt_fields.vendor}</div>
                                        )}
                                        {summary.receipt_fields.total_amount != null && (
                                          <div>
                                            Total: {summary.receipt_fields.currency ?? ""}{" "}
                                            {summary.receipt_fields.total_amount}
                                          </div>
                                        )}
                                        {summary.receipt_fields.date && <div>Date: {summary.receipt_fields.date}</div>}
                                        {summary.receipt_fields.document_no && (
                                          <div>Doc #: {summary.receipt_fields.document_no}</div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  "—"
                                )}
                              </TableCell>
                              <TableCell className="ts">{fmtTs(ev.uploaded_at)}</TableCell>
                              {canEdit && (
                                <TableCell className="whitespace-normal">
                                  {analysisFor(ev).map(([label, path]) => (
                                    <Button
                                      key={label}
                                      variant="ghost"
                                      size="sm"
                                      className="mb-1.5 mr-1.5"
                                      disabled={!!busy}
                                      onClick={() => run(path, label)}
                                    >
                                      {busy === label ? "…" : label}
                                    </Button>
                                  ))}
                                </TableCell>
                              )}
                            </TableRow>
                          );
                        })}
                      </tbody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </>
          )}

          {tab === "flagged" && (
            <Card>
              <CardContent>
                {flagged.length === 0 ? (
                  <div className="py-8 text-center text-sm text-muted">
                    No flagged findings yet — run the analysis modules.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Risk</TableHead>
                        <TableHead>Module</TableHead>
                        <TableHead>Event</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Time</TableHead>
                      </TableRow>
                    </TableHeader>
                    <tbody>
                      {flagged.map((f) => {
                        const modules = f.module.split(",").map((m) => m.trim()).filter(Boolean);
                        const corroborated = modules.length > 1;
                        const isNew = newFlaggedIds.has(f.id);
                        return (
                          <motion.tr
                            key={f.id}
                            className="border-b border-line transition-colors hover:bg-panel-2/60"
                            initial={isNew && !reducedMotion ? { backgroundColor: "rgba(60, 255, 122, 0.18)" } : false}
                            animate={{ backgroundColor: "rgba(60, 255, 122, 0)" }}
                            transition={{ duration: 2, ease: "easeOut" }}
                          >
                            <TableCell className="whitespace-normal">
                              <span className={`mono mr-1.5 font-bold ${RISK_TEXT[f.risk_level] ?? ""}`}>
                                {Math.round(f.risk_score)}
                              </span>
                              <Badge variant={RISK_BADGE[f.risk_level] ?? "outline"}>{f.risk_level}</Badge>
                            </TableCell>
                            <TableCell className="mono whitespace-normal text-muted">
                              {modules.map((m) => m.replace(/_/g, " ")).join(" + ")}
                              {corroborated && (
                                <Badge variant="success" className="ml-1.5" title="Corroborated by multiple independent modules">
                                  corroborated
                                </Badge>
                              )}
                              {isNew && (
                                <Badge variant="phosphor" className="ml-1.5">
                                  new
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="mono">{f.event_type}</TableCell>
                            <TableCell className="whitespace-normal">{f.description}</TableCell>
                            <TableCell className="ts">{fmtTs(f.event_time)}</TableCell>
                          </motion.tr>
                        );
                      })}
                    </tbody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}

          {tab === "timeline" && (
            <Card>
              <CardContent>
                {timeline.length === 0 ? (
                  <div className="py-8 text-center text-sm text-muted">No timestamped findings yet.</div>
                ) : (
                  <div className="timeline">
                    {timeline.map((t, i) => {
                      const Icon = iconForEvent(t.event_type, t.module);
                      return (
                        <motion.div
                          key={t.id}
                          initial={{ opacity: 0, x: reducedMotion ? 0 : -10 }}
                          whileInView={{ opacity: 1, x: 0 }}
                          viewport={{ once: true, margin: "-40px" }}
                          transition={{
                            duration: reducedMotion ? 0 : 0.3,
                            ease: "easeOut",
                            delay: reducedMotion ? 0 : Math.min(i * 0.03, 0.3),
                          }}
                          className={`tl-item ${t.related_to_previous ? "related" : ""}`}
                        >
                          <span className={`tl-node ${t.risk_level}`}>
                            <Icon strokeWidth={2.5} />
                          </span>
                          <div className="tl-time">{fmtTs(t.timestamp)}</div>
                          <div className="tl-desc">{t.description}</div>
                          <div className="tl-meta">
                            {t.module.replace(/_/g, " ")} · risk {Math.round(t.risk_score)} ({t.risk_level})
                            {t.evidence_id ? ` · evidence #${t.evidence_id}` : ""}
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {tab === "links" && (
            <div className="flex flex-col gap-4">
              {links.length > 0 && caseData && (
                <Card>
                  <CardContent>
                    <h3 className="mb-3 text-sm font-medium text-text">Entity relationship graph</h3>
                    <ErrorBoundary
                      fallback={
                        <div className="py-6 text-center text-sm text-muted">
                          This graph couldn't be displayed — see the table below instead.
                        </div>
                      }
                    >
                      <EntityGraph
                        links={links}
                        currentCaseId={caseData.id}
                        currentCaseNumber={caseData.case_number}
                      />
                    </ErrorBoundary>
                  </CardContent>
                </Card>
              )}
              <Card>
                <CardContent>
                  {links.length === 0 ? (
                    <div className="py-8 text-center text-sm text-muted">
                      No entities from this case appear in other cases.
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Entity type</TableHead>
                          <TableHead>Value</TableHead>
                          <TableHead>Linked cases</TableHead>
                          <TableHead>Found</TableHead>
                        </TableRow>
                      </TableHeader>
                      <tbody>
                        {links.map((l) => (
                          <TableRow key={l.id}>
                            <TableCell>
                              <Badge variant="phosphor">{l.entity_type}</Badge>
                            </TableCell>
                            <TableCell className="mono">{l.entity_value}</TableCell>
                            <TableCell className="whitespace-normal">
                              <Link to={`/cases/${l.case_a}`} className="text-phosphor hover:underline">
                                {l.case_a_number || `Case #${l.case_a}`}
                              </Link>{" "}
                              ↔{" "}
                              <Link to={`/cases/${l.case_b}`} className="text-phosphor hover:underline">
                                {l.case_b_number || `Case #${l.case_b}`}
                              </Link>
                            </TableCell>
                            <TableCell className="ts">{fmtTs(l.created_at)}</TableCell>
                          </TableRow>
                        ))}
                      </tbody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {tab === "custody" && (
            <Card>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Detail</TableHead>
                    </TableRow>
                  </TableHeader>
                  <tbody>
                    {custody.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="ts">{fmtTs(c.timestamp)}</TableCell>
                        <TableCell className="mono">{c.username}</TableCell>
                        <TableCell className="whitespace-normal">{c.action}</TableCell>
                        <TableCell className="mono whitespace-normal">{c.detail}</TableCell>
                      </TableRow>
                    ))}
                  </tbody>
                </Table>
              </CardContent>
            </Card>
          )}
      </motion.div>
    </>
  );
}
