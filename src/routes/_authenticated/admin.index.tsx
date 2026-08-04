import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, DollarSign, FolderOpen, ShoppingCart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatDate, money, titleize } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: Dashboard,
});

function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "dashboard"],
    queryFn: async () => {
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      const [activeCases, monthOrders, paidOrders, events] = await Promise.all([
        supabase
          .from("cases")
          .select("id", { count: "exact", head: true })
          .neq("stage", "closed"),
        supabase
          .from("orders")
          .select("id", { count: "exact", head: true })
          .gte("created_at", monthStart.toISOString()),
        supabase.from("orders").select("amount_cents").eq("payment_status", "paid"),
        supabase
          .from("case_events")
          .select("id, title, due_date, next_step, event_type, case_id, cases(customer_id, customers(first_name, last_name))")
          .is("completed_at", null)
          .not("due_date", "is", null)
          .order("due_date", { ascending: true })
          .limit(12),
      ]);

      const revenue = (paidOrders.data ?? []).reduce(
        (sum: number, o: { amount_cents: number }) => sum + o.amount_cents,
        0,
      );

      return {
        activeCases: activeCases.count ?? 0,
        monthOrders: monthOrders.count ?? 0,
        revenue,
        events: (events.data ?? []) as EventRow[],
      };
    },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-foreground">Dashboard</h1>

      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi
          icon={FolderOpen}
          label="Active cases"
          value={isLoading ? "…" : String(data?.activeCases ?? 0)}
        />
        <Kpi
          icon={ShoppingCart}
          label="Orders this month"
          value={isLoading ? "…" : String(data?.monthOrders ?? 0)}
        />
        <Kpi
          icon={DollarSign}
          label="Revenue (paid)"
          value={isLoading ? "…" : money(data?.revenue ?? 0)}
        />
      </div>

      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <CalendarClock className="h-4 w-4 text-primary" /> Upcoming key dates
        </h2>
        {isLoading ? (
          <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
        ) : (data?.events.length ?? 0) === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            No open deadlines or tasks yet.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-border/60">
            {data!.events.map((e) => {
              const customer = e.cases?.customers;
              return (
                <li key={e.id} className="flex flex-wrap items-start justify-between gap-2 py-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">{e.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {titleize(e.event_type)}
                      {customer ? ` · ${customer.first_name} ${customer.last_name}` : ""}
                    </p>
                    {e.next_step && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Next step: {e.next_step}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-foreground">
                      {formatDate(e.due_date)}
                    </p>
                    {e.cases?.customer_id && (
                      <Link
                        to="/admin/customers/$id"
                        params={{ id: e.cases.customer_id }}
                        className="text-xs text-primary hover:underline"
                      >
                        Open case
                      </Link>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

type EventRow = {
  id: string;
  title: string;
  due_date: string | null;
  next_step: string | null;
  event_type: string;
  case_id: string;
  cases: {
    customer_id: string;
    customers: { first_name: string; last_name: string } | null;
  } | null;
};

function Kpi({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
    </div>
  );
}
