-- Linked-device worker for LexisPredict; no external WA.Auto/Evolution service.
-- Machine-only tables, scoped by company and guarded by the server.
create table if not exists public.wa_local_bridges (
 empresa_id uuid primary key references public.empresas(id) on delete cascade,
 owner_auth_id uuid not null,
 token_sha256 text not null unique,
 state text not null default 'offline' check (state in ('offline','connecting','qr','ready','error')),
 qr_data_url text, phone text, last_error text, last_seen timestamptz,
 updated_at timestamptz not null default now(), created_at timestamptz not null default now()
);
create table if not exists public.wa_local_jobs (
 id uuid primary key default gen_random_uuid(),
 empresa_id uuid not null references public.empresas(id) on delete cascade,
 created_by uuid not null,
 to_phone text not null check (to_phone ~ '^55[0-9]{10,11}$'),
 body text not null check (length(body) between 1 and 4000),
 status text not null default 'pending' check (status in ('pending','claimed','accepted','delivered','read','failed','uncertain')),
 provider_message_id text, last_error text, created_at timestamptz not null default now(),
 claimed_at timestamptz, resolved_at timestamptz
);
create index if not exists wa_local_jobs_pending_idx on public.wa_local_jobs(empresa_id,created_at) where status='pending';
create index if not exists wa_local_jobs_provider_idx on public.wa_local_jobs(empresa_id,provider_message_id) where provider_message_id is not null;
create index if not exists wa_local_jobs_phone_idx on public.wa_local_jobs(empresa_id,to_phone,created_at desc);
alter table public.wa_local_bridges enable row level security;
alter table public.wa_local_jobs enable row level security;
revoke all on public.wa_local_bridges,public.wa_local_jobs from public,anon,authenticated;
grant select,insert,update,delete on public.wa_local_bridges,public.wa_local_jobs to service_role;
create or replace function public.wa_local_claim(p_empresa uuid)
returns setof public.wa_local_jobs language plpgsql security invoker set search_path=public as $$
begin
 return query with next_job as (
   select j.id from public.wa_local_jobs j where j.empresa_id=p_empresa and j.status='pending'
   order by j.created_at asc for update skip locked limit 1
 ) update public.wa_local_jobs j set status='claimed',claimed_at=now()
   from next_job where j.id=next_job.id returning j.*;
end $$;
revoke all on function public.wa_local_claim(uuid) from public,anon,authenticated;
grant execute on function public.wa_local_claim(uuid) to service_role;
