-- Kibo AI initial schema — Phase 1 + Phase 2 tables.
-- Run with: supabase db push  (or paste into the Supabase SQL editor)

-- ── Providers & model catalog (synced from the registry) ───────────────────
create table if not exists providers (
  id text primary key,
  label text not null,
  created_at timestamptz not null default now()
);

create table if not exists models (
  id text primary key,
  provider text not null references providers (id),
  label text not null,
  generation_type text not null check (generation_type in ('image', 'video')),
  capabilities jsonb not null default '{}',
  settings_schema jsonb not null default '{}',
  endpoints jsonb not null default '{}',
  pricing jsonb not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ── Projects ───────────────────────────────────────────────────────────────
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

-- ── Generations ────────────────────────────────────────────────────────────
create table if not exists generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  project_id uuid references projects (id) on delete set null,
  provider text not null default 'higgsfield',
  model text not null,
  generation_type text not null check (generation_type in ('image', 'video')),
  prompt text not null,
  negative_prompt text,
  input_assets jsonb not null default '[]',
  settings jsonb not null default '{}',
  estimated_cost numeric(10, 4),
  actual_cost numeric(10, 4),
  provider_request_id text,
  status text not null default 'draft'
    check (status in ('draft', 'queued', 'processing', 'completed', 'failed', 'cancelled')),
  error text,
  output_url text,
  thumbnail_url text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists generations_user_created_idx
  on generations (user_id, created_at desc);
create index if not exists generations_user_status_idx
  on generations (user_id, status);
create index if not exists generations_provider_request_idx
  on generations (provider_request_id);

-- ── Finished assets (one row per output file) ──────────────────────────────
create table if not exists generation_assets (
  id uuid primary key default gen_random_uuid(),
  generation_id uuid not null references generations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  storage_path text not null,
  mime_type text,
  width int,
  height int,
  duration_seconds numeric(8, 2),
  created_at timestamptz not null default now()
);

create index if not exists generation_assets_generation_idx
  on generation_assets (generation_id);

-- ── Favorites ──────────────────────────────────────────────────────────────
create table if not exists favorites (
  user_id uuid not null references auth.users (id) on delete cascade,
  generation_id uuid not null references generations (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, generation_id)
);

-- ── Brand profiles (Phase 2) ───────────────────────────────────────────────
create table if not exists brand_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  description text,
  website text,
  logo_url text,
  colors jsonb not null default '[]',
  industry text,
  target_audience text,
  visual_style text,
  ad_tone text,
  default_cta text,
  created_at timestamptz not null default now()
);

-- ── Prompt templates (Phase 2) ─────────────────────────────────────────────
create table if not exists prompt_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  name text not null,
  description text,
  prompt_structure text not null,
  aspect_ratio text,
  recommended_models jsonb not null default '[]',
  duration_seconds numeric(8, 2),
  is_public boolean not null default false,
  created_at timestamptz not null default now()
);

-- ── Usage log (every billed event) ─────────────────────────────────────────
create table if not exists usage_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  generation_id uuid references generations (id) on delete set null,
  provider text not null default 'higgsfield',
  model text not null,
  project_id uuid references projects (id) on delete set null,
  cost_usd numeric(10, 4) not null,
  created_at timestamptz not null default now()
);

create index if not exists usage_logs_user_created_idx
  on usage_logs (user_id, created_at desc);

-- ── Seed the provider ──────────────────────────────────────────────────────
insert into providers (id, label) values ('higgsfield', 'Higgsfield')
on conflict (id) do nothing;

-- ── Row Level Security ─────────────────────────────────────────────────────
alter table projects enable row level security;
alter table generations enable row level security;
alter table generation_assets enable row level security;
alter table favorites enable row level security;
alter table brand_profiles enable row level security;
alter table prompt_templates enable row level security;
alter table usage_logs enable row level security;
alter table providers enable row level security;
alter table models enable row level security;

create policy "own_projects" on projects
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_generations" on generations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_assets" on generation_assets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_favorites" on favorites
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_brands" on brand_profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "visible_templates" on prompt_templates
  for all using (is_public = true or auth.uid() = user_id)
  with check (auth.uid() = user_id);
create policy "own_usage" on usage_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "public_catalog" on providers for select using (true);
create policy "public_models" on models for select using (true);

-- ── Storage buckets (create in Dashboard > Storage if not via API) ─────────
-- kibo-inputs   PUBLIC  — reference uploads (unguessable UUID paths) so the
--                        provider can fetch them. Anyone with the URL can read.
-- kibo-outputs  PRIVATE — finished generations copied from provider CDN.
--                        Access via signed URLs only.
