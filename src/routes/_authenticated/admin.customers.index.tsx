import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { formatDate, titleize } from "@/lib/format";
import { useSessionUser } from "@/hooks/useSessionUser";
import { listCustomerAccounts, purgeCustomer } from "@/lib/account.functions";
import { AccountControls, StatusBadge } from "@/components/admin/AccountControls";

export const Route = createFileRoute("/_authenticated/admin/customers/")({
  component: CustomersList,
});

type Row = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  city: string | null;
  precinct: string | null;
  source: string;
  created_at: string;
};

function CustomersList() {
  const [q, setQ] = useState("");
  const { isAdmin, loading: sessionLoading } = useSessionUser();
  const queryClient = useQueryClient();
  const fetchAccounts = useServerFn(listCustomerAccounts);
  const removeCustomer = useServerFn(purgeCustomer);

  const basic = useQuery({
    queryKey: ["admin", "customers"],
    enabled: !sessionLoading && !isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id, first_name, last_name, email, phone, city, precinct, source, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const accounts = useQuery({
    queryKey: ["admin", "customer-accounts"],
    enabled: !sessionLoading && isAdmin,
    queryFn: () => fetchAccounts(),
  });

  const isLoading = sessionLoading || (isAdmin ? accounts.isLoading : basic.isLoading);
  const rows = useMemo(
    () =>
      (isAdmin ? accounts.data ?? [] : (basic.data ?? []).map((c) => ({ ...c, user_id: null, order_count: 0, status: "none" as const }))) as Array<
        Row & { user_id: string | null; order_count: number; status: "active" | "disabled" | "none" }
      >,
    [isAdmin, accounts.data, basic.data],
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((c) =>
      [c.first_name, c.last_name, c.email, c.phone, c.city, c.precinct]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [rows, q]);

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["admin", "customer-accounts"] });
    await queryClient.invalidateQueries({ queryKey: ["admin", "customers"] });
  }

  const colCount = isAdmin ? 6 : 5;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Customers</h1>
        {isAdmin && (
          <p className="mt-1 text-sm text-muted-foreground">
            Manage customer logins. Disabling blocks sign-in but keeps cases, orders and receipts.
          </p>
        )}
      </div>

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, email, phone, precinct…"
          className="w-full rounded-lg border border-input bg-card py-2 pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
        />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full min-w-[44rem] text-left text-sm">
          <thead className="border-b border-border bg-secondary/50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">City / Precinct</th>
              {isAdmin ? (
                <>
                  <th className="px-4 py-3">Account</th>
                  <th className="px-4 py-3">Orders</th>
                </>
              ) : (
                <th className="px-4 py-3">Source</th>
              )}
              <th className="px-4 py-3">Created</th>
              {isAdmin && <th className="px-4 py-3 text-right">Manage</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {isLoading && (
              <tr>
                <td colSpan={colCount + 1} className="px-4 py-6 text-muted-foreground">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && filtered.length === 0 && (
              <tr>
                <td colSpan={colCount + 1} className="px-4 py-6 text-muted-foreground">
                  No customers found.
                </td>
              </tr>
            )}
            {filtered.map((c) => (
              <tr key={c.id} className="hover:bg-secondary/40">
                <td className="px-4 py-3">
                  <Link
                    to="/admin/customers/$id"
                    params={{ id: c.id }}
                    className="font-medium text-primary hover:underline"
                  >
                    {c.first_name} {c.last_name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  <div>{c.email}</div>
                  <div>{c.phone ?? "—"}</div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {[c.city, c.precinct].filter(Boolean).join(" · ") || "—"}
                </td>
                {isAdmin ? (
                  <>
                    <td className="px-4 py-3">
                      <StatusBadge status={c.status} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{c.order_count}</td>
                  </>
                ) : (
                  <td className="px-4 py-3 text-muted-foreground">
                    {titleize((c as unknown as Row).source ?? "")}
                  </td>
                )}
                <td className="px-4 py-3 text-muted-foreground">{formatDate(c.created_at)}</td>
                {isAdmin && (
                  <td className="px-4 py-3 text-right">
                    <AccountControls
                      userId={c.user_id}
                      email={c.email}
                      status={c.status}
                      name={`${c.first_name} ${c.last_name}`}
                      purgeWarning="Their login, case, orders, payment receipts and court-filing history are deleted for good."
                      onPurge={async () => {
                        await removeCustomer({ data: { customerId: c.id } });
                      }}
                      onChanged={refresh}
                    />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
