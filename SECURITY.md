# Security policy

## Supported version

Security fixes are applied to the latest code on the `master` branch.

## Reporting a vulnerability

Please do not open a public issue for a suspected vulnerability. Contact the
repository owner privately through GitHub with:

- a clear description of the issue;
- affected files, endpoints, or deployment configuration;
- safe reproduction steps or proof of concept; and
- the potential impact.

Allow time for acknowledgement and remediation before disclosing details
publicly.

## Deployment responsibilities

Operators should keep `SUPABASE_SERVICE_ROLE_KEY`, Higgsfield credentials, and
all other secret environment variables out of source control and client-side
bundles. This includes Stripe, Upstash Redis, prompt-assistant, and Higgsfield
webhook secrets. The `kibo-inputs` bucket is intentionally public to let the
generation provider retrieve reference media; it must not be used for sensitive
content. Completed media belongs in the private `kibo-outputs` bucket.

Keep Supabase row-level security enabled and apply every migration in order:
the later migrations enforce template ownership, team-project membership, and
idempotency constraints for completion and wallet records. Configure Stripe to
send events only to `/api/webhooks/stripe`; Stripe signature verification is
required. If Higgsfield callbacks are enabled, protect
`/api/webhooks/higgsfield` with `HIGGSFIELD_WEBHOOK_SECRET` as a Bearer token.
