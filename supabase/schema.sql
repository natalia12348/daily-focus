-- Run this once in the Supabase SQL editor.
-- Every table holds one user's rows, and row-level security makes sure nobody can read or change anyone else's.
do $$
declare t text;
begin
  foreach t in array array['tasks', 'goals', 'habits'] loop
    execute format('create table if not exists public.%I (
      user_id uuid not null default auth.uid() references auth.users on delete cascade,
      id text not null,
      data jsonb not null,
      updated_at timestamptz not null default now(),
      primary key (user_id, id)
    )', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format('create policy "own rows" on public.%I for all using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;
