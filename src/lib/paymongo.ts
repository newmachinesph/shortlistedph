import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { requireEnv } from "./api";

/**
 * PayMongo — talent side, PHP, QR Ph only.
 *
 * Uses PaymentIntent + qrph PaymentMethod so the QR renders inside our own
 * verification modal instead of bouncing people to a hosted page. A Filipino
 * worker can then scan it from GCash, Maya, or any bank app.
 *
 * UNTESTED against live PayMongo. Verify before launch:
 *   - intent create returns next_action with a QR image/string
 *   - a real webhook delivery passes verifySignature()
 *   - qrph.expired arrives for an unpaid code
 */

const BASE = "https://api.paymongo.com/v1";

const authHeader = () =>
  `Basic ${Buffer.from(`${requireEnv("PAYMONGO_SECRET_KEY")}:`).toString("base64")}`;

async function call<T>(path: string, body?: unknown, method = "POST"): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { Authorization: authHeader(), "Content-Type": "application/json" },
    body: body ? JSON.stringify({ data: { attributes: body } }) : undefined,
    cache: "no-store",
  });
  const json = (await res.json()) as { data?: unknown; errors?: { detail: string }[] };
  if (!res.ok) {
    throw new Error(`PayMongo ${path}: ${json.errors?.[0]?.detail ?? res.status}`);
  }
  return json.data as T;
}

type IntentData = {
  id: string;
  attributes: {
    status: string;
    client_key: string;
    next_action?: { type: string; code?: { image_url?: string; data?: string } } | null;
  };
};

/** Amount is in centavos. ₱60 -> 6000. */
export async function createQrPayment(input: {
  amountCentavos: number;
  description: string;
  metadata: Record<string, string>;
}): Promise<{ intentId: string; qrImageUrl: string | null; qrData: string | null }> {
  const intent = await call<IntentData>("/payment_intents", {
    amount: input.amountCentavos,
    currency: "PHP",
    payment_method_allowed: ["qrph"],
    description: input.description,
    metadata: input.metadata,
    capture_type: "automatic",
  });

  const method = await call<{ id: string }>("/payment_methods", {
    type: "qrph",
  });

  const attached = await call<IntentData>(
    `/payment_intents/${intent.id}/attach`,
    { payment_method: method.id },
  );

  const code = attached.attributes.next_action?.code;
  return {
    intentId: attached.id,
    qrImageUrl: code?.image_url ?? null,
    qrData: code?.data ?? null,
  };
}

/**
 * `Paymongo-Signature: t=<ts>,te=<test sig>,li=<live sig>`
 * Signed payload is `<timestamp>.<raw body>`. Constant-time compare, and a
 * timestamp window so a captured delivery can't be replayed later.
 */
export function verifySignature(header: string | null, rawBody: string): boolean {
  if (!header) return false;
  const secret = process.env.PAYMONGO_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[paymongo] PAYMONGO_WEBHOOK_SECRET not configured");
    return false;
  }

  const parts = Object.fromEntries(
    header.split(",").map((p) => {
      const [k, v] = p.split("=");
      return [k?.trim(), v?.trim()];
    }),
  ) as { t?: string; te?: string; li?: string };

  const timestamp = parts.t;
  const provided = process.env.PAYMONGO_SECRET_KEY?.startsWith("sk_live") ? parts.li : parts.te;
  if (!timestamp || !provided) return false;

  const ageSeconds = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(ageSeconds) || ageSeconds > 300) return false;

  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(provided, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}
