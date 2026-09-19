-- Global application administrators. This is deliberately separate from
-- team roles: a team admin only controls one team, while an app admin can use
-- the protected operations console.

create table if not exists app_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  granted_by uuid references auth.users (id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references auth.users (id) on delete cascade,
  action text not null check (char_length(action) between 1 and 120),
  target_user_id uuid references auth.users (id) on delete set null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_log_created_idx
  on admin_audit_log (created_at desc);
create index if not exists admin_audit_log_target_user_idx
  on admin_audit_log (target_user_id, created_at desc);

alter table app_admins enable row level security;
alter table admin_audit_log enable row level security;

-- There are intentionally no client policies. All reads and writes are made
-- by server routes with the service role after requireAdmin() succeeds.
revoke all on table app_admins from anon, authenticated;
revoke all on table admin_audit_log from anon, authenticated;
