create table if not exists public.sounds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 80),
  description text not null default '' check (char_length(description) <= 240),
  file_path text not null unique,
  mime_type text not null,
  created_at timestamptz not null default now(),
  is_published boolean not null default true
);

alter table public.sounds
  add column if not exists is_published boolean not null default true;

create table if not exists public.favorites (
  user_id uuid not null references auth.users (id) on delete cascade,
  sound_id uuid not null references public.sounds (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, sound_id)
);

create index if not exists sounds_created_at_idx on public.sounds (created_at desc);
create index if not exists favorites_sound_id_idx on public.favorites (sound_id);

grant select on table public.sounds to anon, authenticated;
grant insert, update, delete on table public.sounds to authenticated;
grant select, insert, delete on table public.favorites to authenticated;

alter table public.sounds enable row level security;
alter table public.favorites enable row level security;

drop policy if exists "Anyone can view sounds" on public.sounds;
drop policy if exists "Anyone can view published sounds and owners can view their own" on public.sounds;
create policy "Anyone can view published sounds and owners can view their own"
  on public.sounds for select
  using (is_published or auth.uid() = user_id);

drop policy if exists "Authenticated users can upload sounds as themselves" on public.sounds;
create policy "Authenticated users can upload sounds as themselves"
  on public.sounds for insert to authenticated
  with check (
    auth.uid() = user_id
    and (storage.foldername(file_path))[1] = (select auth.uid()::text)
  );

drop policy if exists "Users can update their own sounds" on public.sounds;
create policy "Users can update their own sounds"
  on public.sounds for update to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (storage.foldername(file_path))[1] = (select auth.uid()::text)
  );

drop policy if exists "Users can delete their own sounds" on public.sounds;
create policy "Users can delete their own sounds"
  on public.sounds for delete to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can view their own favorites" on public.favorites;
create policy "Users can view their own favorites"
  on public.favorites for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can add their own favorites" on public.favorites;
create policy "Users can add their own favorites"
  on public.favorites for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can remove their own favorites" on public.favorites;
create policy "Users can remove their own favorites"
  on public.favorites for delete to authenticated
  using (auth.uid() = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'sounds',
  'sounds',
  false,
  20971520,
  array['audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/ogg']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Anyone can listen to community sounds" on storage.objects;
drop policy if exists "Community sounds and their owners can access audio files" on storage.objects;
create policy "Community sounds and their owners can access audio files"
  on storage.objects for select
  using (
    bucket_id = 'sounds'
    and exists (
      select 1
      from public.sounds
      where sounds.file_path = storage.objects.name
        and (sounds.is_published or sounds.user_id = auth.uid())
    )
  );

drop policy if exists "Users can upload sounds to their own folder" on storage.objects;
create policy "Users can upload sounds to their own folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'sounds'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

drop policy if exists "Users can update sounds in their own folder" on storage.objects;
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

drop policy if exists "Users can delete sounds in their own folder" on storage.objects;
create policy "Users can delete sounds in their own folder"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'sounds'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );
