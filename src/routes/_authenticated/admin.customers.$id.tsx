import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Gavel, Truck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CaseEventsPanel } from "@/components/CaseEventsPanel";
import { formatDate, money, titleize } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/customers/$id")({
  component: CustomerDetail,
});

type CaseRow = {
  id: string;
  cause_number: string | null;
  court_precinct: string | null;
  filing_date: string | null;
  trial_date: string | null;
  judgment_date: string | null;
  judgment_result: string;
  appeal_deadline: string | null;
  writ_earliest: string | null;
  stage: string;
  notes: string | null;
};


type OrderRow = {
  id: string;
  amount_cents: number;
  payment_status: string;
  disposition: string;
  created_at: string;
  services: { name: string } | null;
};

function CustomerDetail() {
  const { id } = Route.useParams();

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "customer", id],
    queryFn: async () => {
      const { data: customer, error } = await supabase
        .from("customers")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;

      const { data: cases } = await supabase
        .from("cases")
        .select("*")
        .eq("customer_id", id)
        .order("created_at", { ascending: true });

      const caseRow = ((cases ?? [])[0] ?? null) as CaseRow | null;

      const orders = await supabase
        .from("orders")
        .select("id, amount_cents, payment_status, disposition, created_at, services(name)")
        .eq("customer_id", id)
        .order("created_at", { ascending: false });

      return {
        customer,
        caseRow,
        orders: (orders.data ?? []) as OrderRow[],
      };
    },
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!data?.customer)
    return <p className="text-sm text-muted-foreground">Customer not found.</p>;

  const c = data.customer as Record<string, string | null>;
  const k = data.caseRow;

  return (
    <div className="space-y-5">
      <Link
        to="/admin/customers"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Customers
      </Link>

      <section className="rounded-2xl border border-border bg-card p-5">
        <h1 className="text-xl font-semibold text-foreground">
          {c["first_name"]} {c["last_name"]}
        </h1>
        <div className="mt-3 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
          <p>{c["email"]}</p>
          <p>{c["phone"] ?? "—"}</p>
          <p className="sm:col-span-2">
            {[c["address"], c["city"], c["zip"]].filter(Boolean).join(", ") || "—"}
          </p>
          <p>Precinct: {c["precinct"] ?? "—"}</p>
          <p>Source: {titleize(c["source"])}</p>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        <Highlight
          icon={Gavel}
          label="Appeal deadline"
          value={formatDate(k?.appeal_deadline)}
          hint="5 days after judgment under TRCP 510.9"
        />
        <Highlight
          icon={Truck}
          label="Writ earliest"
          value={formatDate(k?.writ_earliest)}
          hint="Earliest a writ of possession may issue"
        />
      </div>

      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold text-foreground">Case timeline</h2>
        {!k ? (
          <p className="mt-3 text-sm text-muted-foreground">No case on file.</p>
        ) : (
          <>
            <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              <Detail label="Cause number" value={k.cause_number ?? "—"} />
              <Detail label="Court precinct" value={k.court_precinct ?? "—"} />
              <Detail label="Stage" value={titleize(k.stage)} />
              <Detail label="Judgment result" value={titleize(k.judgment_result)} />
              <Detail label="Filed" value={formatDate(k.filing_date)} />
              <Detail label="Trial" value={formatDate(k.trial_date)} />
              <Detail label="Judgment" value={formatDate(k.judgment_date)} />
            </div>
            {k.notes && (
              <p className="mt-4 rounded-lg bg-secondary/60 p-3 text-sm text-muted-foreground">
                {k.notes}
              </p>
            )}
          </>
        )}
      </section>

      {k && <CaseEventsPanel caseId={k.id} />}


      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold text-foreground">Orders</h2>
        {data.orders.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No orders yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border/60">
            {data.orders.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {o.services?.name ?? "Service"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {titleize(o.disposition)} · {formatDate(o.created_at)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-foreground">
                    {money(o.amount_cents)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {titleize(o.payment_status)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <p className="text-muted-foreground">
      <span className="text-xs uppercase tracking-wide">{label}: </span>
      <span className="font-medium text-foreground">{value}</span>
    </p>
  );
}

function Highlight({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-1 text-xl font-semibold text-foreground">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
