// Authenticated deployment checks. Credentials and cookies stay in memory.
// Run with Node 20+: node --env-file=.env.local scripts/smoke-check.mjs
import assert from "node:assert/strict";
import { createServerClient } from "@supabase/ssr";

const baseUrl = process.env.SMOKE_BASE_URL;
const email = process.env.SMOKE_EMAIL;
const password = process.env.SMOKE_PASSWORD;
if (!baseUrl || !email || !password) {
  throw new Error("Set SMOKE_BASE_URL, SMOKE_EMAIL and SMOKE_PASSWORD before running.");
}
const jar = new Map();
const auth = createServerClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { cookies: {
    getAll: () => [...jar].map(([name, value]) => ({ name, value })),
    setAll: (cookies) => cookies.forEach(({ name, value }) => jar.set(name, value)),
  } },
);
const { error } = await auth.auth.signInWithPassword({ email, password });
if (error) throw new Error(`Smoke-test sign-in failed: ${error.message}`);
let failures = 0;
async function check(path, signedIn = true) {
  const response = await fetch(new URL(path, baseUrl), {
    headers: signedIn ? { Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; ") } : {},
    redirect: "manual",
    signal: AbortSignal.timeout(30_000),
  });
  const json = response.headers.get("content-type")?.includes("application/json");
  const body = json ? await response.json() : await response.text();
  return { response, body };
}
try {
  const anonymous = await check("/api/health", false);
  assert.equal(anonymous.response.status, 401, "Anonymous API access must be rejected");
  console.log("PASS anonymous API authentication");
  for (const path of ["/api/health", "/api/models", "/api/models/favorites", "/api/generations", "/api/projects", "/api/brands", "/api/templates", "/api/teams", "/api/usage", "/api/stats", "/api/limits", "/api/billing"]) {
    const { response, body } = await check(path);
    const ok = response.ok && body.ok !== false;
    if (!ok) failures++;
    console.log(`${ok ? "PASS" : "FAIL"} ${path} (${response.status})`);
    if (path === "/api/health") console.log(JSON.stringify(body));
    else if (!ok) console.log(JSON.stringify({ error: body.error }));
    if (path === "/api/projects" && ok) {
      const totalsPresent = Array.isArray(body.projects) && body.projects.every((project) =>
        ["generation_count", "active_count", "failed_count", "estimated_cost", "actual_cost"]
          .every((key) => typeof project[key] === "number"),
      );
      if (!totalsPresent) failures++;
      console.log(`${totalsPresent ? "PASS" : "FAIL"} project cost totals`);
    }
  }
  const estimateResponse = await fetch(new URL("/api/generations/estimate", baseUrl), {
    method: "POST",
    headers: {
      Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; "),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      provider: "higgsfield",
      model: "soul-2",
      generationType: "image",
      prompt: "smoke test estimate",
      settings: { resolution: "1080p", batchSize: "1" },
    }),
    signal: AbortSignal.timeout(30_000),
  });
  const estimateBody = await estimateResponse.json();
  const estimateOk =
    estimateResponse.ok &&
    estimateBody.estimate?.amountUsd === 0.0057 &&
    typeof estimateBody.estimate?.pricingAsOf === "string";
  if (!estimateOk) failures++;
  console.log(`${estimateOk ? "PASS" : "FAIL"} configuration pricing estimate`);
  for (const path of ["/dashboard", "/models", "/settings", "/admin"]) {
    const { response, body } = await check(path);
    const ok = response.ok && (path !== "/admin" || body.includes("Users"));
    if (!ok) failures++;
    console.log(`${ok ? "PASS" : "FAIL"} ${path} (${response.status})`);
    if (path === "/dashboard") {
      const adminVisible = body.includes('href="/admin"');
      if (!adminVisible) failures++;
      console.log(`${adminVisible ? "PASS" : "FAIL"} admin navigation`);
    }
  }
} finally {
  await auth.auth.signOut({ scope: "local" });
}
console.log(`Smoke checks complete: ${failures} failures.`);
process.exitCode = failures ? 1 : 0;
