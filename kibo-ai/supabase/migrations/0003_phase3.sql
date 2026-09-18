-- Kibo AI Phase 3: teams, project sharing, internal credits ledger.

-- ── Teams ────────────────────────────────────────────────────────────────
create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  owner_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists team_members (
  team_id uuid not null references teams (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (team_id, user_id)
);

create table if not exists team_invites (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams (id) on delete cascade,
  email text not null,
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  unique (team_id, email)
);

create index if not exists team_invites_email_idx on team_invites (email);

-- Projects can belong to a team; generations inherit visibility via project.
alter table projects
  add column if not exists team_id uuid references teams (id) on delete set null;

-- ── Membership helpers (security definer: RLS-safe) ──────────────────────
create or replace function is_team_member(tid uuid)
returns boolean
language sql
security definer
set search_path = public
stable as $$
  select exists (
    select 1 from team_members
    where team_id = tid and user_id = auth.uid()
  );
$$;

create or replace function team_role(tid uuid)
returns text
language sql
security definer
set search_path = public
stable as $$
  select role from team_members
  where team_id = tid and user_id = auth.uid()
  limit 1;
$$;

-- ── RLS ──────────────────────────────────────────────────────────────────
alter table teams enable row level security;
alter table team_members enable row level security;
alter table team_invites enable row level security;

create policy "team_visible" on teams
  for select using (
    auth.uid() = owner_id or is_team_member(id)
  );
create policy "team_create" on teams
  for insert with check (auth.uid() = owner_id);
create policy "team_owner_write" on teams
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "team_owner_delete" on teams
  for delete using (auth.uid() = owner_id);

create policy "members_visible" on team_members
  for select using (is_team_member(team_id));
create policy "members_owner_write" on team_members
  for all using (
    exists (select 1 from teams where id = team_id and owner_id = auth.uid())
  ) with check (
    exists (select 1 from teams where id = team_id and owner_id = auth.uid())
  );

create policy "invites_visible" on team_invites
  for select using (
    is_team_member(team_id)
    or lower(email) = lower((select auth.jwt() ->> 'email'))
  );
create policy "invites_manage" on team_invites
  for all using (is_team_member(team_id)) with check (is_team_member(team_id));

-- Projects: owners plus members of the assigned team can read; project
-- owners (or team owners) can write. Service-layer code enforces the same
-- rules explicitly where it bypasses RLS.
drop policy if exists "own_projects" on projects;
create policy "projects_read" on projects
  for select using (
    auth.uid() = user_id
    or (team_id is not null and is_team_member(team_id))
  );
create policy "projects_insert" on projects
  for insert with check (
    auth.uid() = user_id
    and (team_id is null or is_team_member(team_id))
  );
create policy "projects_update" on projects
  for update using (
    auth.uid() = user_id
    or (team_id is not null and team_role(team_id) in ('owner', 'admin'))
  );
create policy "projects_delete" on projects
  for delete using (
    auth.uid() = user_id
    or (team_id is not null and team_role(team_id) = 'owner')
  );

-- Generations: owners plus members of the project team can read.
-- Writes go through the service client, which checks access in code.
drop policy if exists "own_generations" on generations;
create policy "generations_read" on generations
  for select using (
    auth.uid() = user_id
    or exists (
      select 1 from projects
      where projects.id = generations.project_id
        and projects.team_id is not null
        and is_team_member(projects.team_id)
    )
  );
create policy "generations_insert" on generations
  for insert with check (auth.uid() = user_id);

-- ── Internal credits ledger (1 credit = $1 USD of provider spend) ─────────
create table if not exists credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  amount numeric(10, 4) not null,
  reason text not null,
  generation_id uuid references generations (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists credit_ledger_user_created_idx
  on credit_ledger (user_id, created_at desc);

-- Welcome grant is issued at most once per user.
create unique index if not exists credit_ledger_welcome_once
  on credit_ledger (user_id) where reason = 'welcome';

alter table credit_ledger enable row level security;

create policy "own_ledger" on credit_ledger
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
