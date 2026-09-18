# Kibo AI

Kibo AI is a multi-user creative studio for generating images and video with
frontier models available through the Higgsfield API. It gives each user a
private workspace for creating, organizing, and tracking AI-generated media.

The application lives in [`kibo-ai/`](./kibo-ai). It is built with Next.js,
TypeScript, Supabase, and Higgsfield.

## What it does

- Generate images and videos from prompts and supported reference media.
- Choose from a schema-driven catalog of image and video models.
- Estimate a generation cost before submission and record actual spend.
- Track queued and in-progress jobs from the dashboard and library.
- Keep generated outputs private in Supabase Storage and serve them with
  time-limited URLs.
- Organize work into projects and mark useful generations as favorites.

## Quick start

Requirements: Node.js 20.9 or later, a Supabase project, and Higgsfield API
credentials.

```bash
cd kibo-ai
npm install
Copy-Item .env.example .env.local
npm run dev
```

Add the required values to `.env.local`, run the database migration, configure
the storage buckets, and open `http://localhost:3000`.

For the full setup sequence, see [the application README](./kibo-ai/README.md).

## Documentation

- [Architecture](./docs/ARCHITECTURE.md) — components, data flow, and security model.
- [Deployment](./docs/DEPLOYMENT.md) — Supabase and Vercel setup.
- [Contributing](./CONTRIBUTING.md) — local workflow and pull-request guidance.
- [Security](./SECURITY.md) — reporting process and deployment considerations.
- [Product roadmap](./PLAN.md) — implemented and planned phases.

## Status

Phase 1 is implemented: authentication, image/video generation, model
selection, projects, library management, secure storage, generation polling,
and cost estimates. Phase 2 adds brand profiles, prompt templates, usage
breakdowns, and monthly spending limits. Team projects, billing, prompt
assistance, and additional providers remain planned.

## License

No license has been selected for this repository. All rights are reserved until
a license is added.
