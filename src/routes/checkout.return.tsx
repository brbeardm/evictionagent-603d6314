import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Clock, Loader2 } from "lucide-react";
import { PublicLayout } from "@/components/PublicLayout";
import { CreateAccountPanel } from "@/components/CreateAccountPanel";
import { getCheckoutStatus } from "@/lib/checkout.functions";
import { useSessionUser } from "@/hooks/useSessionUser";

export const Route = createFileRoute("/checkout/return")({
  validateSearch: z.object({ session_id: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Payment Confirmation — EvictionAgent" },
      {
        name: "description",
        content:
          "Your EvictionAgent payment confirmation and the next steps your case specialist will take.",
      },
      { property: "og:title", content: "Payment Confirmation — EvictionAgent" },
      {
        property: "og:description",
        content: "Payment received — here's what happens next on your Harris County eviction case.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CheckoutReturnPage,
});

function CheckoutReturnPage() {
  const { session_id: sessionId } = Route.useSearch();
  const status = useServerFn(getCheckoutStatus);
  const { user, isStaff } = useSessionUser();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["checkout-status", sessionId],
    enabled: Boolean(sessionId),
    queryFn: () => status({ data: { sessionId: sessionId! } }),
  });

  const paid = data?.paymentStatus === "paid" || data?.status === "complete";

  return (
    <PublicLayout>
      <div className="mx-auto w-full max-w-2xl px-4 py-10">
        {!sessionId ? (
          <Pending
            title="We couldn't find that payment."
            body="The confirmation link is missing its session reference."
          />
        ) : isLoading ? (
          <div className="flex items-center gap-2 rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Checking your payment…
          </div>
        ) : isError ? (
          <Pending
            title="We couldn't confirm your payment yet."
            body="Refresh in a moment. If your card was charged, our team already sees the order."
          />
        ) : paid ? (
          <div>
            <div className="rounded-2xl border border-primary/30 bg-primary/5 p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Check className="h-5 w-5" />
              </div>
              <h1 className="mt-4 text-2xl font-semibold text-foreground">
                Payment received — your case is in the queue.
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">Here's what happens next:</p>
              <ol className="mt-4 space-y-3 text-sm text-foreground">
                <li>
                  <span className="font-semibold">1. Intake review (within 1 business day).</span> A
                  case specialist checks your dates against the Harris County court record.
                </li>
                <li>
                  <span className="font-semibold">2. We call or text you.</span> We confirm your
                  deadline, explain your options, and collect anything still missing.
                </li>
                <li>
                  <span className="font-semibold">3. Documents prepared and filed.</span> You review
                  and sign; we file with your JP precinct court as your authorized agent.
                </li>
                <li>
                  <span className="font-semibold">4. You get every key date.</span> Trial date,
                  appeal deadline, and the earliest a writ can issue — tracked for you.
                </li>
              </ol>
              <p className="mt-5 text-xs text-muted-foreground">
                A receipt has been emailed to you. Your payment is complete — we'll confirm every
                filing with you before it goes to the court.
              </p>
            </div>

            {user && !isStaff ? (
              <div className="mt-6 rounded-2xl border border-border bg-card p-5">
                <p className="text-sm text-foreground">This order is now in your account.</p>
                <Link
                  to="/portal"
                  className="mt-3 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  View My Orders
                </Link>
              </div>
            ) : !user && data?.customerId && data?.email ? (
              <CreateAccountPanel customerId={data.customerId} email={data.email} />
            ) : null}
          </div>
        ) : (
          <Pending
            title="Payment not completed."
            body="Your checkout is still open or processing. If you closed the payment window, you can start again — nothing was filed and your intake is saved."
          />
        )}
      </div>
    </PublicLayout>
  );
}

function Pending({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-foreground">
        <Clock className="h-5 w-5" />
      </div>
      <h1 className="mt-4 text-2xl font-semibold text-foreground">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
      <Link
        to="/start"
        className="mt-5 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
      >
        Back to intake
      </Link>
    </div>
  );
}
