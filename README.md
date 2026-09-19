# Kibo AI

Kibo AI is a multi-user creative studio for generating images and video with
frontier models available through the Higgsfield API. It gives each user a
private workspace for creating, organizing, and tracking AI-generated media.

The application lives in [`kibo-ai/`](./kibo-ai). It is built with Next.js,
TypeScript, Supabase, Higgsfield, and optional Stripe, Upstash Redis, and an
OpenAI-compatible prompt assistant.

## What it does

- Generate images and videos from prompts and supported reference media.
- Choose from a schema-driven catalog of image and video models.
- Estimate a generation cost before submission and record actual spend.
- Track queued and in-progress jobs from the dashboard and library.
- Keep generated outputs private in Supabase Storage and serve them with
  time-limited URLs.
- Organize work into projects and mark useful generations as favorites.
- Share projects with teams, manage pooled team wallets, and invite members.
- Improve prompts with a built-in assistant or an optional LLM backend.
- Test the full generation lifecycle without provider spend using the mock
  provider.

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
- [API guide](./docs/API.md) — authenticated routes, webhooks, and operational endpoints.
- [Deployment](./docs/DEPLOYMENT.md) — Supabase and Vercel setup.
- [Contributing](./CONTRIBUTING.md) — local workflow and pull-request guidance.
- [Security](./SECURITY.md) — reporting process and deployment considerations.
- [Product roadmap](./PLAN.md) — implemented and planned phases.

## Status

Phases 1–3 are implemented: generation workflows, brands and templates,
spending controls, prompt assistance, teams, prepaid credits, Stripe top-up
integration, webhooks, a mock provider, and automated tests. See
[PLAN.md](./PLAN.md) for current scope and operational caveats.

## License

No license has been selected for this repository. All rights are reserved until
a license is added.
