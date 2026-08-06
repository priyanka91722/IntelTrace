import { createFileRoute, Link, Outlet, notFound, useRouterState } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { getCase, riskColor } from "@/lib/mock-data";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/cases/$caseId")({
  loader: ({ params }) => {
    const c = getCase(params.caseId);
    if (!c) throw notFound();
    return { c };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData ? `${loaderData.c.name} — IntelTrace` : "Case — IntelTrace" },
      { name: "description", content: loaderData?.c.description ?? "Case detail" },
      { property: "og:title", content: loaderData ? loaderData.c.name : "Case" },
      { property: "og:description", content: loaderData?.c.description ?? "Case detail" },
    ],
  }),
  component: CaseLayout,
  notFoundComponent: () => <div className="text-sm text-muted-foreground">Case not found.</div>,
});

const tabs = [
  { to: "/cases/$caseId", label: "Overview", exact: true },
  { to: "/cases/$caseId/evidence", label: "Evidence" },
  { to: "/cases/$caseId/integrity", label: "Hash Check" },
  { to: "/cases/$caseId/financial", label: "Financial" },
  { to: "/cases/$caseId/logs", label: "Logs" },
  { to: "/cases/$caseId/ocr", label: "OCR / Chat" },
  { to: "/cases/$caseId/deepfake", label: "Deepfake" },
  { to: "/cases/$caseId/timeline", label: "Timeline" },
  { to: "/cases/$caseId/custody", label: "Custody" },
  { to: "/cases/$caseId/report", label: "Report" },
] as const;

function CaseLayout() {
  const { c } = Route.useLoaderData();
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const base = `/cases/${c.id}`;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/cases" className="flex items-center gap-1 hover:text-primary"><ArrowLeft className="h-3 w-3" /> Cases</Link>
        <span>/</span>
        <span className="font-mono">{c.id}</span>
      </div>

      <div>
        <h1 className="text-xl font-semibold">{c.name}</h1>
        <p className="text-sm text-muted-foreground max-w-2xl">{c.description}</p>
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <Badge variant="outline">{c.status}</Badge>
          <Badge variant="outline" className={riskColor(c.riskLevel)}>{c.riskLevel} Risk</Badge>
          <span className="text-xs text-muted-foreground">Opened {c.dateOpened}</span>
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-border">
        {tabs.map((t) => {
          const url = t.to.replace("$caseId", c.id);
          const active = "exact" in t && t.exact ? pathname === base || pathname === base + "/" : pathname.startsWith(url);
          return (
            <Link
              key={t.label}
              to={t.to}
              params={{ caseId: c.id }}
              className={`whitespace-nowrap px-3 py-2 text-sm border-b-2 -mb-px ${active ? "border-primary text-primary font-medium" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>

      <Outlet />
    </div>
  );
}
