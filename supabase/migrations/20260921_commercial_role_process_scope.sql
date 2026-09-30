-- Commercial role hierarchy: process ownership is enforced in RLS.
-- Supervisor/Superadmin see the company; Administrator/Operator only their own cases.

create or replace function public.current_user_cargo()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(u.cargo, 'Operador')
  from public.usuarios u
  where u.auth_user_id = auth.uid()
  limit 1
$$;

revoke all on function public.current_user_cargo() from public;
grant execute on function public.current_user_cargo() to authenticated;

create or replace function public.current_user_company_wide()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_user_cargo() in ('Supervisor','Superadmin'), false)
$$;

revoke all on function public.current_user_company_wide() from public;
grant execute on function public.current_user_company_wide() to authenticated;

alter table public.processos enable row level security;

drop policy if exists processos_tenant_select on public.processos;
drop policy if exists processos_tenant_insert on public.processos;
drop policy if exists processos_tenant_update on public.processos;
drop policy if exists processos_tenant_delete on public.processos;

create policy processos_tenant_select
on public.processos
for select
to authenticated
using (
  empresa_id = public.current_empresa_id()
  and (public.current_user_company_wide() or created_by = auth.uid())
);

create policy processos_tenant_insert
on public.processos
for insert
to authenticated
with check (
  empresa_id = public.current_empresa_id()
  and (public.current_user_company_wide() or created_by = auth.uid())
);

create policy processos_tenant_update
on public.processos
for update
to authenticated
using (
  empresa_id = public.current_empresa_id()
  and (public.current_user_company_wide() or created_by = auth.uid())
)
with check (
  empresa_id = public.current_empresa_id()
  and (public.current_user_company_wide() or created_by = auth.uid())
);

create policy processos_tenant_delete
on public.processos
for delete
to authenticated
using (
  empresa_id = public.current_empresa_id()
  and (public.current_user_company_wide() or created_by = auth.uid())
);
