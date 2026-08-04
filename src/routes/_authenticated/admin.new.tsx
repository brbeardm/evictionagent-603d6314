import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { IntakeWizard } from "@/components/IntakeWizard";
import type { PublicService } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/new")({
  component: NewEntry,
});

function NewEntry() {
  const queryClient = useQueryClient();
  const { data: services = [], isLoading } = useQuery({
    queryKey: ["admin", "services"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("id, slug, name, description, stage, texas_authority, price_cents, sort_order")
        .eq("active", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as PublicService[];
    },
  });

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-foreground">New entry</h1>
        <p className="text-sm text-muted-foreground">
          Create a customer, case and order manually. Recorded as a staff-entered intake.
        </p>
      </div>
      <div className="rounded-2xl border border-border bg-card p-5">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading services…</p>
        ) : (
          <IntakeWizard
            services={services}
            mode="manual"
            onComplete={() => queryClient.invalidateQueries({ queryKey: ["admin"] })}
          />
        )}
      </div>
    </div>
  );
}
