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
    <div className="min-h-screen w-full flex flex-col bg-background text-foreground">
      <div className="bg-sidebar text-sidebar-foreground px-6 py-4 flex items-center gap-2">
        <Shield className="h-5 w-5" />
        <div>
          <div className="font-semibold">IntelTrace</div>
          <div className="text-xs opacity-75">Cybercrime Evidence Investigation System</div>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Lock className="h-4 w-4" /> Login</CardTitle>
            <CardDescription>Enter your details and select a role to continue.</CardDescription>
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
              <Button type="submit" className="w-full">Login</Button>
              <p className="text-xs text-muted-foreground text-center">Note: this is a demo login, any values will work.</p>
              <Link to="/" className="block text-center text-xs text-muted-foreground hover:underline">Skip to dashboard</Link>
            </form>
          </CardContent>
        </Card>
      </div>
      <div className="px-6 py-3 text-center text-xs text-muted-foreground">
        Mini Project by Team 04 — R. Nair, A. Kapoor, M. Sharma, P. Desai
      </div>
    </div>
  );
}