create table if not exists public.sounds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 80),
  description text not null default '' check (char_length(description) <= 240),
  file_path text not null unique,
  mime_type text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.favorites (
  user_id uuid not null references auth.users (id) on delete cascade,
  sound_id uuid not null references public.sounds (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, sound_id)
);

create index if not exists sounds_created_at_idx on public.sounds (created_at desc);
create index if not exists favorites_sound_id_idx on public.favorites (sound_id);

alter table public.sounds enable row level security;
alter table public.favorites enable row level security;

create policy "Anyone can view sounds"
  on public.sounds for select
  using (true);

create policy "Authenticated users can upload sounds as themselves"
  on public.sounds for insert to authenticated
  with check (
    auth.uid() = user_id
    and (storage.foldername(file_path))[1] = (select auth.uid()::text)
  );

create policy "Users can update their own sounds"
  on public.sounds for update to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (storage.foldername(file_path))[1] = (select auth.uid()::text)
  );

create policy "Users can delete their own sounds"
  on public.sounds for delete to authenticated
  using (auth.uid() = user_id);

create policy "Users can view their own favorites"
  on public.favorites for select to authenticated
  using (auth.uid() = user_id);

create policy "Users can add their own favorites"
  on public.favorites for insert to authenticated
  with check (auth.uid() = user_id);

create policy "Users can remove their own favorites"
  on public.favorites for delete to authenticated
  using (auth.uid() = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'sounds',
  'sounds',
  true,
  20971520,
  array['audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/ogg']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "Anyone can listen to community sounds"
  on storage.objects for select
  using (bucket_id = 'sounds');

create policy "Users can upload sounds to their own folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'sounds'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "Users can update sounds in their own folder"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'sounds'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  )
  with check (
    bucket_id = 'sounds'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "Users can delete sounds in their own folder"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'sounds'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );
