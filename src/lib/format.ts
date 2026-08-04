export type Stage = "pre_trial" | "post_judgment" | "move_out";

export const STAGES: { value: Stage; label: string; blurb: string }[] = [
  {
    value: "pre_trial",
    label: "Before court",
    blurb: "You have a citation or a hearing date coming up.",
  },
  {
    value: "post_judgment",
    label: "After judgment",
    blurb: "The court has already ruled and you want to appeal.",
  },
  {
    value: "move_out",
    label: "About to be removed",
    blurb: "A writ of possession is coming or you need to move.",
  },
];

export const stageLabel = (s: string) => STAGES.find((x) => x.value === s)?.label ?? s;

export const money = (cents: number | null | undefined) =>
  `$${(((cents ?? 0) / 100) as number).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;

export const DISPOSITIONS = [
  "new",
  "intake_review",
  "docs_prep",
  "awaiting_signature",
  "filed",
  "negotiating",
  "completed",
  "cancelled",
] as const;

export type Disposition = (typeof DISPOSITIONS)[number];

export const titleize = (s: string | null | undefined) =>
  (s ?? "").split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

export const formatDate = (d: string | null | undefined) =>
  d
    ? new Date(d.length <= 10 ? `${d}T00:00:00` : d).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "—";

export type PublicService = {
  id: string;
  slug: string;
  name: string;
  description: string;
  stage: string;
  texas_authority: string;
  price_cents: number;
  sort_order: number;
};
