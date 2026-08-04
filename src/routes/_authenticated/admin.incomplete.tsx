import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatDate, money } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/incomplete")({
  component: Incomplete,
});

type Row = {
  id: string;
  amount_cents: number;
  created_at: string;
  customer_id: string;
  services: { name: string } | null;
  customers: { first_name: string; last_name: string; email: string } | null;
};

function ageLabel(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "1 day old";
  return `${days} days old`;
}

function Incomplete() {
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["admin", "incomplete"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(
          "id, amount_cents, created_at, customer_id, services(name), customers(first_name, last_name, email)",
        )
        .eq("payment_status", "unpaid")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  const potential = orders.reduce((s, o) => s + o.amount_cents, 0);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Incomplete checkouts</h1>
        <p className="text-sm text-muted-foreground">
          Orders where checkout was never completed. Tracked for conversion only — no work is
          scheduled for these.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Incomplete orders</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">{orders.length}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Potential revenue</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">{money(potential)}</p>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : orders.length === 0 ? (
        <p className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
          No abandoned checkouts. Nice.
        </p>
      ) : (
        <ul className="space-y-2">
          {orders.map((o) => (
            <li
              key={o.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4"
            >
              <div className="min-w-[14rem]">
                <p className="text-sm font-semibold text-foreground">
                  {o.customers
                    ? `${o.customers.first_name} ${o.customers.last_name}`
                    : "Unknown customer"}
                </p>
                <p className="text-xs text-muted-foreground">{o.customers?.email}</p>
                <p className="mt-1 text-sm text-foreground">{o.services?.name ?? "Service"}</p>
              </div>
              <div className="text-right text-xs text-muted-foreground">
                <p className="text-sm font-semibold text-foreground">{money(o.amount_cents)}</p>
                <p>{formatDate(o.created_at)}</p>
                <p>{ageLabel(o.created_at)}</p>
                <Link
                  to="/admin/customers/$id"
                  params={{ id: o.customer_id }}
                  className="text-primary hover:underline"
                >
                  Open customer
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
