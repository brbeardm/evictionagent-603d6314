import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { CalendarClock, CheckCircle2, DollarSign, FolderOpen, Receipt } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatDate, money } from "@/lib/format";
import { BUCKETS, bucketOf, relativeLabel, toDateInput, type Bucket } from "@/lib/events";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: Dashboard,
});

type QueueRow = {
  id: string;
  title: string;
  due_date: string | null;
  next_step: string | null;
  event_type: string;
  case_id: string;
  order_id: string | null;
  cases: {
    customer_id: string;
    customers: { first_name: string; last_name: string } | null;
  } | null;
  orders: {
    assigned_to: string | null;
    services: { name: string } | null;
  } | null;
};

function Dashboard() {
  const queryClient = useQueryClient();
  const [mine, setMine] = useState(false);

  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: async () => (await supabase.auth.getUser()).data.user?.id ?? null,
  });

  const { data: agents = {} } = useQuery({
    queryKey: ["admin", "agents"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name");
      return Object.fromEntries((data ?? []).map((p) => [p.id, p.full_name ?? "Agent"]));
    },
  });

  const { data: kpis } = useQuery({
    queryKey: ["admin", "kpis"],
    queryFn: async () => {
      const [activeCases, unpaid, paid] = await Promise.all([
        supabase.from("cases").select("id", { count: "exact", head: true }).neq("stage", "closed"),
        supabase
          .from("orders")
          .select("id", { count: "exact", head: true })
          .eq("payment_status", "unpaid"),
        supabase.from("orders").select("amount_cents").eq("payment_status", "paid"),
      ]);
      return {
        activeCases: activeCases.count ?? 0,
        unpaid: unpaid.count ?? 0,
        revenue: (paid.data ?? []).reduce((s, o) => s + o.amount_cents, 0),
      };
    },
  });

  const { data: paidCaseIds } = useQuery({
    queryKey: ["admin", "paid-case-ids"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("case_id")
        .eq("payment_status", "paid")
        .not("case_id", "is", null);
      if (error) throw error;
      return new Set((data ?? []).map((o) => o.case_id as string));
    },
  });

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["admin", "queue"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("case_events")
        .select(
          "id, title, due_date, next_step, event_type, case_id, order_id, cases(customer_id, customers(first_name, last_name)), orders(assigned_to, services(name))",
        )
        .is("completed_at", null)
        .order("due_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as unknown as QueueRow[];
    },
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["admin"] });
  };

  const markDone = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("case_events")
        .update({ completed_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Marked done");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reschedule = useMutation({
    mutationFn: async ({ id, due }: { id: string; due: string }) => {
      const { error } = await supabase.from("case_events").update({ due_date: due }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Rescheduled");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    const paidOnly = paidCaseIds ? events.filter((e) => paidCaseIds.has(e.case_id)) : [];
    return mine && me ? paidOnly.filter((e) => e.orders?.assigned_to === me) : paidOnly;
  }, [events, mine, me, paidCaseIds]);

  const grouped = useMemo(() => {
    const g: Record<Bucket, QueueRow[]> = { overdue: [], soon: [], upcoming: [] };
    for (const e of filtered) g[bucketOf(e.due_date)].push(e);
    return g;
  }, [filtered]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-foreground">Action queue</h1>
        <div className="inline-flex rounded-full border border-border bg-card p-1 text-xs font-medium">
          <button
            type="button"
            onClick={() => setMine(true)}
            className={`rounded-full px-3 py-1 ${mine ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
          >
            My items
          </button>
          <button
            type="button"
            onClick={() => setMine(false)}
            className={`rounded-full px-3 py-1 ${!mine ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
          >
            All items
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi icon={FolderOpen} label="Active cases" value={String(kpis?.activeCases ?? "…")} />
        <Kpi icon={Receipt} label="Unpaid orders" value={String(kpis?.unpaid ?? "…")} />
        <Kpi icon={DollarSign} label="Revenue (paid)" value={money(kpis?.revenue ?? 0)} />
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
          Nothing open right now.
        </p>
      ) : (
        BUCKETS.map((b) =>
          grouped[b.key].length === 0 ? null : (
            <section key={b.key} className="space-y-2">
              <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <span className={`h-2 w-2 rounded-full ${b.dot}`} />
                {b.label} · {grouped[b.key].length}
              </h2>
              <ul className="space-y-2">
                {grouped[b.key].map((e) => (
                  <li key={e.id} className={`rounded-2xl border p-4 ${b.tone}`}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-[16rem] flex-1">
                        <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
                          <CalendarClock className="h-4 w-4 text-primary" />
                          {formatDate(e.due_date)}
                          <span
                            className={`text-xs font-medium ${b.key === "overdue" ? "text-destructive" : b.key === "soon" ? "text-amber-600" : "text-muted-foreground"}`}
                          >
                            {relativeLabel(e.due_date)}
                          </span>
                        </p>
                        <p className="mt-1 text-sm font-medium text-foreground">{e.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {e.cases?.customers
                            ? `${e.cases.customers.first_name} ${e.cases.customers.last_name}`
                            : "Unknown customer"}
                          {e.orders?.services?.name ? ` · ${e.orders.services.name}` : ""}
                          {e.orders?.assigned_to
                            ? ` · ${agents[e.orders.assigned_to] ?? "Assigned"}`
                            : " · Unassigned"}
                        </p>
                        {e.next_step && (
                          <p className="mt-2 text-sm text-muted-foreground">{e.next_step}</p>
                        )}
                        {e.cases?.customer_id && (
                          <Link
                            to="/admin/customers/$id"
                            params={{ id: e.cases.customer_id }}
                            className="mt-2 inline-block text-xs text-primary hover:underline"
                          >
                            Open case →
                          </Link>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <button
                          type="button"
                          onClick={() => markDone.mutate(e.id)}
                          className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" /> Mark done
                        </button>
                        <input
                          type="date"
                          aria-label="Reschedule"
                          value={toDateInput(e.due_date)}
                          onChange={(ev) =>
                            ev.target.value &&
                            reschedule.mutate({ id: e.id, due: ev.target.value })
                          }
                          className="rounded-lg border border-border bg-background px-2 py-1 text-xs text-foreground"
                        />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ),
        )
      )}
    </div>
  );
}

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
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-1 text-xl font-semibold text-foreground">{value}</p>
    </div>
  );
}
