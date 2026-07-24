import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search } from "lucide-react";
import { cases as seedCases, riskColor, type Case } from "@/lib/mock-data";
import { toast } from "sonner";

export const Route = createFileRoute("/cases/")({
  head: () => ({
    meta: [
      { title: "Cases — IntelTrace" },
      { name: "description", content: "Manage cybercrime cases, assignments, and status across the cell." },
      { property: "og:title", content: "IntelTrace Cases" },
      { property: "og:description", content: "Manage cybercrime cases and assignments." },
    ],
  }),
  component: CasesList,
});

function CasesList() {
  const [rows, setRows] = useState<Case[]>(seedCases);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [open, setOpen] = useState(false);

  const filtered = rows.filter((c) => {
    const matchesQ = (c.name + c.id + c.description).toLowerCase().includes(q.toLowerCase());
    const matchesS = status === "all" || c.status === status;
    return matchesQ && matchesS;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Case Management</h1>
          <p className="text-sm text-muted-foreground">All investigations assigned to this cyber cell.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-1 h-4 w-4" /> New Case</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Open a new case</DialogTitle>
              <DialogDescription>File the initial FIR-linked investigation record.</DialogDescription>
            </DialogHeader>
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget as HTMLFormElement);
                const id = `CASE-${2406 + rows.length - seedCases.length}`;
                setRows([
                  {
                    id,
                    name: String(fd.get("name") || "Untitled case"),
                    description: String(fd.get("desc") || ""),
                    dateOpened: new Date().toISOString().slice(0, 10),
                    status: "Open",
                    investigators: [String(fd.get("inv") || "Unassigned")],
                    evidenceCount: 0,
                    riskLevel: "Low",
                  },
                  ...rows,
                ]);
                setOpen(false);
                toast.success(`Case ${id} created`);
              }}
            >
              <div className="space-y-2"><Label htmlFor="name">Case name</Label><Input id="name" name="name" required /></div>
              <div className="space-y-2"><Label htmlFor="desc">Description</Label><Textarea id="desc" name="desc" rows={3} /></div>
              <div className="space-y-2"><Label htmlFor="inv">Assigned investigator</Label><Input id="inv" name="inv" placeholder="e.g. Insp. R. Nair" /></div>
              <DialogFooter><Button type="submit">Open case</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="flex-row items-center gap-3 space-y-0">
          <CardTitle className="text-base flex-1">All cases</CardTitle>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-8 w-56" />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="Open">Open</SelectItem>
              <SelectItem value="Under Review">Under Review</SelectItem>
              <SelectItem value="Closed">Closed</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Case ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Risk</TableHead>
                <TableHead>Opened</TableHead>
                <TableHead>Evidence</TableHead>
                <TableHead>Assigned</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => (
                <TableRow key={c.id} className="cursor-pointer">
                  <TableCell className="font-mono text-xs">
                    <Link to="/cases/$caseId" params={{ caseId: c.id }} className="text-primary hover:underline">{c.id}</Link>
                  </TableCell>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell><Badge variant="outline">{c.status}</Badge></TableCell>
                  <TableCell><Badge variant="outline" className={riskColor(c.riskLevel)}>{c.riskLevel}</Badge></TableCell>
                  <TableCell className="text-muted-foreground">{c.dateOpened}</TableCell>
                  <TableCell>{c.evidenceCount}</TableCell>
                  <TableCell className="text-muted-foreground">{c.investigators.join(", ")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}