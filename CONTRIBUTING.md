# Contributing

Thanks for contributing to Kibo AI. The application lives in `kibo-ai/`; run
all Node commands from that directory.

## Local setup

1. Install Node.js 20.9 or later.
2. Copy `.env.example` to `.env.local` and configure Supabase and Higgsfield.
3. Run every migration in `supabase/migrations/` in filename order, and create
   the required storage buckets. Do not run migrations selectively.
4. Install dependencies and start the development server:

   ```bash
   cd kibo-ai
   npm install
   npm run dev
   ```

## Before opening a pull request

```bash
cd kibo-ai
npm run lint
npm test
npm run build
```

Describe the user-visible change, any data migration or configuration impact,
and how you verified it. Keep commits focused: do not combine unrelated
formatting, feature, and dependency changes.

## Project conventions

- Use TypeScript and keep browser/server concerns separate. Provider clients
  and secrets belong in server-only modules.
- Treat `src/lib/models/registry.ts` as the model catalog source of truth.
  Add model settings and capabilities there rather than hard-coding behavior in
  page components.
- Validate API input with the schemas in `src/lib/generations/validation.ts`.
- Scope every user-owned database operation to the authenticated user, even if
  row-level security also protects it.
- Keep outputs private and serialize them through signed URLs.
- Add a Supabase migration for schema changes; do not edit an applied
  migration in a deployed environment.
- Use the mock provider for generation-flow tests where provider credentials
  or paid model calls are unnecessary.
- Treat credit and team-wallet mutations as idempotent: one generation may
  create at most one usage record and one wallet debit.

## Secrets and generated files

Never commit `.env.local`, API keys, Supabase service-role keys, media outputs,
or build artifacts. `.env*`, `.next/`, and `node_modules/` are ignored by the
application's `.gitignore`.
