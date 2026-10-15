
create table if not exists public.lexis_user_experience(
 auth_user_id uuid primary key references auth.users(id) on delete cascade,
 empresa_id uuid not null references public.empresas(id) on delete cascade,
 display_name text not null default '',
 display_role text not null default '',
 phone text,
 preferences jsonb not null default '{}'::jsonb,
 onboarding_version integer not null default 0,
 terms_version text,
 terms_accepted_at timestamptz,
 signature_name text,
 welcome_opt_in boolean not null default false,
 welcome_status text not null default 'not_requested'
  check(welcome_status in ('not_requested','waiting','queued','sent','not_sent','failed')),
 welcome_job_id uuid,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint lexis_phone_format check(phone is null or phone ~ '^55[1-9][0-9]{9,10}$'),
 constraint lexis_experience_profile_size check(octet_length(preferences::text)<16000)
);
create index if not exists lexis_experience_tenant_idx on public.lexis_user_experience(empresa_id);
create index if not exists lexis_experience_welcome_idx on public.lexis_user_experience(welcome_status) where welcome_status='waiting';
alter table public.lexis_user_experience enable row level security;
revoke all on public.lexis_user_experience from anon,public;
grant select,insert,update on public.lexis_user_experience to authenticated;
grant all on public.lexis_user_experience to service_role;
drop policy if exists lexis_experience_read_self on public.lexis_user_experience;
drop policy if exists lexis_experience_insert_self on public.lexis_user_experience;
drop policy if exists lexis_experience_update_self on public.lexis_user_experience;
create policy lexis_experience_read_self on public.lexis_user_experience for select to authenticated
 using(auth.uid()=auth_user_id);
-- App writes via validated server action; authenticated browsers cannot forge an acceptance.
create table if not exists public.lexis_user_legal_acceptances(
 id uuid primary key default gen_random_uuid(),
 auth_user_id uuid not null references auth.users(id) on delete cascade,
 empresa_id uuid not null references public.empresas(id) on delete cascade,
 contract_version text not null,
 contract_sha256 text not null,
 signed_name text not null,
 accepted_at timestamptz not null default now(),
 electronic_signature_method text not null default 'typed_name_plus_explicit_acceptance',
 acknowledged_legal_limits boolean not null default true,
 unique(auth_user_id,contract_version)
);
alter table public.lexis_user_legal_acceptances enable row level security;
revoke all on public.lexis_user_legal_acceptances from anon,public;
grant select on public.lexis_user_legal_acceptances to authenticated;
grant all on public.lexis_user_legal_acceptances to service_role;
drop policy if exists lexis_legal_read_self on public.lexis_user_legal_acceptances;
create policy lexis_legal_read_self on public.lexis_user_legal_acceptances for select to authenticated using(auth.uid()=auth_user_id);

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('lexis-experience','lexis-experience',true,3145728,array['image/png','image/jpeg','image/webp'])
on conflict(id) do nothing;
