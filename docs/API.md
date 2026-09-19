# API guide

All routes except webhooks require a Supabase-authenticated session. Errors use
JSON in the shape `{ "error": "message" }`; validation failures may include an
`issues` array. The browser client is implemented in `kibo-ai/src/lib/api.ts`.

## Workspace and generation routes

| Route | Methods | Purpose |
| --- | --- | --- |
| `/api/models` | `GET` | Available model catalog and capabilities. |
| `/api/uploads` | `POST` | Signed upload URL for supported reference media. |
| `/api/generations/estimate` | `POST` | Pre-submit generation cost estimate. |
| `/api/generations` | `GET`, `POST` | List or submit generations. Supports filters, pagination, and date range. |
| `/api/generations/:id` | `GET`, `DELETE` | Poll one generation or delete it and its private outputs. |
| `/api/generations/:id/assets` | `GET` | Signed URLs for all completed output files. |
| `/api/generations/:id/favorite` | `POST` | Toggle a favorite. |
| `/api/projects`, `/api/projects/:id` | `GET`, `POST`, `PATCH`, `DELETE` | Project management, including shared-team projects. |
| `/api/brands`, `/api/brands/:id` | `GET`, `POST`, `PATCH`, `DELETE` | Brand profile management. |
| `/api/templates`, `/api/templates/:id` | `GET`, `POST`, `DELETE` | Public and user-owned prompt templates. |
| `/api/stats`, `/api/usage`, `/api/limits` | `GET` (and `PUT /api/limits`) | Dashboard statistics, usage reporting, and monthly limits. |

## Phase 3 routes

| Route | Methods | Purpose |
| --- | --- | --- |
| `/api/assistant/improve` | `POST` | Improve a prompt using the rule-based or configured LLM assistant. |
| `/api/billing` | `GET` | Personal credit balance and recent ledger entries. |
| `/api/billing/checkout` | `POST` | Create a Stripe credit top-up session; returns `501` when Stripe is disabled. |
| `/api/teams` | `GET`, `POST` | List teams/pending invites or create a team. |
| `/api/teams/:id` | `DELETE` | Delete a team as its owner. |
| `/api/teams/:id/invites` | `POST`, `DELETE` | Create or revoke email invites. |
| `/api/teams/:id/membership` | `POST`, `DELETE` | Accept or decline the signed-in user’s invite. |
| `/api/teams/:id/members/:userId` | `DELETE` | Leave a team or remove a member as owner. |
| `/api/teams/:id/wallet` | `GET` | Team wallet balance and ledger entries. |
| `/api/teams/:id/fund` | `POST` | Move personal credits into a team wallet. |
| `/api/health` | `GET` | Authenticated, secret-safe deployment diagnostics. |

## Webhooks

- `POST /api/webhooks/stripe` receives raw Stripe events and requires a valid
  `stripe-signature` plus `STRIPE_WEBHOOK_SECRET`.
- `POST /api/webhooks/higgsfield` accepts `{ "request_id": "..." }` with an
  `Authorization: Bearer <HIGGSFIELD_WEBHOOK_SECRET>` header. It refreshes the
  matching generation; client polling remains enabled as a fallback.

Do not expose webhook secrets to the browser or call service-role operations
from client code.
