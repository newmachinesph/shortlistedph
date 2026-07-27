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

/**
 * Keep the map from growing without bound on a long-lived instance.
 *
 * Sweeping only expired entries is not enough on its own: enough distinct live
 * keys and nothing is evictable, so the map grows for the life of the process.
 * Above a hard ceiling the oldest windows go regardless — losing a counter
 * costs one caller some extra budget, holding every counter costs the instance.
 */
const SOFT_LIMIT = 5_000;
const HARD_LIMIT = 20_000;

function sweep(now: number) {
  if (windows.size < SOFT_LIMIT) return;
  for (const [key, w] of windows) if (w.resetAt <= now) windows.delete(key);
  if (windows.size < HARD_LIMIT) return;
  const overflow = windows.size - HARD_LIMIT;
  let dropped = 0;
  for (const key of windows.keys()) {
    if (dropped++ >= overflow) break;
    windows.delete(key);
  }
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
 * Caller identity for unauthenticated routes. Still only a throttling hint,
 * never an authorisation input.
 *
 * Take the LAST X-Forwarded-For entry, not the first. Each proxy appends the
 * address it saw, so the rightmost entry is the one our own edge observed and
 * the leftmost is whatever the client sent — reading it made the limiter
 * bypassable by rotating a header, which is no limiter at all. Vercel's own
 * header wins when present because it is not client-writable.
 */
export function clientIp(req: Request): string {
  const vercel = req.headers.get("x-vercel-forwarded-for");
  if (vercel) return vercel.trim();

  const chain = req.headers.get("x-forwarded-for")?.split(",") ?? [];
  const nearest = chain[chain.length - 1]?.trim();
  return nearest || req.headers.get("x-real-ip") || "unknown";
}
