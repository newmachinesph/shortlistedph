import "server-only";
import { HttpError } from "./session";

/**
 * Minimal fixed-window rate limiting for the endpoints that cost real money —
 * LLM extraction and embedding calls — plus the unauthenticated public ones.
 *
 * There was none at all: an employer could hold the brief-drafting endpoint
 * open with 20 000 characters of input on a loop, and every profile save fired
 * four embeddings with no debounce.
 *
 * ponytail: per-instance in-memory counters. A serverless fleet gives each
 * instance its own map, so the real ceiling is limit × instances — enough to
 * stop one client hammering one endpoint, not a distributed quota. Move the
 * counter to Postgres (or Redis) when traffic actually spans instances; the
 * call sites do not change.
 */

type Window = { count: number; resetAt: number };

const windows = new Map<string, Window>();

/** Keep the map from growing without bound on a long-lived instance. */
function sweep(now: number) {
  if (windows.size < 5_000) return;
  for (const [key, w] of windows) if (w.resetAt <= now) windows.delete(key);
}

export type Limit = { limit: number; windowMs: number };

/** Named budgets, so a route never invents its own numbers inline. */
export const LIMITS = {
  /** LLM extraction of a pasted job description. */
  jdDraft: { limit: 10, windowMs: 60 * 60_000 },
  /** Resume parse — an LLM call plus an object fetch. */
  resumeParse: { limit: 8, windowMs: 60 * 60_000 },
  /** Profile save: each one re-embeds four texts. */
  profileWrite: { limit: 30, windowMs: 60 * 60_000 },
  /** Publish + match: embeddings plus a full ranking pass. */
  publish: { limit: 12, windowMs: 60 * 60_000 },
  /** Unauthenticated funnel endpoints, keyed by IP. */
  publicIntake: { limit: 20, windowMs: 60 * 60_000 },
  /** Token-guessing on the public consent link. */
  consentToken: { limit: 30, windowMs: 15 * 60_000 },
} as const satisfies Record<string, Limit>;

/**
 * Throws 429 when `key` has spent its budget. `key` must identify the caller
 * AND the action — usually `${name}:${userId}`.
 */
export function rateLimit(name: keyof typeof LIMITS, identity: string): void {
  const { limit, windowMs } = LIMITS[name];
  const now = Date.now();
  sweep(now);

  const key = `${name}:${identity}`;
  const current = windows.get(key);

  if (!current || current.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  if (current.count >= limit) {
    const seconds = Math.ceil((current.resetAt - now) / 1000);
    throw new HttpError(429, `Too many requests — try again in ${seconds}s`);
  }
  current.count++;
}

/**
 * Caller identity for unauthenticated routes. Proxy headers are attacker-
 * controlled, so this is a throttling hint, never an authorisation input.
 */
export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}
