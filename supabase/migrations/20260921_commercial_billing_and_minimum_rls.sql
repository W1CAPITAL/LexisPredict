-- LexisPredict Commercial incremental patch
-- Adds only commercial billing fields/tables and the minimum RLS policies
-- required by the current authenticated app. No existing business data is deleted.

alter table public.empresas
  alter column plano set default 'essencial';

update public.empresas
set plano = 'essencial'
where plano is null or btrim(plano) = '';

alter table public.empresas
  add column if not exists plano_expira_em timestamptz,
  add column if not exists plano_bloqueado boolean not null default false,
  add column if not exists plano_bloqueio_motivo text,
  add column if not exists billing_status text not null default 'pending';

update public.empresas
set plano_bloqueado = false
where plano_bloqueado is null;

update public.empresas
set billing_status = 'pending'
where billing_status is null or btrim(billing_status) = '';

create table if not exists public.assinaturas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null unique references public.empresas(id) on delete cascade,
  plano text not null default 'essencial',
  status text not null default 'pending',
  ciclo text,
  provider text not null default 'manual',
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.solicitacoes_assinatura (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  solicitado_por uuid,
  plano text not null,
  ciclo text not null default 'mensal',
  status text not null default 'pending',
  observacao text,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid
);

create table if not exists public.commercial_audit_log (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references public.empresas(id) on delete set null,
  actor_user_id uuid,
  event text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_assinaturas_empresa
  on public.assinaturas(empresa_id);

create index if not exists idx_solicitacoes_assinatura_empresa_status
  on public.solicitacoes_assinatura(empresa_id, status, created_at desc);

create index if not exists idx_commercial_audit_empresa_created
  on public.commercial_audit_log(empresa_id, created_at desc);

alter table public.assinaturas enable row level security;
alter table public.solicitacoes_assinatura enable row level security;
alter table public.commercial_audit_log enable row level security;

drop policy if exists usuarios_select_own_profile on public.usuarios;
create policy usuarios_select_own_profile
on public.usuarios
for select
to authenticated
using (auth.uid() = auth_user_id);

drop policy if exists empresas_select_own_tenant on public.empresas;
create policy empresas_select_own_tenant
on public.empresas
for select
to authenticated
using (
  exists (
    select 1
    from public.usuarios u
    where u.auth_user_id = auth.uid()
      and u.empresa_id = empresas.id
  )
);

-- Commercial billing tables are server-only.
-- Service-role requests bypass RLS; browser clients receive no direct billing policies.
