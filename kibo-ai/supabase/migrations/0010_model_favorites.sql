-- Per-user model favorites for the Models catalog.
create table if not exists model_favorites (
  user_id uuid not null references auth.users (id) on delete cascade,
  model_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, model_id)
);

create index if not exists model_favorites_user_created_idx
  on model_favorites (user_id, created_at desc);

alter table model_favorites enable row level security;

create policy "own_model_favorites" on model_favorites
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, insert, delete on table model_favorites to authenticated;
