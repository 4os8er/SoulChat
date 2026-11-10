-- SoulChat initial schema (review and apply in a Supabase SQL editor)
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Our little world',
  created_at timestamptz not null default now()
);

create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (conversation_id,user_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  message_type text not null default 'text' check (message_type in ('text','image')),
  content text,
  media_url text,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz,
  constraint message_content_or_media check (
    (message_type='text' and content is not null and length(content) between 1 and 4000)
    or (message_type='image' and media_url is not null)
  )
);
create index if not exists messages_conversation_created_idx on public.messages(conversation_id,created_at desc);

create or replace function public.is_conversation_member(target_conversation uuid)
returns boolean language sql stable security definer set search_path=public
as $$
  select exists (
    select 1 from public.conversation_members
    where conversation_id=target_conversation and user_id=auth.uid()
  );
$$;

alter table public.profiles enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;

create policy "Members can read own profile" on public.profiles for select
using (id=auth.uid() or exists (
  select 1 from public.conversation_members cm
  where cm.user_id=auth.uid() and cm.conversation_id in (
    select conversation_id from public.conversation_members where user_id=profiles.id
  )
));
create policy "Users can update own profile" on public.profiles for update using (id=auth.uid()) with check (id=auth.uid());

create policy "Members can read their conversations" on public.conversations for select
using (public.is_conversation_member(id));
create policy "Members can read membership" on public.conversation_members for select
using (user_id=auth.uid() or public.is_conversation_member(conversation_id));

create policy "Members can read messages" on public.messages for select
using (public.is_conversation_member(conversation_id));
create policy "Members can send as themselves" on public.messages for insert
with check (sender_id=auth.uid() and public.is_conversation_member(conversation_id));
create policy "Authors can edit own messages" on public.messages for update
using (sender_id=auth.uid() and public.is_conversation_member(conversation_id))
with check (sender_id=auth.uid() and public.is_conversation_member(conversation_id));

-- Storage: create a PRIVATE bucket named chat-media in the dashboard.
-- Storage policies should be added after creating the bucket; use conversation membership metadata
-- or a server-side signed URL flow. Do not make private media publicly readable.
