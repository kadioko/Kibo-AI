import { describe, expect, it } from "vitest";
import { limiterBackend, takeToken } from "./rate-limit";

describe("rate limiter", () => {
  it("uses memory without Redis env", () => {
    expect(limiterBackend()).toBe("memory");
  });

  it("allows up to the limit, then blocks", async () => {
    const key = `test:${Date.now()}:${Math.random()}`;
    expect(await takeToken(key, { limit: 2, windowMs: 60_000 })).toBe(true);
    expect(await takeToken(key, { limit: 2, windowMs: 60_000 })).toBe(true);
    expect(await takeToken(key, { limit: 2, windowMs: 60_000 })).toBe(false);
  });

  it("isolates buckets per key", async () => {
    const a = `a:${Date.now()}:${Math.random()}`;
    const b = `b:${Date.now()}:${Math.random()}`;
    expect(await takeToken(a, { limit: 1, windowMs: 60_000 })).toBe(true);
    expect(await takeToken(a, { limit: 1, windowMs: 60_000 })).toBe(false);
    expect(await takeToken(b, { limit: 1, windowMs: 60_000 })).toBe(true);
  });
});
