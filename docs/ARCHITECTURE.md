# Architecture

Kibo AI is a Next.js App Router application located in `kibo-ai/`. It keeps
provider credentials and privileged storage access on the server while using
Supabase for authentication, database persistence, and media storage.

## System overview

```text
Browser
  |  Supabase session cookies
  v
Next.js app and API routes
  |-- Supabase Auth / Postgres / Storage
  |-- Higgsfield API / optional mock provider
  |-- Stripe (optional credit top-ups)
  `-- Upstash Redis (optional distributed rate limiting)
```

The browser never calls Higgsfield directly. API credentials are read only by
server-side provider code.

## Main modules

| Area | Location | Responsibility |
| --- | --- | --- |
| Application pages | `kibo-ai/src/app/(app)` | Dashboard, Create, Library, projects, brands, templates, usage, teams, models, and settings. |
| API routes | `kibo-ai/src/app/api` | Authenticated generation, workspace, billing, assistant, team, diagnostics, and webhook endpoints. |
| Model registry | `kibo-ai/src/lib/models/registry.ts` | Source of truth for supported models, capabilities, settings, endpoints, and local cost estimates. |
| Provider interface | `kibo-ai/src/lib/providers` | Provider abstraction and Higgsfield implementation. |
| Generation service | `kibo-ai/src/lib/generations/service.ts` | Job creation, status refresh, storage copy, signed URLs, and usage logging. |
| Billing ledger | `kibo-ai/src/lib/billing` | Personal credits, team-wallet funding, generation debits, and Stripe checkout/webhook support. |
| Prompt assistant | `kibo-ai/src/lib/assistant` | Rule-based prompt improvement with an optional OpenAI-compatible backend. |
| Supabase clients | `kibo-ai/src/lib/supabase` | Browser, server, and privileged service-role clients. |
| Database schema | `kibo-ai/supabase/migrations` | Ordered schema, RLS, team, billing, and hardening migrations. |

## Generation lifecycle

1. The user selects a model, supplies a prompt, optional settings, and optional
   uploaded reference media.
2. Reference media is uploaded to the public `kibo-inputs` bucket with a signed
   upload URL. Its unguessable public URL is supplied to the provider when the
   chosen model supports that media role.
3. `POST /api/generations` validates the request with Zod, applies rate
   limiting, derives safe/default settings from the model registry, estimates
   cost, and verifies the personal or team credit balance before submitting the
   job through the server-side provider.
4. The provider request ID and initial state are persisted in `generations`.
5. The client polls `GET /api/generations/[id]`. For non-terminal jobs, the
   server queries Higgsfield and updates the stored state.
6. On completion, output files are copied from the provider CDN into the
   private `kibo-outputs` bucket. An idempotent `generation_assets` record,
   `usage_logs` record, and personal or team wallet debit are created.
7. The API serializes private storage paths into seven-day signed URLs for the
   authenticated owner.

## Data model

All user-owned records contain a `user_id` and are protected by Supabase row
level security. Core relationships are:

```text
auth.users
  |-- projects
  |-- generations --< generation_assets
  |                `-- favorites
  |-- usage_logs
  |-- credit_ledger
  `-- teams --< team_members / team_invites / team_credit_ledger
```

`providers` and `models` are public-read catalog tables. Brands, templates,
spending limits, teams, invites, and credit ledgers are protected by row-level
security and service-layer authorization checks.

## Security boundaries

- Higgsfield credentials use server-only environment variables and must never
  be prefixed with `NEXT_PUBLIC_`.
- The service-role Supabase key is used only in server code for operations such
  as copying provider output into private storage.
- The `kibo-inputs` bucket is public so Higgsfield can retrieve user-provided
  reference media. Paths include a user ID and UUID; do not put sensitive files
  in this bucket.
- The `kibo-outputs` bucket is private. The application returns signed URLs,
  not permanent public paths.
- `proxy.ts` refreshes Supabase sessions and redirects unauthenticated users
  away from protected application routes.
- A team project may use a team wallet only while the submitting user is a
  current member of that team; the generation snapshots its funding team.
- Stripe webhooks are signature-verified. Higgsfield webhooks use a configured
  Bearer secret and only accelerate the normal polling lifecycle.
