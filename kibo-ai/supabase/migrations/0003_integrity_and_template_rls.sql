-- Kibo AI integrity + access-control hardening.
-- Apply after 0001_kibo_init.sql and 0002_phase2.sql.

-- A completed generation has one usage-log entry, and each stored output path
-- is represented once. Clean up any historic race duplicates before enforcing
-- those invariants.
delete from generation_assets
where id in (
  select id
  from (
    select
      id,
      row_number() over (
        partition by generation_id, storage_path
        order by created_at asc, id asc
      ) as row_number
    from generation_assets
  ) as duplicates
  where row_number > 1
);

delete from usage_logs
where id in (
  select id
  from (
    select
      id,
      row_number() over (
        partition by generation_id
        order by created_at asc, id asc
      ) as row_number
    from usage_logs
    where generation_id is not null
  ) as duplicates
  where row_number > 1
);

create unique index if not exists generation_assets_generation_storage_unique
  on generation_assets (generation_id, storage_path);
create unique index if not exists usage_logs_generation_unique
  on usage_logs (generation_id);

-- The previous all-operations policy allowed every authenticated user to
-- delete a public template because DELETE only evaluates its USING clause.
drop policy if exists "visible_templates" on prompt_templates;

create policy "read_public_or_own_templates" on prompt_templates
  for select using (is_public = true or auth.uid() = user_id);
create policy "insert_own_templates" on prompt_templates
  for insert with check (auth.uid() = user_id and is_public = false);
create policy "update_own_templates" on prompt_templates
  for update using (auth.uid() = user_id and is_public = false)
  with check (auth.uid() = user_id and is_public = false);
create policy "delete_own_templates" on prompt_templates
  for delete using (auth.uid() = user_id and is_public = false);
