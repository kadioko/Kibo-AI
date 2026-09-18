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
  `-- Higgsfield API
```

The browser never calls Higgsfield directly. API credentials are read only by
server-side provider code.

## Main modules

| Area | Location | Responsibility |
| --- | --- | --- |
| Application pages | `kibo-ai/src/app/(app)` | Dashboard, create flow, library, projects, models, usage, settings, and planned Phase 2 surfaces. |
| API routes | `kibo-ai/src/app/api` | Authenticated access to generations, uploads, projects, usage, models, and dashboard stats. |
| Model registry | `kibo-ai/src/lib/models/registry.ts` | Source of truth for supported models, capabilities, settings, endpoints, and local cost estimates. |
| Provider interface | `kibo-ai/src/lib/providers` | Provider abstraction and Higgsfield implementation. |
| Generation service | `kibo-ai/src/lib/generations/service.ts` | Job creation, status refresh, storage copy, signed URLs, and usage logging. |
| Supabase clients | `kibo-ai/src/lib/supabase` | Browser, server, and privileged service-role clients. |
| Database schema | `kibo-ai/supabase/migrations/0001_kibo_init.sql` | Tables, indexes, seed data, and row-level security policies. |

## Generation lifecycle

1. The user selects a model, supplies a prompt, optional settings, and optional
   uploaded reference media.
2. Reference media is uploaded to the public `kibo-inputs` bucket with a signed
   upload URL. Its unguessable public URL is supplied to the provider when the
   chosen model supports that media role.
3. `POST /api/generations` validates the request with Zod, applies the local
   rate limit, derives safe/default settings from the model registry, estimates
   cost, and submits the job through the server-side provider.
4. The provider request ID and initial state are persisted in `generations`.
5. The client polls `GET /api/generations/[id]`. For non-terminal jobs, the
   server queries Higgsfield and updates the stored state.
6. On completion, output files are copied from the provider CDN into the
   private `kibo-outputs` bucket. A `generation_assets` record and a `usage_logs`
   record are created.
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
  `-- usage_logs
```

`providers` and `models` are public-read catalog tables. Phase 2 tables for
`brand_profiles` and `prompt_templates` are already included in the initial
migration.

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
