import "server-only";
import { requireEnv } from "./api";

/**
 * PayPal Orders v2 — standard merchant integration (not Platform/Marketplaces:
 * employers buy our product, we never move money between two other parties).
 *
 * UNTESTED against live PayPal. Verify before launch:
 *   - sandbox order create -> approve -> capture returns COMPLETED
 *   - webhook signature verification returns SUCCESS for a real delivery
 */

const BASE = () =>
  process.env.PAYPAL_ENV === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";

async function token(): Promise<string> {
  const auth = Buffer.from(
    `${requireEnv("PAYPAL_CLIENT_ID")}:${requireEnv("PAYPAL_CLIENT_SECRET")}`,
  ).toString("base64");

  const res = await fetch(`${BASE()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`PayPal auth failed: ${res.status}`);
  const json = (await res.json()) as { access_token: string };
  return json.access_token;
}

export async function createOrder(input: {
  amount: string;
  currency: string;
  description: string;
  referenceId: string;
}): Promise<{ id: string; approveUrl: string | null }> {
  const res = await fetch(`${BASE()}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${await token()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: input.referenceId,
          description: input.description,
          amount: { currency_code: input.currency, value: input.amount },
        },
      ],
      application_context: {
        brand_name: "shortlisted.ph",
        user_action: "PAY_NOW",
        // requireEnv, not interpolation — an unset value would silently send
        // buyers to "undefined/employer/billing" after paying.
        return_url: `${requireEnv("NEXT_PUBLIC_APP_URL")}/employer/billing?paid=1`,
        cancel_url: `${requireEnv("NEXT_PUBLIC_APP_URL")}/employer/billing?cancelled=1`,
      },
    }),
    cache: "no-store",
  });

  const json = (await res.json()) as {
    id?: string;
    links?: { rel: string; href: string }[];
    message?: string;
  };
  if (!res.ok || !json.id) throw new Error(`PayPal order failed: ${json.message ?? res.status}`);

  return {
    id: json.id,
    approveUrl: json.links?.find((l) => l.rel === "approve")?.href ?? null,
  };
}

export type CaptureResult = {
  completed: boolean;
  captureId: string | null;
  amount: string | null;
  currency: string | null;
  /** "<employerId>:<productId>", as set by us at order creation. */
  referenceId: string | null;
};

export async function captureOrder(orderId: string): Promise<CaptureResult> {
  const res = await fetch(`${BASE()}/v2/checkout/orders/${orderId}/capture`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${await token()}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  const json = (await res.json()) as {
    status?: string;
    purchase_units?: {
      reference_id?: string;
      payments?: {
        captures?: { id: string; status: string; amount?: { value: string; currency_code: string } }[];
      };
    }[];
  };

  const unit = json.purchase_units?.[0];
  const capture = unit?.payments?.captures?.[0];
  return {
    completed: json.status === "COMPLETED" && capture?.status === "COMPLETED",
    captureId: capture?.id ?? null,
    amount: capture?.amount?.value ?? null,
    currency: capture?.amount?.currency_code ?? null,
    referenceId: unit?.reference_id ?? null,
  };
}

/**
 * Asks PayPal to verify the delivery rather than reimplementing the crypto.
 * Fails closed: any error means "not verified".
 */
export async function verifyWebhook(headers: Headers, rawBody: string): Promise<boolean> {
  try {
    const res = await fetch(`${BASE()}/v1/notifications/verify-webhook-signature`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${await token()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        auth_algo: headers.get("paypal-auth-algo"),
        cert_url: headers.get("paypal-cert-url"),
        transmission_id: headers.get("paypal-transmission-id"),
        transmission_sig: headers.get("paypal-transmission-sig"),
        transmission_time: headers.get("paypal-transmission-time"),
        webhook_id: requireEnv("PAYPAL_WEBHOOK_ID"),
        webhook_event: JSON.parse(rawBody),
      }),
      cache: "no-store",
    });
    const json = (await res.json()) as { verification_status?: string };
    return json.verification_status === "SUCCESS";
  } catch (e) {
    console.error("[paypal] webhook verification error", e);
    return false;
  }
}
