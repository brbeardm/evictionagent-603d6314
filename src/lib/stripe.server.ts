// Server-only Stripe REST helpers (Worker-safe: fetch + Web Crypto, no Node SDK).

const STRIPE_API = "https://api.stripe.com/v1";

function secretKey(): string {
  const key = process.env["STRIPE_SECRET_KEY"];
  if (!key) throw new Error("Stripe is not configured yet.");
  return key;
}

/** Flattens nested objects/arrays into Stripe's form-encoded bracket syntax. */
function encodeForm(obj: Record<string, unknown>, prefix = ""): string[] {
  const parts: string[] = [];
  for (const [rawKey, value] of Object.entries(obj)) {
    if (value === undefined || value === null) continue;
    const key = prefix ? `${prefix}[${rawKey}]` : rawKey;
    if (Array.isArray(value)) {
      value.forEach((item, i) => {
        if (item && typeof item === "object") {
          parts.push(...encodeForm(item as Record<string, unknown>, `${key}[${i}]`));
        } else {
          parts.push(`${encodeURIComponent(`${key}[${i}]`)}=${encodeURIComponent(String(item))}`);
        }
      });
    } else if (typeof value === "object") {
      parts.push(...encodeForm(value as Record<string, unknown>, key));
    } else {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
    }
  }
  return parts;
}

async function stripeRequest<T>(
  path: string,
  init: { method: "GET" | "POST"; body?: Record<string, unknown> },
): Promise<T> {
  const url = `${STRIPE_API}${path}`;
  const res = await fetch(url, {
    method: init.method,
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: init.body ? encodeForm(init.body).join("&") : null,
  });
  const payload = (await res.json()) as { error?: { message?: string } };
  if (!res.ok) {
    console.error("[stripe]", path, payload.error);
    throw new Error(payload.error?.message ?? "Stripe request failed.");
  }
  return payload as T;
}

export type StripeCheckoutSession = {
  id: string;
  client_secret: string | null;
  status: string | null;
  payment_status: string | null;
  payment_intent: string | { id: string } | null;
  metadata: Record<string, string> | null;
};

export function createCheckoutSession(params: {
  amountCents: number;
  productName: string;
  returnUrl: string;
  metadata: Record<string, string>;
  customerEmail?: string | null;
}) {
  return stripeRequest<StripeCheckoutSession>("/checkout/sessions", {
    method: "POST",
    body: {
      ui_mode: "embedded",
      mode: "payment",
      return_url: params.returnUrl,
      customer_email: params.customerEmail || undefined,
      metadata: params.metadata,
      payment_intent_data: { metadata: params.metadata },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: params.amountCents,
            product_data: { name: params.productName },
          },
        },
      ],
    },
  });
}

export function retrieveCheckoutSession(sessionId: string) {
  return stripeRequest<StripeCheckoutSession>(
    `/checkout/sessions/${encodeURIComponent(sessionId)}`,
    { method: "GET" },
  );
}

export function paymentIntentId(session: StripeCheckoutSession): string | null {
  const pi = session.payment_intent;
  if (!pi) return null;
  return typeof pi === "string" ? pi : pi.id;
}

/** Constant-time compare for hex signatures. */
function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Verifies a Stripe-Signature header against the raw body; returns the parsed event. */
export async function verifyStripeEvent(
  rawBody: string,
  signatureHeader: string | null,
  toleranceSeconds = 300,
): Promise<{ type: string; data: { object: StripeCheckoutSession } }> {
  const secret = process.env["STRIPE_WEBHOOK_SECRET"];
  if (!secret) throw new Error("Missing STRIPE_WEBHOOK_SECRET");
  if (!signatureHeader) throw new Error("Missing Stripe-Signature header");

  const parts = Object.fromEntries(
    signatureHeader.split(",").map((p) => {
      const [k, ...rest] = p.trim().split("=");
      return [k, rest.join("=")];
    }),
  ) as Record<string, string>;

  const timestamp = parts["t"];
  const signature = parts["v1"];
  if (!timestamp || !signature) throw new Error("Malformed Stripe signature");

  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
  if (!Number.isFinite(age) || age > toleranceSeconds) throw new Error("Stripe signature expired");

  const expected = await hmacSha256Hex(secret, `${timestamp}.${rawBody}`);
  if (!timingSafeEqualHex(expected, signature)) throw new Error("Invalid Stripe signature");

  return JSON.parse(rawBody) as { type: string; data: { object: StripeCheckoutSession } };
}
