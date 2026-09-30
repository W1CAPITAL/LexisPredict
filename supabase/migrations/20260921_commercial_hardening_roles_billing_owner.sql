-- LexisPredict Commercial hardening
-- Removes legacy plan self-service bypass, constrains commercial states,
-- enforces process ownership inside the tenant and adds hot-path indexes.

update public.empresas
set plan_self_service_unlocked = false
where plan_self_service_unlocked = true;

alter table public.empresas
  drop constraint if exists empresas_plano_commercial_check,
  add constraint empresas_plano_commercial_check
    check (plano is null or plano in ('essencial','operacional','financeiro','maximo'));

alter table public.empresas
  drop constraint if exists empresas_billing_status_commercial_check,
  add constraint empresas_billing_status_commercial_check
    check (billing_status in ('pending','trialing','active','past_due','suspended','canceled'));

alter table public.usuarios
  drop constraint if exists usuarios_cargo_commercial_check,
  add constraint usuarios_cargo_commercial_check
    check (cargo in ('Superadmin','Supervisor','Administrador','Operador','Visualizador'));

alter table public.assinaturas
  drop constraint if exists assinaturas_plano_commercial_check,
  add constraint assinaturas_plano_commercial_check
    check (plano in ('essencial','operacional','financeiro','maximo'));

alter table public.assinaturas
  drop constraint if exists assinaturas_status_commercial_check,
  add constraint assinaturas_status_commercial_check
    check (status in ('pending','trialing','active','past_due','suspended','canceled'));

alter table public.solicitacoes_assinatura
  drop constraint if exists solicitacoes_status_commercial_check,
  add constraint solicitacoes_status_commercial_check
    check (status in ('pending','approved','rejected','canceled'));

create or replace function public.current_company_has_user(owner_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.usuarios u
    where u.empresa_id = public.current_empresa_id()
      and u.auth_user_id = owner_id
  )
$$;

revoke all on function public.current_company_has_user(uuid) from public;
grant execute on function public.current_company_has_user(uuid) to authenticated;

drop policy if exists processos_tenant_insert on public.processos;
create policy processos_tenant_insert
on public.processos
for insert
to authenticated
with check (
  empresa_id = public.current_empresa_id()
  and created_by is not null
  and public.current_company_has_user(created_by)
  and (
    public.current_user_company_wide()
    or created_by = auth.uid()
  )
);

drop policy if exists processos_tenant_update on public.processos;
create policy processos_tenant_update
on public.processos
for update
to authenticated
using (
  empresa_id = public.current_empresa_id()
  and (
    public.current_user_company_wide()
    or created_by = auth.uid()
  )
)
with check (
  empresa_id = public.current_empresa_id()
  and created_by is not null
  and public.current_company_has_user(created_by)
  and (
    public.current_user_company_wide()
    or created_by = auth.uid()
  )
);

create index if not exists idx_processos_empresa_owner_created
  on public.processos (empresa_id, created_by, created_at desc);

create index if not exists idx_processos_empresa_protocolo
  on public.processos (empresa_id, protocolo_ref);

create index if not exists idx_auditoria_empresa_created
  on public.auditoria_logs_app (empresa_id, created_at desc);

create index if not exists idx_solicitacoes_empresa_status_created
  on public.solicitacoes_assinatura (empresa_id, status, created_at desc);
