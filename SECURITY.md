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
bundles. The `kibo-inputs` bucket is intentionally public to let the generation
provider retrieve reference media; it must not be used for sensitive content.
Completed media belongs in the private `kibo-outputs` bucket.
