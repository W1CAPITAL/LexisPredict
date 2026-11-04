-- Google Agenda OAuth: somente o backend com service_role pode ler refresh tokens.
-- Tokens AES-256-GCM são criptografados na aplicação; nenhuma chave fica na tabela.
create table if not exists public.google_calendar_connections (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  auth_user_id uuid not null,
  refresh_token_ciphertext text not null,
  email text,
  scope text not null default 'https://www.googleapis.com/auth/calendar.events',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, auth_user_id)
);
alter table public.google_calendar_connections enable row level security;
revoke all on public.google_calendar_connections from public, anon, authenticated;
grant select, insert, update, delete on public.google_calendar_connections to service_role;
create index if not exists google_calendar_connections_empresa_idx on public.google_calendar_connections(empresa_id);
comment on table public.google_calendar_connections is 'Encrypted, operator-authorized Google Calendar refresh tokens; service role only. Never exposed to browser.';
