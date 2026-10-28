-- Complementos próprios do LexisPredict: timesheet e modelos jurídicos compartilhados.
-- Não importa dados fictícios nem reproduz dados privados de outro produto.
create table if not exists public.juris_timesheet (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  autor_auth_user_id uuid not null,
  processo_id bigint references public.processos(id) on delete set null,
  protocolo_ref text,
  titulo text not null check (char_length(titulo) between 3 and 180),
  descricao text not null default '' check (char_length(descricao) <= 4000),
  inicio_em timestamptz not null,
  fim_em timestamptz not null,
  duracao_segundos integer not null check (duracao_segundos between 1 and 86400),
  faturavel boolean not null default false,
  criado_em timestamptz not null default now(),
  constraint juris_timesheet_periodo_check check (
    fim_em > inicio_em and fim_em <= inicio_em + interval '24 hours'
  )
);
create index if not exists juris_timesheet_owner_idx
on public.juris_timesheet (empresa_id, autor_auth_user_id, inicio_em desc);
alter table public.juris_timesheet enable row level security;
drop policy if exists juris_timesheet_select on public.juris_timesheet;
drop policy if exists juris_timesheet_insert on public.juris_timesheet;
drop policy if exists juris_timesheet_update on public.juris_timesheet;
drop policy if exists juris_timesheet_delete on public.juris_timesheet;
create policy juris_timesheet_select on public.juris_timesheet for select to authenticated
using (autor_auth_user_id = (select auth.uid()) and exists(
  select 1 from public.usuarios u where u.auth_user_id=(select auth.uid()) and u.empresa_id=juris_timesheet.empresa_id));
create policy juris_timesheet_insert on public.juris_timesheet for insert to authenticated
with check (autor_auth_user_id=(select auth.uid()) and exists(
  select 1 from public.usuarios u where u.auth_user_id=(select auth.uid()) and u.empresa_id=juris_timesheet.empresa_id));
create policy juris_timesheet_update on public.juris_timesheet for update to authenticated
using (autor_auth_user_id=(select auth.uid()) and exists(
  select 1 from public.usuarios u where u.auth_user_id=(select auth.uid()) and u.empresa_id=juris_timesheet.empresa_id))
with check (autor_auth_user_id=(select auth.uid()) and exists(
  select 1 from public.usuarios u where u.auth_user_id=(select auth.uid()) and u.empresa_id=juris_timesheet.empresa_id));
create policy juris_timesheet_delete on public.juris_timesheet for delete to authenticated
using (autor_auth_user_id=(select auth.uid()) and exists(
  select 1 from public.usuarios u where u.auth_user_id=(select auth.uid()) and u.empresa_id=juris_timesheet.empresa_id));
revoke all on public.juris_timesheet from anon;
grant select,insert,update,delete on public.juris_timesheet to authenticated;

create table if not exists public.juris_modelos_autorais (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  autor_auth_user_id uuid not null,
  titulo text not null check (char_length(titulo) between 3 and 160),
  categoria text not null default 'Petição' check (char_length(categoria) between 2 and 80),
  corpo text not null check (char_length(corpo) between 20 and 30000),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists juris_modelos_tenant_idx
on public.juris_modelos_autorais (empresa_id, atualizado_em desc);
alter table public.juris_modelos_autorais enable row level security;
drop policy if exists juris_modelos_select on public.juris_modelos_autorais;
drop policy if exists juris_modelos_insert on public.juris_modelos_autorais;
drop policy if exists juris_modelos_update on public.juris_modelos_autorais;
drop policy if exists juris_modelos_delete on public.juris_modelos_autorais;
-- Modelos podem ser utilizados pela empresa, mas editados somente pelo autor.
create policy juris_modelos_select on public.juris_modelos_autorais for select to authenticated
using (exists(select 1 from public.usuarios u where u.auth_user_id=(select auth.uid()) and u.empresa_id=juris_modelos_autorais.empresa_id));
create policy juris_modelos_insert on public.juris_modelos_autorais for insert to authenticated
with check (autor_auth_user_id=(select auth.uid()) and exists(select 1 from public.usuarios u where u.auth_user_id=(select auth.uid()) and u.empresa_id=juris_modelos_autorais.empresa_id));
create policy juris_modelos_update on public.juris_modelos_autorais for update to authenticated
using (autor_auth_user_id=(select auth.uid()) and exists(select 1 from public.usuarios u where u.auth_user_id=(select auth.uid()) and u.empresa_id=juris_modelos_autorais.empresa_id))
with check (autor_auth_user_id=(select auth.uid()) and exists(select 1 from public.usuarios u where u.auth_user_id=(select auth.uid()) and u.empresa_id=juris_modelos_autorais.empresa_id));
create policy juris_modelos_delete on public.juris_modelos_autorais for delete to authenticated
using (autor_auth_user_id=(select auth.uid()) and exists(select 1 from public.usuarios u where u.auth_user_id=(select auth.uid()) and u.empresa_id=juris_modelos_autorais.empresa_id));
revoke all on public.juris_modelos_autorais from anon;
grant select,insert,update,delete on public.juris_modelos_autorais to authenticated;
