/**
 * Rate limiting with two tiers:
 * - Upstash Redis sliding windows when UPSTASH_REDIS_REST_URL/TOKEN are set
 *   (correct across Vercel's many server instances).
 * - In-memory token buckets otherwise (single instance / local dev).
 * Redis failures fall back to memory rather than blocking traffic.
 */
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

interface Bucket {
  tokens: number;
  resetAt: number;
}

const memory = new Map<string, Bucket>();

export interface RateLimit {
  limit: number;
  /** Refill window in ms. */
  windowMs: number;
}

let redis: Redis | null | undefined;
const limiters = new Map<string, Ratelimit>();

function getRedis(): Redis | null {
  if (redis !== undefined) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  redis = url && token ? new Redis({ url, token }) : null;
  return redis;
}

function getLimiter(limit: number, windowMs: number): Ratelimit | null {
  const client = getRedis();
  if (!client) return null;
  const key = `${limit}/${windowMs}`;
  let limiter = limiters.get(key);
  if (!limiter) {
    limiter = new Ratelimit({
      redis: client,
      limiter: Ratelimit.slidingWindow(limit, `${Math.max(1, Math.round(windowMs / 1000))} s`),
      prefix: "kibo-ratelimit",
    });
    limiters.set(key, limiter);
  }
  return limiter;
}

function takeMemoryToken(key: string, { limit, windowMs }: RateLimit): boolean {
  const now = Date.now();
  const bucket = memory.get(key);
  if (!bucket || now >= bucket.resetAt) {
    memory.set(key, { tokens: limit - 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.tokens <= 0) return false;
  bucket.tokens -= 1;
  return true;
}

/** Returns true when the action is allowed, false when rate-limited. */
export async function takeToken(key: string, opts: RateLimit): Promise<boolean> {
  const limiter = getLimiter(opts.limit, opts.windowMs);
  if (!limiter) return takeMemoryToken(key, opts);
  try {
    const { success } = await limiter.limit(key);
    return success;
  } catch {
    return takeMemoryToken(key, opts);
  }
}

/** Which backend answered the last call (for diagnostics). */
export function limiterBackend(): "redis" | "memory" {
  return getRedis() ? "redis" : "memory";
}

/** Generations are expensive — 20 submits per user per 10 minutes. */
export function checkGenerationLimit(userId: string): Promise<boolean> {
  return takeToken(`gen:${userId}`, { limit: 20, windowMs: 10 * 60_000 });
}
