-- Kibo AI gap closure: pooled team wallets with attribution snapshots.

-- Snapshot the funding team on each generation so spend attribution survives
-- project moves and member departures.
alter table generations
  add column if not exists team_id uuid references teams (id) on delete set null;

create index if not exists generations_team_idx on generations (team_id);

-- Backfill from current project assignment.
update generations g
set team_id = p.team_id
from projects p
where p.id = g.project_id
  and p.team_id is not null
  and g.team_id is null;

-- Team wallet ledger. Positive = funding, negative = generation spend.
-- The balance IS the team cap: submits check it, finalize debits it.
create table if not exists team_credit_ledger (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams (id) on delete cascade,
  amount numeric(10, 4) not null,
  reason text not null,
  generation_id uuid references generations (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists team_credit_ledger_team_created_idx
  on team_credit_ledger (team_id, created_at desc);

alter table team_credit_ledger enable row level security;

-- Members read their teams' wallets. All writes go through the service
-- client, which verifies membership in code (no insert/update/delete policy).
create policy "team_ledger_read" on team_credit_ledger
  for select using (is_team_member(team_id));
