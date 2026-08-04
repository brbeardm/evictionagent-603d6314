import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DISPOSITIONS, formatDate, money, titleize, type Disposition } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/pipeline")({
  component: Pipeline,
});

type OrderRow = {
  id: string;
  amount_cents: number;
  payment_status: string;
  disposition: Disposition;
  created_at: string;
  customer_id: string;
  services: { name: string } | null;
  customers: { first_name: string; last_name: string } | null;
};

function Pipeline() {
  const queryClient = useQueryClient();
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["admin", "orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(
          "id, amount_cents, payment_status, disposition, created_at, customer_id, services(name), customers(first_name, last_name)",
        )
        .eq("payment_status", "paid")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as OrderRow[];
    },
  });

  const move = useMutation({
    mutationFn: async ({ id, disposition }: { id: string; disposition: Disposition }) => {
      const { error } = await supabase.from("orders").update({ disposition }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not move card"),
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Pipeline</h1>
        <p className="text-sm text-muted-foreground">
          Paid orders only. Drag a card to a new column to change its disposition.
        </p>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading orders…</p>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {DISPOSITIONS.map((col) => {
            const cards = orders.filter((o) => o.disposition === col);
            return (
              <div
                key={col}
                onDragOver={(e) => {
                  e.preventDefault();
                  setOverCol(col);
                }}
                onDragLeave={() => setOverCol((c) => (c === col ? null : c))}
                onDrop={() => {
                  setOverCol(null);
                  if (dragId) {
                    const card = orders.find((o) => o.id === dragId);
                    if (card && card.disposition !== col) {
                      move.mutate({ id: dragId, disposition: col });
                    }
                  }
                  setDragId(null);
                }}
                className={`w-64 shrink-0 rounded-xl border p-3 transition-colors ${
                  overCol === col ? "border-primary bg-primary/5" : "border-border bg-card/60"
                }`}
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {titleize(col)}
                  </h2>
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                    {cards.length}
                  </span>
                </div>

                <div className="mt-3 space-y-2">
                  {cards.map((o) => (
                    <div
                      key={o.id}
                      draggable
                      onDragStart={() => setDragId(o.id)}
                      onDragEnd={() => setDragId(null)}
                      className="cursor-grab rounded-lg border border-border bg-card p-3 shadow-sm active:cursor-grabbing"
                    >
                      <p className="text-sm font-medium text-foreground">
                        {o.customers
                          ? `${o.customers.first_name} ${o.customers.last_name}`
                          : "Unknown customer"}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {o.services?.name ?? "Service"}
                      </p>
                      <div className="mt-2 flex items-center justify-between text-xs">
                        <span className="font-semibold text-foreground">
                          {money(o.amount_cents)}
                        </span>
                        <span
                          className={
                            o.payment_status === "paid"
                              ? "rounded-full bg-accent px-2 py-0.5 text-accent-foreground"
                              : "text-muted-foreground"
                          }
                        >
                          {titleize(o.payment_status)}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                        <span>{formatDate(o.created_at)}</span>
                        <Link
                          to="/admin/customers/$id"
                          params={{ id: o.customer_id }}
                          className="text-primary hover:underline"
                        >
                          Open
                        </Link>
                      </div>
                    </div>
                  ))}
                  {cards.length === 0 && (
                    <p className="rounded-lg border border-dashed border-border/70 p-3 text-xs text-muted-foreground">
                      Drop here
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
