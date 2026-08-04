import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Starts an embedded Stripe Checkout session for an unpaid order. */
export const startCheckout = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ orderId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { createCheckoutSession } = await import("./stripe.server");

    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select(
        "id, amount_cents, payment_status, customer_id, case_id, services(name), customers(email)",
      )
      .eq("id", data.orderId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!order) throw new Error("Order not found.");
    if (order.payment_status !== "unpaid") throw new Error("This order is not awaiting payment.");

    const siteUrl = (process.env["SITE_URL"] ?? "").replace(/\/$/, "");
    if (!siteUrl) throw new Error("SITE_URL is not configured.");

    const session = await createCheckoutSession({
      amountCents: order.amount_cents,
      productName: order.services?.name ?? "EvictionAgent service",
      returnUrl: `${siteUrl}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
      customerEmail: order.customers?.email ?? null,
      metadata: {
        order_id: order.id,
        customer_id: order.customer_id,
        case_id: order.case_id ?? "",
      },
    });

    const { error: updateError } = await supabaseAdmin
      .from("orders")
      .update({ stripe_session_id: session.id })
      .eq("id", order.id);
    if (updateError) throw new Error(updateError.message);

    return { clientSecret: session.client_secret };
  });

/** Read-only status lookup used by the checkout return page. */
export const getCheckoutStatus = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ sessionId: z.string().min(1).max(200) }).parse(input))
  .handler(async ({ data }) => {
    const { retrieveCheckoutSession } = await import("./stripe.server");
    const session = await retrieveCheckoutSession(data.sessionId);
    return {
      status: session.status,
      paymentStatus: session.payment_status,
      orderId: session.metadata?.["order_id"] ?? null,
    };
  });
