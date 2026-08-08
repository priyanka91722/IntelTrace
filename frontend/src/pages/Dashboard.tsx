import { useEffect, useState, type FormEvent, type MouseEvent } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api, getAuth, type Case } from "../api";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CountUp } from "@/components/CountUp";
import { useListStagger, useFadeIn } from "@/lib/motion";

export default function Dashboard() {
  const [cases, setCases] = useState<Case[] | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const role = getAuth()?.role ?? "";
  const canEdit = ["admin", "investigator"].includes(role);
  const isAdmin = role === "admin";
  const { container, item } = useListStagger();
  const headerFade = useFadeIn();
  const formFade = useFadeIn(0.08);

  const load = () =>
    api
      .get<Case[]>("/api/cases")
      .then(setCases)
      .catch((e) => setError(e.message));
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createCase(e: FormEvent) {
    e.preventDefault();
    try {
      const c = await api.post<Case>("/api/cases", { name, description });
      setName("");
      setDescription("");
      toast.success(`Case ${c.case_number} opened`);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  }

  async function deleteCase(c: Case, e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (
      !window.confirm(
        `Permanently delete ${c.case_number} — "${c.name}"?\n\nThis removes all evidence, findings and custody history. This cannot be undone.`
      )
    )
      return;
    try {
      await api.del(`/api/cases/${c.id}`);
      toast.success(`Case ${c.case_number} deleted`);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <>
      <motion.div {...headerFade}>
        <h1 className="mb-1 text-2xl font-semibold tracking-tight">Case files</h1>
        <p className="mb-6 text-muted">
          Every investigation starts as a case. Evidence, findings and the chain of custody stay
          attached to it.
        </p>
      </motion.div>

      {canEdit && (
        <motion.div {...formFade}>
          <Card className="mb-5">
            <CardContent>
              <form onSubmit={createCase} className="flex flex-wrap items-end gap-2.5">
                <div className="min-w-[220px] flex-[2]">
                  <label htmlFor="cn" className="mb-1 block text-xs uppercase tracking-[0.04em] text-muted">
                    New case name
                  </label>
                  <Input
                    id="cn"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Bank fraud — Branch 7"
                    required
                  />
                </div>
                <div className="min-w-[220px] flex-[3]">
                  <label htmlFor="cd" className="mb-1 block text-xs uppercase tracking-[0.04em] text-muted">
                    Description
                  </label>
                  <Input
                    id="cd"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="What is being investigated?"
                  />
                </div>
                <motion.div whileTap={{ scale: 0.97 }}>
                  <Button type="submit">Open case</Button>
                </motion.div>
                {error && <div className="w-full text-sm text-red">{error}</div>}
              </form>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {!cases ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[104px] rounded-xl" />
          ))}
        </div>
      ) : cases.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted">
          No cases yet. Open the first one above.
        </div>
      ) : (
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3.5"
        >
          {cases.map((c) => (
            <motion.div key={c.id} variants={item} whileHover={{ y: -3, scale: 1.01 }} className="relative">
              <Link to={`/cases/${c.id}`} className="block h-full">
                <Card className="h-full transition-colors hover:ring-phosphor/50">
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs tracking-[0.06em] text-phosphor">
                        {c.case_number}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <Badge variant={c.status === "open" ? "phosphor" : "outline"}>
                          {c.status}
                        </Badge>
                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-muted hover:text-red"
                            title="Delete case"
                            onClick={(e) => deleteCase(c, e)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="mb-2 mt-1 text-[16px] font-semibold">{c.name}</div>
                    <div className="flex gap-3.5 text-[12.5px] text-muted">
                      <span>
                        <CountUp value={c.evidence_count} className="font-mono text-text" /> evidence
                      </span>
                      <span>
                        <CountUp value={c.flagged_count} className="font-mono text-text" /> flagged
                      </span>
                      <span>
                        <CountUp value={c.high_risk_count} className="font-mono text-red" /> high risk
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      )}
    </>
  );
}
