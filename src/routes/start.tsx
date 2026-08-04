import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { PublicLayout } from "@/components/PublicLayout";
import { IntakeWizard } from "@/components/IntakeWizard";
import { listServices } from "@/lib/public.functions";
import type { PublicService } from "@/lib/format";

export const Route = createFileRoute("/start")({
  validateSearch: z.object({ service: z.string().optional() }),
  loader: async () => (await listServices()) as PublicService[],
  head: () => ({
    meta: [
      { title: "Start Your Eviction Intake — EvictionAgent" },
      {
        name: "description",
        content:
          "Tell us your Harris County eviction situation in three short steps. No payment required to start.",
      },
      { property: "og:title", content: "Start Your Eviction Intake — EvictionAgent" },
      {
        property: "og:description",
        content: "Three short steps to get your Harris County eviction paperwork moving.",
      },
    ],
  }),
  component: StartPage,
});

function StartPage() {
  const services = Route.useLoaderData();
  const { service } = Route.useSearch();

  return (
    <PublicLayout>
      <div className="mx-auto w-full max-w-2xl px-4 py-10">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Let's find out how much time you have.
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Three short steps. Nothing is filed and no payment is taken until you approve it.
        </p>
        <div className="mt-8">
          <IntakeWizard services={services} mode="web" initialServiceSlug={service} />
        </div>
      </div>
    </PublicLayout>
  );
}
