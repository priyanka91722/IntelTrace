import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { toast } from "sonner";
import { api, type User } from "../api";
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
import { Table, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useListStagger } from "@/lib/motion";
import { ROLE_BADGE_VARIANT } from "@/lib/roles";
import { cn } from "@/lib/utils";

interface NewUserForm {
  username: string;
  full_name: string;
  password: string;
  role: string;
}

interface PasswordChangeForm {
  userId: number;
  username: string;
  newPassword: string;
}

const EMPTY_FORM: NewUserForm = { username: "", full_name: "", password: "", role: "investigator" };
const EMPTY_PASSWORD_FORM: PasswordChangeForm = { userId: 0, username: "", newPassword: "" };

export default function Admin() {
  const [users, setUsers] = useState<User[]>([]);
  const [form, setForm] = useState<NewUserForm>(EMPTY_FORM);
  const [passwordForm, setPasswordForm] = useState<PasswordChangeForm>(EMPTY_PASSWORD_FORM);
  const [error, setError] = useState("");
  const { container, item } = useListStagger();

  const load = () =>
    api
      .get<User[]>("/api/auth/users")
      .then(setUsers)
      .catch((e) => setError(e.message));
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createUser(e: FormEvent) {
    e.preventDefault();
    try {
      await api.post("/api/auth/users", form);
      toast.success(`User ${form.username} created`);
      setForm(EMPTY_FORM);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  }

  async function removeUser(id: number) {
    if (!window.confirm("Remove this user?")) return;
    try {
      await api.del(`/api/auth/users/${id}`);
      toast.success("User removed");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  }

  async function changePassword(e: FormEvent) {
    e.preventDefault();
    if (!passwordForm.newPassword) return;
    try {
      await api.post(`/api/auth/users/${passwordForm.userId}/password`, {
        new_password: passwordForm.newPassword,
      });
      toast.success(`Password changed for ${passwordForm.username}`);
      setPasswordForm(EMPTY_PASSWORD_FORM);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <>
      <div className="mb-4 flex items-center gap-2">
        <Button asChild variant="outline" size="sm">
          <Link to="/">← Back to Dashboard</Link>
        </Button>
      </div>
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">Users &amp; roles</h1>
      <p className="mb-6 text-muted">
        Admin manages users. Investigators upload evidence and run analysis. Viewers can only read
        findings.
      </p>

      <Card className="mb-5">
        <CardContent>
          {passwordForm.userId ? (
            <form onSubmit={changePassword} className="flex flex-wrap items-end gap-2.5">
              <div className="flex-1">
                <label className="mb-1 block text-xs uppercase tracking-[0.04em] text-muted">
                  Change password for: {passwordForm.username}
                </label>
                <Input
                  type="password"
                  placeholder="New password (min 8 characters)"
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                  required
                  autoFocus
                />
              </div>
              <Button type="submit">Set Password</Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setPasswordForm(EMPTY_PASSWORD_FORM)}
              >
                Cancel
              </Button>
            </form>
          ) : (
            <form onSubmit={createUser} className="flex flex-wrap items-end gap-2.5">
              <div className="min-w-[150px] flex-1">
                <label className="mb-1 block text-xs uppercase tracking-[0.04em] text-muted">
                  Username
                </label>
                <Input
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  required
                />
              </div>
              <div className="min-w-[150px] flex-1">
                <label className="mb-1 block text-xs uppercase tracking-[0.04em] text-muted">
                  Full name
                </label>
                <Input
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                />
              </div>
              <div className="min-w-[150px] flex-1">
                <label className="mb-1 block text-xs uppercase tracking-[0.04em] text-muted">
                  Password
                </label>
                <Input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                />
              </div>
              <div className="min-w-[140px]">
                <label className="mb-1 block text-xs uppercase tracking-[0.04em] text-muted">
                  Role
                </label>
                <Select value={form.role} onValueChange={(role) => setForm({ ...form, role })}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="investigator">Investigator</SelectItem>
                    <SelectItem value="viewer">Viewer</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit">Add user</Button>
              {error && <div className="w-full text-sm text-red">{error}</div>}
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <motion.tbody
              variants={container}
              initial="hidden"
              animate="show"
              className={cn("[&_tr:last-child]:border-0")}
            >
              {users.map((u) => (
                <motion.tr key={u.id} variants={item} className="border-b border-line last:border-0">
                  <TableCell className="mono text-muted">{u.id}</TableCell>
                  <TableCell className="mono text-muted">{u.username}</TableCell>
                  <TableCell>{u.full_name}</TableCell>
                  <TableCell>
                    <Badge variant={ROLE_BADGE_VARIANT[u.role] ?? "outline"}>{u.role}</Badge>
                  </TableCell>
                  <TableCell className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setPasswordForm({ userId: u.id, username: u.username, newPassword: "" })
                      }
                    >
                      Change Password
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => removeUser(u.id)}>
                      Remove
                    </Button>
                  </TableCell>
                </motion.tr>
              ))}
            </motion.tbody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
