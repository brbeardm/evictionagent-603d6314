import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { CalendarClock, FileCheck2, ShieldCheck } from "lucide-react";
import { PublicLayout } from "@/components/PublicLayout";
import { ServiceCard } from "@/components/ServiceCard";
import { STAGES } from "@/lib/format";
import { listServices } from "@/lib/public.functions";

export const Route = createFileRoute("/")({
  loader: () => listServices(),
  head: () => ({
    meta: [
      { title: "EvictionAgent — Harris County Eviction Help & Filing Services" },
      {
        name: "description",
        content:
          "Facing eviction in Harris County? Document preparation and authorized-agent filing for answers, postponements, appeals and managed move-outs.",
      },
      { property: "og:title", content: "EvictionAgent — Harris County Eviction Help" },
      {
        property: "og:description",
        content:
          "You may have more time than you think. Get help with answers, postponements, appeals and move-outs in Harris County, Texas.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const services = Route.useLoaderData();
  const [stage, setStage] = useState<string | null>(null);
  const shown = stage ? services.filter((s) => s.stage === stage) : services;

  return (
    <PublicLayout>
      <section className="border-b border-border/60 bg-gradient-to-b from-accent/40 to-background">
        <div className="mx-auto w-full max-w-5xl px-4 py-14 sm:py-20">
          <p className="text-sm font-medium uppercase tracking-wide text-primary">
            Harris County, Texas
          </p>
          <h1 className="mt-3 max-w-3xl text-3xl font-semibold leading-tight tracking-tight text-foreground sm:text-5xl">
            Facing eviction in Harris County? You may have more time than you think.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Texas eviction rules give tenants real options — a written answer, a 7-day
            postponement, an agreed extension, or an appeal. We prepare the paperwork and
            file it as your authorized agent, so nothing is lost to a missed deadline.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Link
              to="/start"
              className="inline-flex items-center justify-center rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Start your intake
            </Link>
            <a
              href="#services"
              className="inline-flex items-center justify-center rounded-lg border border-border bg-card px-5 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
            >
              See what we do
            </a>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {[
              { icon: CalendarClock, t: "Deadlines tracked", d: "We watch the court file so dates don't slip past you." },
              { icon: FileCheck2, t: "Documents prepared", d: "Answers, motions and agreements written to Texas rules." },
              { icon: ShieldCheck, t: "Filed for you", d: "We file as your authorized agent in the JP precinct court." },
            ].map(({ icon: Icon, t, d }) => (
              <div key={t} className="rounded-xl border border-border bg-card/70 p-4">
                <Icon className="h-5 w-5 text-primary" />
                <p className="mt-2 text-sm font-semibold text-foreground">{t}</p>
                <p className="mt-1 text-sm text-muted-foreground">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="services" className="mx-auto w-full max-w-5xl px-4 py-12">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
          Where are you right now?
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Pick the stage you're in and we'll show the options that still apply to you.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {STAGES.map((s) => {
            const active = stage === s.value;
            return (
              <button
                key={s.value}
                type="button"
                onClick={() => setStage(active ? null : s.value)}
                aria-pressed={active}
                className={`rounded-xl border p-4 text-left transition-colors ${
                  active
                    ? "border-primary bg-primary/10"
                    : "border-border bg-card hover:border-primary/40"
                }`}
              >
                <p className="text-sm font-semibold text-foreground">{s.label}</p>
                <p className="mt-1 text-sm text-muted-foreground">{s.blurb}</p>
              </button>
            );
          })}
        </div>

        {stage && (
          <button
            type="button"
            onClick={() => setStage(null)}
            className="mt-4 text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Show all services
          </button>
        )}

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {shown.map((s) => (
            <ServiceCard key={s.slug} service={s} />
          ))}
        </div>
      </section>
    </PublicLayout>
  );
}
