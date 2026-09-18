# Kibo AI — AI Creative Studio

Mobile-first studio for generating images and videos with frontier AI models
through the Higgsfield API. Next.js App Router · TypeScript · Tailwind ·
Supabase (Auth, Postgres, Storage) · Vercel.

Repository-level documentation is available in the parent directory:
[architecture](../docs/ARCHITECTURE.md), [deployment](../docs/DEPLOYMENT.md),
[contributing](../CONTRIBUTING.md), and [security](../SECURITY.md).

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
Set `kibo-ai` as the Vercel project root directory, then add the deployed URL
to Supabase Authentication's Site URL and redirect allow-list.

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
  image+video generation, live status, library, secure storage, cost estimates,
  projects CRUD, regenerate, multi-output viewer.
- **Phase 2 ✓** — brand profiles (+ prompt injection on Create), prompt
  templates (9 seeds + custom, wired into Create), monthly spending limits
  (enforced pre-submit, managed in Settings, budget bar in Usage), spend by
  project.
- **Phase 3** — prompt assistant service + LLM wiring, credits/billing,
  extra providers (drop a new `GenerationProvider` into `src/lib/providers/`),
  webhook endpoint (polling works).

## Troubleshooting

| Symptom | Check |
|---|---|
| Login redirects repeatedly | Confirm the Supabase URL and anonymous key, and add the local/deployed URL to the Supabase Auth redirect allow-list. |
| Upload fails | Confirm `kibo-inputs` exists and is public, and that the selected media type is JPEG, PNG, WebP, GIF, MP4, WAV, or MPEG audio. |
| Generation submit fails | Confirm both Higgsfield credentials are present on the server and that the model endpoint is available to the Higgsfield account. |
| Generation never completes | The current app refreshes provider status while the client polls. Return to the Library or generation screen and inspect the stored provider error. |
| Output does not display | Confirm `kibo-outputs` exists and is private; the app creates a fresh signed URL when it serializes a generation. |
