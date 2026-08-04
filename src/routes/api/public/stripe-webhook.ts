import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/stripe-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawBody = await request.text();
        const { verifyStripeEvent, paymentIntentId } = await import("@/lib/stripe.server");

        let event;
        try {
          event = await verifyStripeEvent(rawBody, request.headers.get("stripe-signature"));
        } catch (e) {
          console.error("[stripe-webhook] signature check failed", e);
          return new Response("Invalid signature", { status: 401 });
        }

        if (
          event.type !== "checkout.session.completed" &&
          event.type !== "checkout.session.async_payment_succeeded"
        ) {
          return new Response("ignored", { status: 200 });
        }

        try {
          const session = event.data.object;
          if (session.payment_status && session.payment_status !== "paid") {
            return new Response("pending", { status: 200 });
          }

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const orderId = session.metadata?.["order_id"] ?? null;

          const query = supabaseAdmin
            .from("orders")
            .update({
              payment_status: "paid",
              paid_at: new Date().toISOString(),
              stripe_payment_id: paymentIntentId(session),
              stripe_session_id: session.id,
            })
            .eq("payment_status", "unpaid"); // idempotent: duplicates match nothing

          const { error } = orderId
            ? await query.eq("id", orderId)
            : await query.eq("stripe_session_id", session.id);
          if (error) console.error("[stripe-webhook] order update failed", error);
        } catch (e) {
          console.error("[stripe-webhook] handler error", e);
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});
