import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  addStaffByEmail,
  listStaffAccounts,
  purgeStaff,
  setStaffRole,
} from "@/lib/account.functions";
import { formatDate } from "@/lib/format";
import { AccountControls, StatusBadge } from "@/components/admin/AccountControls";

export const Route = createFileRoute("/_authenticated/admin/team")({
  head: () => ({
    meta: [
      { title: "Team — EvictionAgent Staff Console" },
      { name: "description", content: "Manage EvictionAgent staff members, roles and account access." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Team — EvictionAgent Staff Console" },
      { property: "og:description", content: "Manage staff members, roles and account access." },
    ],
  }),
  component: TeamPage,
});

function TeamPage() {
  const queryClient = useQueryClient();
  const fetchStaff = useServerFn(listStaffAccounts);
  const changeRole = useServerFn(setStaffRole);
  const addStaff = useServerFn(addStaffByEmail);
  const removeStaff = useServerFn(purgeStaff);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["staff-accounts"],
    queryFn: () => fetchStaff(),
  });

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["staff-accounts"] });
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
      const res = await addStaff({ data: { email } });
      toast.success(res?.message ?? "Staff member added");
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
        <p className="mt-1 text-sm text-muted-foreground">
          Staff with access to this console. Disabling an account blocks sign-in but keeps all records.
        </p>
      </div>

      <form
        onSubmit={handleAdd}
        className="flex flex-wrap gap-2 rounded-xl border border-border bg-card p-4"
      >
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

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        {isLoading ? (
          <p className="p-4 text-sm text-muted-foreground">Loading…</p>
        ) : (
          <table className="w-full min-w-[46rem] text-sm">
            <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Email</th>
                <th className="px-4 py-2 font-medium">Added</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Role</th>
                <th className="px-4 py-2 text-right font-medium">Account</th>
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((p) => (
                <tr key={p.id} className="border-t border-border/60">
                  <td className="px-4 py-3 text-foreground">{p.full_name ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{p.email ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(p.created_at)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={p.status} />
                  </td>
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
                  <td className="px-4 py-3 text-right">
                    <AccountControls
                      userId={p.id}
                      email={p.email}
                      status={p.status}
                      name={p.full_name ?? p.email ?? "this staff member"}
                      purgeWarning="Their login and staff profile are deleted for good."
                      onPurge={async () => {
                        await removeStaff({ data: { userId: p.id } });
                      }}
                      onChanged={refresh}
                    />
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
