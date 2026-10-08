-- Run manually ONLY on the secondary Supabase project after verifying its project ID.
-- Do not run on the current production database as a migration of existing data.
create table if not exists public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid null,
  instance_name text null,
  contact_number text not null,
  contact_name text null,
  phone text null,
  remote_jid text null,
  message_id text null,
  message_text text null,
  body text null,
  from_me boolean default false,
  direction text null,
  source text null,
  timestamp timestamptz default now(),
  created_at timestamptz default now(),
  raw_payload jsonb null
);

-- Most reads specify contact_number/phone and order by time.
create index if not exists wa_shard_contact_time on public.whatsapp_messages (contact_number, timestamp desc);
create index if not exists wa_shard_phone_time on public.whatsapp_messages (phone, timestamp desc);
create index if not exists wa_shard_tenant_contact on public.whatsapp_messages (empresa_id, contact_number);
-- Used by trusted server-side service_role only; never expose secondary DB to browser.
alter table public.whatsapp_messages enable row level security;
revoke all on public.whatsapp_messages from anon, authenticated;
grant all on public.whatsapp_messages to service_role;
