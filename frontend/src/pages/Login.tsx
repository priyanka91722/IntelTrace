import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Loader2 } from "lucide-react";
import { api, setAuth } from "../api";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useCrossfade } from "@/lib/motion";

// Real capabilities, not marketing filler — this doubles as a quick "what
// does this thing actually do" summary for anyone landing on the console
// for the first time.
const BOOT_LINES = [
  "Verifying evidence integrity (SHA-256)",
  "Normalizing cross-OS event logs",
  "Running Isolation Forest anomaly detection",
  "Chain of custody — immutable, append-only",
  "Cross-case entity correlation",
  "Financial & deepfake/liveness analysis",
];

function BootLine({ text, index }: { text: string; index: number }) {
  const reduced = useReducedMotion();
  const base = reduced ? 0 : 0.55 + index * 0.32;
  return (
    <motion.div
      initial={{ opacity: 0, x: reduced ? 0 : -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: base, duration: 0.25 }}
      className="flex items-center gap-2 font-mono text-[12.5px]"
    >
      <span className="text-muted">&gt;</span>
      <span className="text-text/90">{text}…</span>
      <motion.span
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: base + (reduced ? 0 : 0.28), duration: 0.2 }}
        className="font-semibold text-phosphor"
      >
        OK
      </motion.span>
    </motion.div>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  const reduced = useReducedMotion();
  return (
    <div className={compact ? "text-center" : ""}>
      <div
        className={`font-mono font-bold tracking-wide text-text ${compact ? "text-[26px]" : "text-[32px]"}`}
      >
        Intel<b className="text-phosphor">Trace</b>
        <motion.span
          className="text-phosphor"
          animate={reduced ? {} : { opacity: [1, 1, 0, 0] }}
          transition={reduced ? {} : { duration: 1.1, repeat: Infinity, times: [0, 0.5, 0.5, 1] }}
        >
          _
        </motion.span>
      </div>
      <div
        className={`mt-1.5 uppercase tracking-[0.12em] text-muted ${compact ? "text-[11.5px]" : "text-[12px]"}`}
      >
        AI-powered cybercrime evidence triage
      </div>
    </div>
  );
}

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();
  const errorMotion = useCrossfade();
  const reduced = useReducedMotion();

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const auth = await api.login(username, password);
      setAuth(auth);
      nav("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const spring = (delay = 0) =>
    reduced
      ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0 } }
      : {
          initial: { opacity: 0, y: -14, scale: 0.98 },
          animate: { opacity: 1, y: 0, scale: 1 },
          transition: { type: "spring" as const, stiffness: 260, damping: 20, delay },
        };

  return (
    <div className="grid min-h-screen md:grid-cols-2">
      {/* Left: brand + capability boot sequence — the "landing" half.
          Hidden below md; small screens get a compact brand header above
          the form instead, so the console identity still shows up there. */}
      <div className="hidden flex-col justify-center border-r border-line bg-panel-2 px-12 py-12 md:flex lg:px-20">
        <motion.div {...spring(0)}>
          <Brand />
        </motion.div>

        <div className="mt-10 flex flex-col gap-2.5">
          {BOOT_LINES.map((line, i) => (
            <BootLine key={line} text={line} index={i} />
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: reduced ? 0 : 0.55 + BOOT_LINES.length * 0.32 + 0.3, duration: 0.4 }}
          className="mt-10 max-w-[380px] text-[13px] leading-relaxed text-muted"
        >
          A digital forensic triage console — hash-verified evidence, an unbroken chain of
          custody, and cross-OS log, financial, and media analysis in one place.
        </motion.div>
      </div>

      {/* Right: the login form */}
      <div className="grid place-items-center p-5">
        <div className="w-full max-w-[380px]">
          <motion.div {...spring(0)} className="mb-6 md:hidden">
            <Brand compact />
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 180, opacity: [0, 1, 0.65, 1] }}
              transition={
                reduced
                  ? { duration: 0 }
                  : {
                      width: { duration: 0.4, delay: 0.22, ease: "easeOut" },
                      opacity: {
                        duration: 2.6,
                        delay: 0.22,
                        repeat: Infinity,
                        repeatType: "reverse",
                        ease: "easeInOut",
                        times: [0, 0.15, 0.6, 1],
                      },
                    }
              }
              className="mx-auto mt-2.5 h-[3px] rounded-full bg-phosphor"
            />
          </motion.div>

          <motion.div {...spring(0.14)}>
            <Card>
              <CardContent>
                <form onSubmit={submit} className="flex flex-col gap-1">
                  <label
                    htmlFor="u"
                    className="mb-1 mt-2 text-xs uppercase tracking-[0.04em] text-muted"
                  >
                    Investigator ID
                  </label>
                  <Input
                    id="u"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username"
                    autoFocus
                    required
                  />
                  <label
                    htmlFor="p"
                    className="mb-1 mt-3 text-xs uppercase tracking-[0.04em] text-muted"
                  >
                    Password
                  </label>
                  <Input
                    id="p"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                  />

                  <AnimatePresence initial={false}>
                    {error && (
                      <motion.div {...errorMotion} className="mt-3 text-sm text-red">
                        {error}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <motion.div whileHover={{ scale: 1.015 }} whileTap={{ scale: 0.98 }} className="mt-4">
                    <Button type="submit" disabled={busy} className="w-full">
                      {busy && <Loader2 className="animate-spin" />}
                      {busy ? "Verifying…" : "Open console"}
                    </Button>
                  </motion.div>

                  <p className="mt-3.5 font-mono text-[12px] text-muted">
                    First run creates a default admin — its one-time password is
                    printed in the server console on first startup.
                  </p>
                </form>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
