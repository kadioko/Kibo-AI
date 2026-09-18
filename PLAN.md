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
- [ ] **Phase 2:** brand profiles (+ prompt-context injection), prompt
  templates (apply to Create), usage depth (spend by project), spending
  limits, team projects. Tables already exist.
- [ ] **Phase 3:** prompt assistant service + LLM wiring, credits/billing,
  second provider via `GenerationProvider`.

## 7. To run it

Supabase project → run migration → create `kibo-inputs` (public) +
`kibo-outputs` (private) buckets → Higgsfield key → `.env.local` →
`npm run dev`. Details in `kibo-ai/README.md`.
