export const EVENT_TYPES = ["task", "deadline", "filing", "note"] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export type Bucket = "overdue" | "soon" | "upcoming";

export const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

export const parseDay = (d: string) =>
  new Date(d.length <= 10 ? `${d}T00:00:00` : d);

/** Whole days from today to the due date (negative = overdue). */
export const daysUntil = (due: string | null | undefined) => {
  if (!due) return null;
  const diff = parseDay(due).getTime() - startOfToday().getTime();
  return Math.round(diff / 86_400_000);
};

export const bucketOf = (due: string | null | undefined): Bucket => {
  const n = daysUntil(due);
  if (n === null) return "upcoming";
  if (n < 0) return "overdue";
  if (n <= 3) return "soon";
  return "upcoming";
};

export const relativeLabel = (due: string | null | undefined) => {
  const n = daysUntil(due);
  if (n === null) return "No date";
  if (n === 0) return "due today";
  if (n === 1) return "in 1 day";
  if (n > 1) return `in ${n} days`;
  if (n === -1) return "1 day OVERDUE";
  return `${Math.abs(n)} days OVERDUE`;
};

export const BUCKETS: { key: Bucket; label: string; tone: string; dot: string }[] = [
  {
    key: "overdue",
    label: "Overdue",
    tone: "border-destructive/40 bg-destructive/5",
    dot: "bg-destructive text-destructive",
  },
  {
    key: "soon",
    label: "Due soon (next 3 days)",
    tone: "border-amber-500/40 bg-amber-500/5",
    dot: "bg-amber-500 text-amber-600",
  },
  {
    key: "upcoming",
    label: "Upcoming",
    tone: "border-border bg-card",
    dot: "bg-muted-foreground text-muted-foreground",
  },
];

export const toDateInput = (d: string | null | undefined) => (d ? d.slice(0, 10) : "");
