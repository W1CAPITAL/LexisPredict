-- Collaborative, tenant-scoped legal checklist (does not replace case records).
create table if not exists public.lexis_case_workflow_steps (
 id uuid primary key default gen_random_uuid(),
 empresa_id uuid not null,
 protocolo text not null,
 step_key text not null,
 title text not null,
 status text not null default 'pending' check (status in ('pending','done')),
 responsible_id uuid null,
 evidence_url text null,
 note text null,
 completed_by uuid null,
 completed_at timestamptz null,
 updated_by uuid not null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(empresa_id, protocolo, step_key),
 constraint workflow_protocol_length check (char_length(protocolo) between 1 and 80),
 constraint workflow_title_length check (char_length(title) between 1 and 240),
 constraint workflow_step_key_length check (char_length(step_key) between 1 and 120)
);
create index if not exists lexis_case_workflow_steps_tenant_case
 on public.lexis_case_workflow_steps (empresa_id, protocolo);
alter table public.lexis_case_workflow_steps enable row level security;
revoke all on public.lexis_case_workflow_steps from anon;
grant select, insert, update on public.lexis_case_workflow_steps to authenticated;
drop policy if exists lexis_workflow_read on public.lexis_case_workflow_steps;
create policy lexis_workflow_read on public.lexis_case_workflow_steps
 for select to authenticated using (
  exists(select 1 from public.usuarios u where u.auth_user_id = auth.uid()
  and u.empresa_id = lexis_case_workflow_steps.empresa_id)
 );
drop policy if exists lexis_workflow_insert on public.lexis_case_workflow_steps;
create policy lexis_workflow_insert on public.lexis_case_workflow_steps
 for insert to authenticated with check (
  updated_by = auth.uid() and
  exists(select 1 from public.usuarios u where u.auth_user_id = auth.uid()
  and u.empresa_id = lexis_case_workflow_steps.empresa_id
  and coalesce(u.cargo,'') not ilike '%visualiz%')
 );
drop policy if exists lexis_workflow_update on public.lexis_case_workflow_steps;
create policy lexis_workflow_update on public.lexis_case_workflow_steps
 for update to authenticated using (
  exists(select 1 from public.usuarios u where u.auth_user_id = auth.uid()
  and u.empresa_id = lexis_case_workflow_steps.empresa_id
  and coalesce(u.cargo,'') not ilike '%visualiz%')
 ) with check (
  updated_by = auth.uid() and
  exists(select 1 from public.usuarios u where u.auth_user_id = auth.uid()
  and u.empresa_id = lexis_case_workflow_steps.empresa_id
  and coalesce(u.cargo,'') not ilike '%visualiz%')
 );
-- Immutable history of each state transition, written only by trigger.
create table if not exists public.lexis_case_workflow_audit (
 id bigint generated always as identity primary key,
 empresa_id uuid not null,
 protocolo text not null,
 step_key text not null,
 old_status text null,
 new_status text not null,
 actor_id uuid not null,
 changed_at timestamptz not null default now()
);
create index if not exists lexis_case_workflow_audit_lookup
 on public.lexis_case_workflow_audit (empresa_id, protocolo, changed_at desc);
alter table public.lexis_case_workflow_audit enable row level security;
revoke all on public.lexis_case_workflow_audit from anon, authenticated;
grant select on public.lexis_case_workflow_audit to authenticated;
drop policy if exists lexis_workflow_audit_read on public.lexis_case_workflow_audit;
create policy lexis_workflow_audit_read on public.lexis_case_workflow_audit
 for select to authenticated using (
  exists(select 1 from public.usuarios u where u.auth_user_id = auth.uid()
  and u.empresa_id = lexis_case_workflow_audit.empresa_id)
 );
create or replace function public.lexis_log_workflow_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
 if tg_op = 'INSERT' or old.status is distinct from new.status then
  insert into public.lexis_case_workflow_audit
   (empresa_id, protocolo, step_key, old_status, new_status, actor_id)
  values(new.empresa_id,new.protocolo,new.step_key,
   case when tg_op = 'INSERT' then null else old.status end,
   new.status,new.updated_by);
 end if;
 return new;
end;
$$;
drop trigger if exists lexis_workflow_audit_trigger on public.lexis_case_workflow_steps;
create trigger lexis_workflow_audit_trigger after insert or update
 on public.lexis_case_workflow_steps for each row execute function public.lexis_log_workflow_change();
