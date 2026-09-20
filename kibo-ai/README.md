# Kibo AI — AI Creative Studio

Mobile-first studio for generating images and videos with frontier AI models
through the Higgsfield API. Next.js App Router · TypeScript · Tailwind ·
Supabase (Auth, Postgres, Storage) · Vercel.

Repository-level documentation is available in the parent directory:
[architecture](../docs/ARCHITECTURE.md), [deployment](../docs/DEPLOYMENT.md),
[API reference](../docs/API.md), [contributing](../CONTRIBUTING.md), and
[security](../SECURITY.md).

## Quick start

```bash
cd kibo-ai
npm install
cp .env.example .env.local   # then fill in the values below
npm run dev                  # http://localhost:3000
```

**Requirements:** Node.js 20.9 or later, a Supabase project, and Higgsfield API
credentials. Do not commit `.env.local` or any API credentials.

## 1. Supabase setup

1. Create a project at supabase.com.
2. **SQL editor** → run in order:
   - `supabase/migrations/0001_kibo_init.sql` (tables, RLS, provider seed)
   - `supabase/migrations/0002_phase2.sql` (brand/template links, spending
     limits, public template seeds)
   - `supabase/migrations/0003_phase3.sql` (teams, invites, project sharing,
     personal credits ledger)
   - `supabase/migrations/0004_team_wallets.sql` (generation team snapshot,
     team wallet ledger)
   - `supabase/migrations/0005_hardening.sql` (template and team-project
     access control, idempotency constraints, migration-version repair)
   - `supabase/migrations/0006_app_admins.sql` (global administrators and
     append-only administrator audit log)
   - `supabase/migrations/0007_admin_service_role_grants.sql` (server-only
     privileges for the protected administrator tables)
   - `supabase/migrations/0008_runtime_table_privileges.sql` (minimum
     dashboard/admin read grants; RLS still enforces user access)
   - `supabase/migrations/0009_service_runtime_privileges.sql` (server-only
     privileges for generations, diagnostics, storage jobs, and billing)
   - `supabase/migrations/0010_model_favorites.sql` (per-user model
     favorites with row-level access control)
   - `supabase/migrations/0011_feature_runtime_privileges.sql` (complete
     browser and server privileges while retaining row-level access control)
   - `supabase/migrations/0012_billing_idempotency.sql` (prevents duplicate
     credit grants when Stripe retries a webhook)
3. **Storage** → create two buckets:
   - `kibo-inputs` — **PUBLIC** (reference uploads; unguessable UUID paths
     so the provider can fetch them).
   - `kibo-outputs` — **PRIVATE** (finished media; served via signed URLs).
4. **Authentication** → enable Email provider. Under URL Configuration, add
   your app URL and include `/auth/confirm` in the redirect allow-list
   (e.g. `http://localhost:3000/auth/confirm`, `https://<app>/auth/confirm`)
   so password-reset and email-confirmation links complete.

## 2. Environment

| Variable | Where | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API | Client + server Supabase access |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API | Public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API | Server jobs (storage copy). Never `NEXT_PUBLIC_` |
| `HIGGSFIELD_API_KEY_ID` | console.higgsfield.ai | Provider auth (server-only) |
| `HIGGSFIELD_API_KEY_SECRET` | console.higgsfield.ai | Provider auth (server-only) |
| `HIGGSFIELD_API_BASE_URL` | — | Default `https://api.higgsfield.ai` |
| `HIGGSFIELD_WEBHOOK_SECRET` | — | Optional Bearer secret for the Higgsfield webhook |
| `MOCK_PROVIDER_ENABLED` | — | Set `true` for no-cost end-to-end testing |
| `WELCOME_CREDITS_USD` | — | Optional new-user credit grant; defaults to `5` |
| `ASSISTANT_API_URL`, `ASSISTANT_API_KEY`, `ASSISTANT_MODEL` | — | Optional OpenAI-compatible prompt assistant |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | — | Optional distributed rate limiter |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | — | Optional Stripe credit top-ups and verified webhook |
| `NEXT_PUBLIC_APP_URL` | — | Used for password-reset links |

Higgsfield credentials never reach the browser: all provider calls go through
`src/lib/providers/*` from API routes.

## 3. Deploy (Vercel)

```bash
vercel --prod
```

Set the same env vars in Vercel → Project → Settings → Environment Variables.
Set `kibo-ai` as the Vercel project root directory, then add the deployed URL
to Supabase Authentication's Site URL and redirect allow-list.

## Generation flow

