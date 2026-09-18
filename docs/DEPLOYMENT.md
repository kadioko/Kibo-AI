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

## Operational notes

Generation status is refreshed when the client polls the generation endpoint;
there is no provider webhook worker in the current release. Long-running jobs
therefore become terminal when the user returns to the relevant screen or when
the client continues polling.

Cost estimates are configured in the local model registry. Review
`src/lib/models/registry.ts` whenever provider pricing or model endpoints
change.
