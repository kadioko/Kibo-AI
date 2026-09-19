-- The service role intentionally bypasses RLS but still needs table
-- privileges when new tables are created outside Supabase's default grants.
grant select, insert, update, delete on table app_admins to service_role;
grant select, insert on table admin_audit_log to service_role;
