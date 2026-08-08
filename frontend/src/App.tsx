import type { ReactNode } from "react";
import { BrowserRouter, Routes, Route, Navigate, Link, useNavigate, useLocation } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import { getAuth, setAuth } from "./api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { useFadeIn, tapScale } from "@/lib/motion";
import { ROLE_BADGE_VARIANT } from "@/lib/roles";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import CasePage from "./pages/CasePage";
import Admin from "./pages/Admin";

function TopBar() {
  const auth = getAuth();
  const nav = useNavigate();
  const fadeIn = useFadeIn();

  return (
    <motion.header
      {...fadeIn}
      className="sticky top-0 z-20 flex h-14 items-center gap-4 border-b border-line bg-panel-2 px-4 sm:px-6"
    >
      <Link to="/" className="font-mono text-[17px] font-bold tracking-wide text-text">
        Intel<b className="text-phosphor">Trace</b>
      </Link>
      <span className="hidden text-[11.5px] uppercase tracking-[0.12em] text-muted sm:inline">
        forensic triage console
      </span>
      <div className="flex-1" />
      {auth?.role === "admin" && (
        <motion.div whileTap={tapScale}>
          <Button asChild variant="ghost" size="sm">
            <Link to="/admin">Users</Link>
          </Button>
        </motion.div>
      )}
      <span className="hidden font-mono text-[12.5px] text-muted sm:inline">
        {auth?.username}
      </span>
      {auth?.role && (
        <Badge variant={ROLE_BADGE_VARIANT[auth.role] ?? "outline"} className="uppercase">
          {auth.role}
        </Badge>
      )}
      <motion.div whileTap={tapScale}>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setAuth(null);
            nav("/login");
          }}
        >
          Log out
        </Button>
      </motion.div>
    </motion.header>
  );
}

function Protected({ children }: { children: ReactNode }) {
  const location = useLocation();
  const reduced = useReducedMotion();
  if (!getAuth()) return <Navigate to="/login" replace />;
  return (
    <>
      <TopBar />
      <main className="mx-auto w-full max-w-[1180px] px-4 pb-20 pt-6 sm:px-6">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: reduced ? 0 : 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduced ? 0 : 0.22, ease: "easeOut" }}
        >
          {children}
        </motion.div>
      </main>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <Protected>
              <Dashboard />
            </Protected>
          }
        />
        <Route
          path="/cases/:caseId"
          element={
            <Protected>
              <CasePage />
            </Protected>
          }
        />
        <Route
          path="/admin"
          element={
            <Protected>
              <Admin />
            </Protected>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster position="top-right" />
    </BrowserRouter>
  );
}
