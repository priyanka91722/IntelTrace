import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Shield, Lock } from "lucide-react";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — IntelTrace" },
      { name: "description", content: "Secure sign-in for investigators, forensic analysts, and administrators." },
      { property: "og:title", content: "IntelTrace Sign in" },
      { property: "og:description", content: "Secure sign-in for investigators and forensic analysts." },
    ],
  }),
  component: Login,
});

function Login() {
  const navigate = useNavigate();
  const [role, setRole] = useState("lead");
  return (
    <div className="min-h-screen w-full grid lg:grid-cols-2 bg-background text-foreground">
      <div className="hidden lg:flex flex-col justify-between p-10 bg-sidebar border-r border-border">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/15 text-primary ring-1 ring-primary/30">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <div className="text-lg font-semibold tracking-wide">IntelTrace</div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Cybercrime Evidence Console</div>
          </div>
        </div>
        <div className="space-y-4 max-w-md">
          <div className="text-xs uppercase tracking-widest text-primary">Restricted access</div>
          <h2 className="text-3xl font-semibold leading-tight">Chain-of-custody grade digital forensics for modern cyber cells.</h2>
          <p className="text-sm text-muted-foreground">Hash-verified evidence intake, AI-assisted anomaly detection, deepfake verification, and Section 65B report generation — in one auditable console.</p>
        </div>
        <div className="text-xs text-muted-foreground">
          Authorized use only. All actions are logged in the chain of custody register.
        </div>
      </div>

      <div className="flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Lock className="h-4 w-4 text-primary" /> Investigator Sign-in</CardTitle>
            <CardDescription>Enter your credentials and select your assigned role.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                navigate({ to: "/" });
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="badge">Badge / Email</Label>
                <Input id="badge" defaultValue="r.nair@cybercell.gov" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pwd">Password</Label>
                <Input id="pwd" type="password" defaultValue="••••••••" />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <RadioGroup value={role} onValueChange={setRole} className="grid grid-cols-3 gap-2">
                  {[
                    { v: "admin", l: "Admin" },
                    { v: "lead", l: "Lead Investigator" },
                    { v: "viewer", l: "Viewer" },
                  ].map((r) => (
                    <Label
                      key={r.v}
                      htmlFor={`r-${r.v}`}
                      className={`flex cursor-pointer items-center justify-center gap-2 rounded-md border border-border px-3 py-2 text-xs transition ${role === r.v ? "border-primary bg-primary/10 text-primary" : "hover:bg-accent/40"}`}
                    >
                      <RadioGroupItem id={`r-${r.v}`} value={r.v} className="sr-only" />
                      {r.l}
                    </Label>
                  ))}
                </RadioGroup>
              </div>
              <Button type="submit" className="w-full">Enter Console</Button>
              <p className="text-[11px] text-muted-foreground text-center">Demo build — any credentials will sign you in.</p>
              <Link to="/" className="block text-center text-xs text-muted-foreground hover:text-primary">Skip to dashboard</Link>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}