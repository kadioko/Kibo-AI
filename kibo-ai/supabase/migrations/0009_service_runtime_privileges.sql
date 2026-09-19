-- Service-only operations run after application route authorization and need
-- explicit PostgreSQL privileges in addition to the service role's RLS bypass.
-- No browser role receives any of these grants.

grant select on table
  providers,
  models,
  projects,
  favorites,
  brand_profiles,
  prompt_templates,
  spending_limits,
  teams,
  team_members,
  team_invites,
  app_admins
to service_role;

grant select, insert, update, delete on table
  generations,
  generation_assets,
  usage_logs,
  credit_ledger,
  team_credit_ledger
to service_role;

grant insert on table admin_audit_log to service_role;
