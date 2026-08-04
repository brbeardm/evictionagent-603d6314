import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { money, stageLabel } from "@/lib/format";

export type ServiceCardData = {
  slug: string;
  name: string;
  description: string;
  stage: string;
  texas_authority: string;
  price_cents: number;
};

export function ServiceCard({ service }: { service: ServiceCardData }) {
  return (
    <Link
      to="/services/$slug"
      params={{ slug: service.slug }}
      className="group flex flex-col rounded-2xl border border-border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
    >
      <span className="w-fit rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground">
        {stageLabel(service.stage)}
      </span>
      <h3 className="mt-3 text-lg font-semibold text-foreground">{service.name}</h3>
      <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
        {service.description}
      </p>
      <p className="mt-3 text-xs text-muted-foreground">
        Texas authority: {service.texas_authority}
      </p>
      <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-4">
        <span className="text-base font-semibold text-foreground">
          {money(service.price_cents)}
        </span>
        <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
          Learn more <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}
