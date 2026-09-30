-- Token entitlement + first-run personalization.
alter table public.empresas
  add column if not exists plan_self_service_unlocked boolean not null default false,
  add column if not exists onboarding_completed boolean not null default false,
  add column if not exists nav_layout text not null default 'dock',
  add column if not exists sidebar_compact boolean not null default false;

update public.empresas e
set plan_self_service_unlocked = true
where exists (
  select 1
  from public.assinaturas a
  where a.empresa_id = e.id
    and a.provider = 'courtesy_token'
);

update public.empresas
set nav_layout = 'dock'
where nav_layout is null or nav_layout not in ('dock','vertical');

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'empresas_nav_layout_check'
      and conrelid = 'public.empresas'::regclass
  ) then
    alter table public.empresas
      add constraint empresas_nav_layout_check
      check (nav_layout in ('dock','vertical'));
  end if;
end $$;
