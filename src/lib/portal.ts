export const FRIENDLY_DISPOSITION: Record<string, string> = {
  new: "Received",
  intake_review: "In review",
  docs_prep: "In progress",
  awaiting_signature: "Waiting on your signature",
  filed: "Filed",
  negotiating: "In negotiation",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const FRIENDLY_PAYMENT: Record<string, string> = {
  unpaid: "Payment not collected",
  paid: "Paid",
  refunded: "Refunded",
};

export const FRIENDLY_CASE_STAGE: Record<string, string> = {
  pre_trial: "Before court — no hearing date set yet",
  trial_set: "Court date set",
  judgment: "The judge has ruled",
  appeal: "On appeal",
  move_out: "Move-out stage",
  closed: "Closed",
};

/** Short, reassuring plain-language explanation for a key date. */
export function keyDateExplainer(title: string): string {
  const t = title.toLowerCase();
  if (t.includes("court date"))
    return "This is when your hearing is scheduled. Plan to be there — missing it can cost you the case.";
  if (t.includes("appeal"))
    return "This is the last day to appeal the judgment. We'll walk you through the paperwork before then.";
  if (t.includes("writ"))
    return "The earliest day the landlord can ask for a writ of possession. Nothing happens automatically on this date.";
  return "A key date on your case. Your case specialist will confirm what happens next.";
}
