create table if not exists public.chat_threads (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  tipo text not null default 'geral',
  titulo text,
  dm_key text,
  created_by text,
  created_at timestamptz not null default now()
);
create unique index if not exists chat_threads_empresa_geral
  on public.chat_threads (empresa_id) where tipo = 'geral';
create unique index if not exists chat_threads_dm_key
  on public.chat_threads (empresa_id, dm_key) where dm_key is not null;
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  thread_id uuid not null references public.chat_threads(id) on delete cascade,
  auth_user_id text,
  autor_nome text,
  body text,
  tipo text not null default 'text',
  file_path text,
  file_name text,
  file_mime text,
  file_size int,
  created_at timestamptz not null default now()
);
create index if not exists chat_messages_thread_created on public.chat_messages (thread_id, created_at);
insert into storage.buckets (id, name, public) values ('chat-empresa', 'chat-empresa', false) on conflict (id) do nothing;
