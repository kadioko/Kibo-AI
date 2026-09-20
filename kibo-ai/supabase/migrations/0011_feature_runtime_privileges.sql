-- Table privileges are required in addition to RLS, even for service_role.
-- Forward repair: do not change previously applied migrations.
grant select on public.model_favorites to service_role;
grant insert, delete on public.favorites to service_role;
grant insert, update, delete on public.team_members, public.team_invites to service_role;

-- User-facing CRUD routes use the authenticated client. Existing RLS policies
-- still restrict each operation to the owner or the appropriate team members.
grant select, insert, update, delete on
  public.projects, public.brand_profiles, public.prompt_templates,
  public.spending_limits, public.teams, public.team_invites
to authenticated;
grant select, insert on public.team_members to authenticated;
grant select on public.providers, public.models to authenticated;

-- Billing and generation writes remain server-only. In particular, do not
-- grant browser writes to either credit ledger, usage logs, or app_admins.
