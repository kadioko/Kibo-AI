-- Kibo AI deployment hardening.
-- Run after 0001_kibo_init.sql through 0004_team_wallets.sql.

-- A previous migration was named 0003_integrity_and_template_rls.sql, which
-- clashes with 0003_phase3.sql in migration runners that require unique
-- versions. This replacement intentionally runs last and is safe if the old
-- SQL was applied manually.

-- Keep completion, usage, and wallet debits idempotent across concurrent
-- polling and webhook delivery. Remove historical duplicates first.
delete from generation_assets
where id in (
  select id from (
    select id, row_number() over (
      partition by generation_id, storage_path order by created_at asc, id asc
    ) as duplicate_number
    from generation_assets
  ) as duplicates where duplicate_number > 1
);

delete from usage_logs
where id in (
  select id from (
    select id, row_number() over (
      partition by generation_id order by created_at asc, id asc
    ) as duplicate_number
    from usage_logs where generation_id is not null
  ) as duplicates where duplicate_number > 1
);

delete from credit_ledger
where id in (
  select id from (
    select id, row_number() over (
      partition by generation_id order by created_at asc, id asc
    ) as duplicate_number
    from credit_ledger where generation_id is not null
  ) as duplicates where duplicate_number > 1
);

delete from team_credit_ledger
where id in (
  select id from (
    select id, row_number() over (
      partition by generation_id order by created_at asc, id asc
    ) as duplicate_number
    from team_credit_ledger where generation_id is not null
  ) as duplicates where duplicate_number > 1
);

create unique index if not exists generation_assets_generation_storage_unique
  on generation_assets (generation_id, storage_path);
create unique index if not exists usage_logs_generation_unique
  on usage_logs (generation_id);
create unique index if not exists credit_ledger_generation_unique
  on credit_ledger (generation_id);
create unique index if not exists team_credit_ledger_generation_unique
  on team_credit_ledger (generation_id);

-- Public templates are readable by every authenticated user, but only their
-- owners may mutate private templates. DELETE evaluates only USING, so a
-- broad all-operations policy would otherwise let anyone delete public seeds.
drop policy if exists "visible_templates" on prompt_templates;
drop policy if exists "read_public_or_own_templates" on prompt_templates;
drop policy if exists "insert_own_templates" on prompt_templates;
drop policy if exists "update_own_templates" on prompt_templates;
drop policy if exists "delete_own_templates" on prompt_templates;

create policy "read_public_or_own_templates" on prompt_templates
  for select using (is_public = true or auth.uid() = user_id);
create policy "insert_own_templates" on prompt_templates
  for insert with check (auth.uid() = user_id and is_public = false);
create policy "update_own_templates" on prompt_templates
  for update using (auth.uid() = user_id and is_public = false)
  with check (auth.uid() = user_id and is_public = false);
create policy "delete_own_templates" on prompt_templates
  for delete using (auth.uid() = user_id and is_public = false);

-- Project owners may attach a project only to a team they currently belong
-- to. Team owners/admins retain control over projects in their team.
drop policy if exists "projects_update" on projects;
create policy "projects_update" on projects
  for update using (
    auth.uid() = user_id
    or (team_id is not null and team_role(team_id) in ('owner', 'admin'))
  ) with check (
    (auth.uid() = user_id and (team_id is null or is_team_member(team_id)))
    or (team_id is not null and team_role(team_id) in ('owner', 'admin'))
  );
