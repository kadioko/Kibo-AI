/**
 * Minimal in-memory token bucket per key (user id + action).
 * Architecture placeholder: swap the Map for Redis/Upstash in production
 * when running on multiple server instances.
 */

interface Bucket {
  tokens: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimit {
  limit: number;
  /** Refill window in ms. */
  windowMs: number;
}

/** Returns true when the action is allowed, false when rate-limited. */
export function takeToken(key: string, { limit, windowMs }: RateLimit): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { tokens: limit - 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.tokens <= 0) return false;
  bucket.tokens -= 1;
  return true;
}

/** Generations are expensive — 20 submits per user per 10 minutes. */
export function checkGenerationLimit(userId: string): boolean {
  return takeToken(`gen:${userId}`, { limit: 20, windowMs: 10 * 60_000 });
}