```
Create screen → POST /api/generations → validate (zod) → rate limit →
  personal/team credit check → provider.createGeneration() → insert
  `generations` row (queued)
  → client polls GET /api/generations/[id] every 4s
  → terminal? completed → download CDN file → kibo-outputs → usage log →
  idempotent personal/team wallet debit
```

### Cost tracking

Create estimates use the selected model, resolution, duration, input mode, and
output count against the public Higgsfield catalog snapshot in
`src/lib/models/registry.ts`. The quote is locked in `estimated_cost` when the
request is submitted. Successful completion records that locked amount in
`actual_cost`, usage reporting, and the applicable credit ledger; failed or
cancelled requests show **Not charged**. Higgsfield completion status does not
include an account invoice amount, so account discounts or later provider
adjustments can differ from Kibo's final recorded cost. Project cards show both
the non-failed estimated total and the completed final total.

## Project layout

```
src/
  app/
    (app)/          dashboard, create, library, projects, models,
                    usage, templates, brands, teams, settings
    api/            generation, workspace, assistant, billing, team, health,
                    and webhook routes
    login/          sign in / sign up / password reset
  components/       app-shell, generation-card
  lib/
    providers/      GenerationProvider interface + higgsfield.ts + registry
    models/         schema-driven model catalog (source of UI truth)
    generations/    validation (zod) + service (DB + provider + storage)
    billing/        personal and team credit ledgers + Stripe integration
    assistant/      rule-based and OpenAI-compatible prompt improvement
    supabase/       browser / server / service clients
  proxy.ts          session refresh + auth redirects
supabase/migrations/  Postgres schema + RLS
```

## Administrator operations

Global administrators are recorded in `app_admins`, which is separate from
team owner/admin roles. The `/admin` console is server-enforced, lists recent
queue activity, and can grant support credits through an audit-logged API.
Administrators are complimentary at Kibo's ledger layer, but provider usage
continues to be tracked and generation rate limits remain enabled to protect
the service. Grant this role only through a server-side Supabase Admin API or
a controlled migration; never expose a service-role key to the browser.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build (typechecks) |
| `npm start` | Serve production build |
| `npm run lint` | ESLint |
| `npm test` | Vitest suite |

## Roadmap

- **Phase 1 ✓** — auth, dashboard, Higgsfield integration, model registry,
  image+video generation, live status, library, secure storage, cost estimates,
  projects CRUD, regenerate, multi-output viewer.
- **Phase 2 ✓** — brand profiles (+ prompt injection on Create), prompt
  templates (9 seeds + custom, wired into Create), monthly spending limits
  (enforced pre-submit, managed in Settings, budget bar in Usage), spend by
  project.
- **Phase 3 ✓** — prompt assistant (rule-based built in, LLM via
  `ASSISTANT_*` env), team accounts (teams, email invites, shared projects,
  pooled team wallets with personal→team funding), credits/billing (prepaid
  ledger, $5 welcome grant, 402 enforcement, Stripe Checkout + webhook stub),
  second provider (free `mock` provider behind `MOCK_PROVIDER_ENABLED`,
  proving the abstraction), Higgsfield webhook receiver, Upstash Redis rate
  limiting (in-memory fallback), `/api/health` diagnostics panel in Settings,
  38-test vitest suite (`npm test`).

## Verify without spending (mock end-to-end)

1. Set `MOCK_PROVIDER_ENABLED=true` in `.env.local` (no Higgsfield key needed).
2. `npm run dev` → sign up → Create → pick **Mock Image** → Generate.
3. Watch it complete in ~8s, land in Library, and log $0.00 usage.
   This exercises submit → poll → storage copy → ledger → signed URLs.
4. Open Settings → Diagnostics for the live setup checklist.

## Troubleshooting

| Symptom | Check |
|---|---|
| Login redirects repeatedly | Confirm the Supabase URL and anonymous key, and add the local/deployed URL to the Supabase Auth redirect allow-list. |
| Upload fails | Confirm `kibo-inputs` exists and is public, and that the selected media type is JPEG, PNG, WebP, GIF, MP4, WAV, or MPEG audio. |
| Generation submit fails | Confirm both Higgsfield credentials are present on the server and that the model endpoint is available to the Higgsfield account. |
| Credit balance blocks a generation | Fund personal credits through Stripe when configured, or use the mock provider for no-cost verification. Team-project generations require a current team membership and a funded team wallet. |
| Generation never completes | The current app refreshes provider status while the client polls. Return to the Library or generation screen and inspect the stored provider error. |
| Output does not display | Confirm `kibo-outputs` exists and is private; the app creates a fresh signed URL when it serializes a generation. |
| A production check fails | Open Settings → Diagnostics. It reports migration, bucket, provider, assistant, and rate-limiter configuration without exposing secrets. |
