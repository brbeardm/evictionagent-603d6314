import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatDate, titleize } from "@/lib/format";

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
  const { data: customers = [], isLoading } = useQuery({
    queryKey: ["admin", "customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id, first_name, last_name, email, phone, city, precinct, source, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return customers;
    return customers.filter((c) =>
      [c.first_name, c.last_name, c.email, c.phone, c.city, c.precinct]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [customers, q]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-foreground">Customers</h1>

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
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-secondary/50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">City / Precinct</th>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {isLoading && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-muted-foreground">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-muted-foreground">
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
                <td className="px-4 py-3 text-muted-foreground">{titleize(c.source)}</td>
                <td className="px-4 py-3 text-muted-foreground">{formatDate(c.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
