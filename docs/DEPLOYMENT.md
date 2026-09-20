# Deployment

This guide deploys the Kibo AI application in `kibo-ai/` to Vercel with
Supabase as the backend.

## 1. Create and configure Supabase

1. Create a Supabase project.
2. In the SQL Editor, run every migration in `kibo-ai/supabase/migrations/`
   in numeric order.
3. In **Storage**, create these buckets:
   - `kibo-inputs` — public; used for provider-accessible reference uploads.
   - `kibo-outputs` — private; used for completed image and video files.
4. In **Authentication**, enable the Email provider.
5. Add the deployed application URL to the Authentication URL configuration
   (site URL and allowed redirect URLs). Include the local URL for development
   as well.

## 2. Configure the application

Copy `kibo-ai/.env.example` to `kibo-ai/.env.local` for local development.
For Vercel, add the same values under **Project Settings → Environment
Variables**.

| Variable | Required | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Browser-safe Supabase anonymous key. |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server-only key; never expose it to the browser. |
| `HIGGSFIELD_API_KEY_ID` | Yes | Higgsfield API credential ID. |
| `HIGGSFIELD_API_KEY_SECRET` | Yes | Higgsfield API credential secret. |
| `HIGGSFIELD_API_BASE_URL` | No | Defaults to `https://api.higgsfield.ai`. |
| `NEXT_PUBLIC_APP_URL` | Yes | The canonical app URL, used for password-reset links. |
| `MOCK_PROVIDER_ENABLED` | No | Set `true` for no-cost end-to-end verification. |
| `WELCOME_CREDITS_USD` | No | New-user credit grant; defaults to `5`. |
| `ASSISTANT_API_URL`, `ASSISTANT_API_KEY`, `ASSISTANT_MODEL` | No | Enables an OpenAI-compatible prompt assistant. |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | No | Enables distributed rate limiting; otherwise the app uses in-memory limits. |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | No | Enables Stripe credit top-ups and verified Stripe webhooks. |
| `HIGGSFIELD_WEBHOOK_SECRET` | No | Protects the optional Higgsfield completion webhook. |

## 3. Deploy to Vercel

Set Vercel's project root directory to `kibo-ai`, then deploy:

```bash
cd kibo-ai
npm ci
npm run build
vercel --prod
```

Alternatively, import the repository in Vercel, select `kibo-ai` as the root
directory, add the environment variables, and deploy from the Vercel UI.

## 4. Verify after deployment

- Create an account and confirm that protected routes redirect correctly.
- Submit one image generation and one video generation that your Higgsfield
  account supports.
- Confirm that reference uploads land in `kibo-inputs` and completed output
  lands in `kibo-outputs`.
- Confirm the completed item appears in the Library and that its output URL is
  signed rather than a permanent storage URL.
- Request a password reset and verify the email link returns to the deployed
  domain.
- Open **Settings → Diagnostics** and confirm the database, storage, provider,
  and rate-limiter checks match the intended deployment.
- For an authenticated production smoke test, set `SMOKE_BASE_URL`,
  `SMOKE_EMAIL`, and `SMOKE_PASSWORD`, then run `npm run smoke` from
  `kibo-ai/`. The script keeps the session in memory and does not mutate data.
- If Stripe is enabled, complete a test-mode top-up and verify the webhook adds
  a single ledger credit.

## Operational notes

Generation status is refreshed when the client polls the generation endpoint.
The optional Higgsfield webhook can accelerate finalization, but polling remains
the reliable completion path. Long-running jobs therefore become terminal when
the client returns to the relevant screen or continues polling.

Cost estimates are configured in the local model registry. Review
`src/lib/models/registry.ts` whenever provider pricing or model endpoints
change.

For a no-cost deployment smoke test, set `MOCK_PROVIDER_ENABLED=true`, create
an account, select **Mock Image** on Create, and wait for the generated test
asset to appear in Library. Disable the mock provider in production unless it
is deliberately available to users.
