import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { PublicLayout } from "@/components/PublicLayout";
import { money, stageLabel } from "@/lib/format";
import { getServiceBySlug } from "@/lib/public.functions";

export const Route = createFileRoute("/services/$slug")({
  loader: async ({ params }) => {
    const service = await getServiceBySlug({ data: { slug: params.slug } });
    if (!service) throw notFound();
    return { service };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [{ title: "Service unavailable — EvictionAgent" }, { name: "robots", content: "noindex" }],
      };
    }
    const { name, description } = loaderData.service;
    const title = `${name} — EvictionAgent Harris County`;
    const desc = description.slice(0, 155);
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
      ],
    };
  },
  component: ServiceDetail,
  notFoundComponent: () => (
    <PublicLayout>
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <h1 className="text-2xl font-semibold text-foreground">Service not found</h1>
        <Link to="/" className="mt-4 inline-block text-primary underline-offset-4 hover:underline">
          Back to all services
        </Link>
      </div>
    </PublicLayout>
  ),
});

function ServiceDetail() {
  const { service } = Route.useLoaderData();
  return (
    <PublicLayout>
      <article className="mx-auto w-full max-w-3xl px-4 py-10">
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> All services
        </Link>

        <span className="mt-6 inline-block rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
          {stageLabel(service.stage)}
        </span>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
          {service.name}
        </h1>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">
          {service.description}
        </p>

        <dl className="mt-8 grid gap-4 rounded-2xl border border-border bg-card p-5 sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Flat fee</dt>
            <dd className="mt-1 text-xl font-semibold text-foreground">
              {money(service.price_cents)}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">
              Texas authority
            </dt>
            <dd className="mt-1 text-sm font-medium text-foreground">
              {service.texas_authority}
            </dd>
          </div>
        </dl>

        <div className="mt-8 rounded-2xl border border-primary/30 bg-primary/5 p-5">
          <h2 className="text-lg font-semibold text-foreground">Ready to move forward?</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Tell us about your situation. It takes about three minutes and there's no payment
            in this step.
          </p>
          <Link
            to="/start"
            search={{ service: service.slug }}
            className="mt-4 inline-flex rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Start with {service.name}
          </Link>
        </div>
      </article>
    </PublicLayout>
  );
}
