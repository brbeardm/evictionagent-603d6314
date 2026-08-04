import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import { AlertTriangle, Loader2 } from "lucide-react";
import { startCheckout } from "@/lib/checkout.functions";
import { getStripe, stripeIsConfigured } from "@/lib/stripe-client";

/** Mounts Stripe's embedded checkout inline for a freshly created order. */
export function EmbeddedCheckoutPanel({ orderId }: { orderId: string }) {
  const start = useServerFn(startCheckout);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setClientSecret(null);
    setError(null);

    if (!stripeIsConfigured) {
      setError("Online payment isn't configured yet. Please contact us to complete your order.");
      return;
    }

    start({ data: { orderId } })
      .then((res) => {
        if (!active) return;
        if (!res.clientSecret) throw new Error("Stripe did not return a checkout session.");
        setClientSecret(res.clientSecret);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "We couldn't start the payment.");
      });

    return () => {
      active = false;
    };
  }, [orderId, attempt, start]);

  const retry = useCallback(() => setAttempt((a) => a + 1), []);

  if (error) {
    return (
      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
          <div>
            <p className="text-sm font-semibold text-foreground">We couldn't open payment.</p>
            <p className="mt-1 text-sm text-muted-foreground">{error}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Your intake is saved — nothing is lost. You can try again.
            </p>
            <button
              type="button"
              onClick={retry}
              className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!clientSecret) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Preparing secure payment…
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <EmbeddedCheckoutProvider stripe={getStripe()} options={{ clientSecret }}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}
