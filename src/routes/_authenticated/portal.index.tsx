import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatDate, money } from "@/lib/format";
import { FRIENDLY_CASE_STAGE, FRIENDLY_DISPOSITION, FRIENDLY_PAYMENT, keyDateExplainer } from "@/lib/portal";

export const Route = createFileRoute("/_authenticated/portal/")({
  head: () => ({
    meta: [
      { title: "My Orders — EvictionAgent" },
      { name: "description", content: "Track your EvictionAgent orders and the key dates on your Texas eviction case." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "My Orders — EvictionAgent" },
      { property: "og:description", content: "Track your orders and key case dates." },
    ],
  }),
  component: MyOrdersPage,
});

async function loadPortal() {
  const { data: userRes } = await supabase.auth.getUser();
  const uid = userRes.user?.id;
  if (!uid) return null;

  const { data: customer } = await supabase
    .from("customers")
    .select("id, first_name, last_name")
    .eq("user_id", uid)
    .maybeSingle();
  if (!customer) return { customer: null, orders: [], cases: [], events: [] };

  const [{ data: orders }, { data: cases }] = await Promise.all([
    supabase
      .from("orders")
      .select("id, created_at, amount_cents, payment_status, disposition, case_id, services(name, description)")
      .eq("customer_id", customer.id)
      .order("created_at", { ascending: false }),
    supabase.from("cases").select("id, stage, cause_number, trial_date").eq("customer_id", customer.id),
  ]);

  const caseIds = (cases ?? []).map((c) => c.id);
  const { data: events } = caseIds.length
    ? await supabase
        .from("case_events")
        .select("id, case_id, title, due_date, completed_at")
        .in("case_id", caseIds)
        .eq("event_type", "deadline")
        .order("due_date", { ascending: true })
    : { data: [] };

  return { customer, orders: orders ?? [], cases: cases ?? [], events: events ?? [] };
}

function MyOrdersPage() {
  const { data, isLoading } = useQuery({ queryKey: ["portal"], queryFn: loadPortal });

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading your case…</p>;

  if (!data?.customer) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6">
        <h1 className="text-lg font-semibold text-foreground">No case linked yet</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          We couldn't find a case linked to this email. If you already submitted an intake, use the
          same email address you gave us, or{" "}
          <Link to="/start" className="text-primary underline-offset-4 hover:underline">
            start an intake
          </Link>
          .
        </p>
      </div>
    );
  }

  const { orders, cases, events } = data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">My orders</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Everything we're handling for you, and the dates that matter.
        </p>
      </div>

      {orders.length === 0 && (
        <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
          You don't have any orders yet.
        </p>
      )}

      {orders.map((order) => {
        const kase = cases.find((c) => c.id === order.case_id);
        const caseEvents = events
          .filter((e) => e.case_id === order.case_id && !e.completed_at)
          .slice(0, 4);
        return (
          <article key={order.id} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-foreground">
                  {order.services?.name ?? "Service"}
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Ordered {formatDate(order.created_at)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-foreground">{money(order.amount_cents)}</p>
                <p className="text-xs text-muted-foreground">
                  {FRIENDLY_PAYMENT[order.payment_status] ?? order.payment_status}
                </p>
              </div>
            </div>

            <span className="mt-3 inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              {FRIENDLY_DISPOSITION[order.disposition] ?? order.disposition}
            </span>

            {kase && (
              <div className="mt-5 rounded-xl bg-secondary/50 p-4">
                <h3 className="text-sm font-semibold text-foreground">Your case</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {FRIENDLY_CASE_STAGE[kase.stage] ?? kase.stage}
                  {kase.cause_number ? ` · Cause no. ${kase.cause_number}` : ""}
                </p>

                <h4 className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Key dates
                </h4>
                {caseEvents.length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">
                    No key dates yet — we'll add them as soon as the court sets them.
                  </p>
                ) : (
                  <ul className="mt-2 space-y-3">
                    {caseEvents.map((e) => (
                      <li key={e.id} className="flex gap-3">
                        <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {e.title} — {formatDate(e.due_date)}
                          </p>
                          <p className="text-xs text-muted-foreground">{keyDateExplainer(e.title)}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
