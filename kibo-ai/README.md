# Kibo AI — AI Creative Studio

Mobile-first studio for generating images and videos with frontier AI models
through the Higgsfield API. Next.js App Router · TypeScript · Tailwind ·
Supabase (Auth, Postgres, Storage) · Vercel.

## Quick start

```bash
cd kibo-ai
npm install
cp .env.example .env.local   # then fill in the values below
npm run dev                  # http://localhost:3000
```

## 1. Supabase setup

1. Create a project at supabase.com.
2. **SQL editor** → run `supabase/migrations/0001_kibo_init.sql`
   (tables, indexes, RLS policies, `higgsfield` provider seed).
3. **Storage** → create two buckets:
   - `kibo-inputs` — **PUBLIC** (reference uploads; unguessable UUID paths
     so the provider can fetch them).
   - `kibo-outputs` — **PRIVATE** (finished media; served via signed URLs).
4. **Authentication** → enable Email provider.

## 2. Environment

| Variable | Where | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API | Client + server Supabase access |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API | Public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API | Server jobs (storage copy). Never `NEXT_PUBLIC_` |
| `HIGGSFIELD_API_KEY_ID` | console.higgsfield.ai | Provider auth (server-only) |
| `HIGGSFIELD_API_KEY_SECRET` | console.higgsfield.ai | Provider auth (server-only) |
| `HIGGSFIELD_API_BASE_URL` | — | Default `https://api.higgsfield.ai` |
| `NEXT_PUBLIC_APP_URL` | — | Used for password-reset links |

Higgsfield credentials never reach the browser: all provider calls go through
`src/lib/providers/*` from API routes.

## 3. Deploy (Vercel)

```bash
vercel --prod
```

Set the same env vars in Vercel → Project → Settings → Environment Variables.

## Generation flow

```
Create screen → POST /api/generations → validate (zod) → rate limit
  → provider.createGeneration() → insert `generations` row (queued)
  → client polls GET /api/generations/[id] every 4s
  → terminal? completed → download CDN file → kibo-outputs → usage_logs
```

## Project layout

```
src/
  app/
    (app)/          dashboard, create, library, projects, models,
                    usage, templates, brands, settings
    api/            generations, models, projects, stats, usage, uploads
    login/          sign in / sign up / password reset
  components/       app-shell, generation-card
  lib/
    providers/      GenerationProvider interface + higgsfield.ts + registry
    models/         schema-driven model catalog (source of UI truth)
    generations/    validation (zod) + service (DB + provider + storage)
    supabase/       browser / server / service clients
  proxy.ts          session refresh + auth redirects
supabase/migrations/  Postgres schema + RLS
```

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build (typechecks) |
| `npm start` | Serve production build |
| `npm run lint` | ESLint |

## Roadmap

- **Phase 1 ✓** — auth, dashboard, Higgsfield integration, model registry,
  image+video generation, live status, library, secure storage, cost estimates.
- **Phase 2** — brand profiles, prompt templates, usage analytics depth,
  spending limits, team projects (tables already in schema).
- **Phase 3** — prompt assistant (LLM), credits/billing, extra providers
  (drop a new `GenerationProvider` into `src/lib/providers/`).
