import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { addStaffByEmail, listStaff, setStaffRole } from "@/lib/account.functions";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/team")({
  head: () => ({
    meta: [
      { title: "Team — EvictionAgent Staff Console" },
      { name: "description", content: "Manage EvictionAgent staff members and their roles." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Team — EvictionAgent Staff Console" },
      { property: "og:description", content: "Manage staff members and their roles." },
    ],
  }),
  component: TeamPage,
});

function TeamPage() {
  const queryClient = useQueryClient();
  const fetchStaff = useServerFn(listStaff);
  const changeRole = useServerFn(setStaffRole);
  const addStaff = useServerFn(addStaffByEmail);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["staff"],
    queryFn: () => fetchStaff(),
  });

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["staff"] });
  }

  async function handleRole(id: string, role: "staff" | "admin") {
    try {
      await changeRole({ data: { id, role } });
      toast.success("Role updated");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update role");
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await addStaff({ data: { email } });
      toast.success("Staff member added");
      setEmail("");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add staff member");
    } finally {
      setBusy(false);
    }
  }

  if (error) {
    return (
      <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
        Only admins can manage the team.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Team</h1>
        <p className="mt-1 text-sm text-muted-foreground">Staff with access to this console.</p>
      </div>

      <form onSubmit={handleAdd} className="flex flex-wrap gap-2 rounded-xl border border-border bg-card p-4">
        <input
          type="email"
          required
          placeholder="teammate@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="min-w-[14rem] flex-1 rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          {busy ? "Adding…" : "Add staff by email"}
        </button>
      </form>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {isLoading ? (
          <p className="p-4 text-sm text-muted-foreground">Loading…</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Added</th>
                <th className="px-4 py-2 font-medium">Role</th>
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((p) => (
                <tr key={p.id} className="border-t border-border/60">
                  <td className="px-4 py-3 text-foreground">{p.full_name ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(p.created_at)}</td>
                  <td className="px-4 py-3">
                    <select
                      value={p.role}
                      onChange={(e) => void handleRole(p.id, e.target.value as "staff" | "admin")}
                      className="rounded-lg border border-input bg-card px-2 py-1 text-sm"
                    >
                      <option value="staff">Staff</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
