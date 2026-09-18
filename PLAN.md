# Kibo AI — Implementation Plan

## 1. Reference inspection (done)

**Repo:** `wide-trace/open-higgsfield` (single-page studio, Next.js 16, Zustand,
Vercel Blob, IndexedDB). **License: none found** — no LICENSE file in the
repo, so no source was copied. Kibo AI is an original implementation inspired
by its patterns. Full notes in `../ANALYSIS.md`.

## 2. What was reused (patterns, not code)

- Declarative model catalog → `src/lib/models/registry.ts` (capabilities,
  settings schema, endpoints, pricing; UI renders from it).
- `GenerationPlane → platform body` mapping → `buildPlatformBody()`.
- Server-side-only provider calls → `src/lib/providers/higgsfield.ts`.
- Batched polling with terminal statuses → API polling + `refreshGenerationRecord()`.
- Composer / gallery / viewer UX ideas → Create screen, Library, GenerationCard.

## 3. What was rewritten (multi-user SaaS)

IndexedDB → Postgres + RLS · cookie key → Supabase Auth · Vercel Blob →
Supabase Storage (private outputs, signed URLs) · single-user → per-user
isolation · plus cost tracking, projects, favorites, usage analytics.

## 4. Folder structure — see `kibo-ai/README.md` (built as documented).

## 5. Database schema — `kibo-ai/supabase/migrations/0001_kibo_init.sql`

providers · models · projects · generations (all spec fields incl.
estimated/actual cost, provider_request_id, error, output/thumbnail URLs) ·
generation_assets · favorites · brand_profiles · prompt_templates ·
usage_logs. RLS: user-owned rows only; public read on catalog tables.

## 6. Phase status

- [x] **Phase 1:** auth (login/signup/reset/logout), dashboard (5 stat cards,
  recent, models), Higgsfield integration (submit/status/cancel, Key auth),
  model registry (16 models, dynamic settings UI), image + video generation,
  live status (no refresh), library (search, filters, download/favorite/
  reuse/delete), storage copy + signed URLs, pre-submit cost estimates,
  zod validation, rate limiting, projects CRUD.
- [x] **Phase 1 polish:** docs-verified pricing (Soul 2 $0.0032/img, Seedance
  2.5 $0.1234/s, Kling $0.084/s std, Wan 3 $0.05/s; estimates use list rates,
  account discounts lower the real charge), corrected Recraft endpoint +
  schemas (integer batch_size, sound on/off, aspect allow-lists, seed input),
  negative_prompt gated on capability, project rename/delete, ⚡Regenerate
  (reuse + auto-submit), multi-output viewer modal.
- [x] **Phase 2:** brand profiles CRUD + prompt-context injection on Create,
  prompt templates (9 public seeds + custom, model/aspect/duration applied on
  Create), monthly spending limits (migration 0002, 402 enforcement
  pre-submit, Settings UI, Usage budget bar), spend by project.
- [x] **Phase 3:** prompt assistant (rule-based built in, OpenAI-compatible
  LLM via env, brand-aware, rate-limited), team accounts (teams, email
  invites with accept/decline, member roles, shared projects with RLS +
  service-layer access checks), credits/billing (prepaid ledger, welcome
  grant, 402 enforcement pre-submit, debit on completion only, Stripe
  Checkout + webhook stub, balance + ledger UI), second provider (free mock
  provider proving `GenerationProvider` is plug-and-play), Higgsfield
  webhook receiver, 26-test vitest suite.
- [x] **Bug-fix pass:** `/auth/confirm` recovery flow + password form, JSON
  401s for logged-out API calls, provider cancel on DB-insert failure,
  finalize idempotency (usage + assets), storage cleanup on delete,
  StrictMode double-submit guard, 10/15-min polling deadlines,
  fixed a REAL upsert-without-constraint crash in usage logging, boolean
  defaults, 4-decimal money precision.

## 7. To run it

Supabase project → run migrations 0001 + 0002 + 0003 → create
`kibo-inputs` (public) + `kibo-outputs` (private) buckets → allow-list
`/auth/confirm` in Supabase URL config → Higgsfield key → `.env.local`
→ `npm run dev` (+ `npm test`). Details in `kibo-ai/README.md`.
