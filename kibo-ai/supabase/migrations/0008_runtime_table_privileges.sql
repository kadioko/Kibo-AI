-- PostgreSQL checks table privileges before RLS. The initial dashboard load
-- needs these reads; existing RLS policies still constrain each authenticated
-- user to their own records (or their current team records).
grant select on table generations, favorites, usage_logs, projects to authenticated;

-- The protected admin overview is executed server-side after requireAdmin().
grant select on table generations, usage_logs to service_role;
