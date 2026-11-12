-- Foundations for batches 3-8: tenant isolated operational metadata only.
-- Do not store WhatsApp message bodies, call recordings or raw credentials.
create table if not exists public.lexis_team_inbox (
 id uuid primary key default gen_random_uuid(),
 empresa_id uuid not null,
 phone_hash text not null,
 case_protocolo text null,
 assigned_to uuid null,
 status text not null default 'unassigned'
  check (status in ('unassigned','assigned','waiting','closed')),
 internal_note text null,
 updated_by uuid not null,
 updated_at timestamptz not null default now(),
 unique(empresa_id,phone_hash),
 check (length(phone_hash)=64),
 check (internal_note is null or length(internal_note)<=2000)
);
create table if not exists public.lexis_agent_versions (
 id uuid primary key default gen_random_uuid(),
 empresa_id uuid not null,
 agent_key text not null,
 version integer not null check (version>0),
 instructions text not null,
 allowed_tools text[] not null default '{}',
 status text not null default 'draft' check(status in ('draft','published','disabled')),
 created_by uuid not null,
 created_at timestamptz not null default now(),
 unique(empresa_id,agent_key,version)
);
create table if not exists public.lexis_intake_forms (
 id uuid primary key default gen_random_uuid(),
 empresa_id uuid not null,
 title text not null,
 schema_json jsonb not null default '{}'::jsonb,
 token_hash text not null unique,
 expires_at timestamptz not null,
 revoked_at timestamptz null,
 created_by uuid not null,
 created_at timestamptz not null default now(),
 check (length(token_hash)=64)
);
create table if not exists public.lexis_integration_health (
 empresa_id uuid not null,
 provider text not null,
 state text not null default 'unknown' check(state in ('unknown','ok','degraded','offline')),
 last_success_at timestamptz null,
 last_failure_at timestamptz null,
 error_code text null,
 updated_at timestamptz not null default now(),
 primary key (empresa_id,provider)
);
create table if not exists public.lexis_call_metadata (
 id uuid primary key default gen_random_uuid(),
 empresa_id uuid not null,
 case_protocolo text null,
 provider text not null,
 provider_call_id text not null,
 status text not null default 'pending'
  check(status in ('pending','ringing','connected','completed','failed')),
 consent_recorded boolean not null default false,
 transcript_status text not null default 'not_requested'
  check(transcript_status in ('not_requested','pending','processing','ready','failed')),
 created_at timestamptz not null default now(),
 unique(empresa_id,provider,provider_call_id)
);
-- Every new table requires explicit tenant RLS; service role is reserved for server actions.
do $$
declare t text;
begin
 foreach t in array array[
  'lexis_team_inbox','lexis_agent_versions','lexis_intake_forms',
  'lexis_integration_health','lexis_call_metadata'
 ] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon',t);
  execute format('grant select on public.%I to authenticated',t);
  execute format('drop policy if exists tenant_read on public.%I',t);
  execute format(
   'create policy tenant_read on public.%I for select to authenticated using (exists (select 1 from public.usuarios u where u.auth_user_id = auth.uid() and u.empresa_id = %I.empresa_id))',t,t);
 end loop;
end $$;
-- No client writes or public intake submissions are enabled by this migration.
-- Future write actions must check tenant, role, object ownership, opt-out and audit.
