-- Isolated daily WhatsApp returns, no campaigns enabled or messages dispatched by this migration.
create table if not exists public.wa_daily_return_settings(
  empresa_id uuid primary key,
  enabled boolean not null default false,
  interval_days integer not null default 1 check(interval_days between 1 and 30),
  owner_auth_id uuid,
  updated_at timestamptz not null default now()
);
create table if not exists public.wa_daily_return_checks(
  empresa_id uuid not null,
  processo_id bigint not null,
  local_day date not null,
  mode text not null default 'due',
  result text not null,
  checked_at timestamptz not null default now(),
  primary key(empresa_id,processo_id,local_day,mode)
);
create table if not exists public.wa_daily_return_sends(
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  processo_id bigint not null,
  phone text not null,
  local_day date not null,
  event_hash text not null,
  source text not null,
  event_at timestamptz not null,
  mode text not null check(mode in ('due','requested','single')),
  status text not null default 'reserved' check(status in ('reserved','sent','uncertain','rejected')),
  message text not null,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  last_error text,
  unique(empresa_id,phone,local_day)
);
create index if not exists wa_daily_due_idx on public.processos(empresa_id,proximo_retorno,id);
create index if not exists wa_daily_sends_case_idx on public.wa_daily_return_sends(empresa_id,processo_id,sent_at desc);
alter table public.wa_daily_return_settings enable row level security;
alter table public.wa_daily_return_checks enable row level security;
alter table public.wa_daily_return_sends enable row level security;
revoke all on public.wa_daily_return_settings from anon,authenticated;
revoke all on public.wa_daily_return_checks from anon,authenticated;
revoke all on public.wa_daily_return_sends from anon,authenticated;
grant all on public.wa_daily_return_settings to service_role;
grant all on public.wa_daily_return_checks to service_role;
grant all on public.wa_daily_return_sends to service_role;

-- One case at a time, due today or overdue; no infinite loop over a process
-- with no new movement. The daily ledger is written after checking each case.
create or replace function public.wa_next_due_return(p_empresa uuid, p_day date)
returns bigint language sql stable security definer set search_path=public as $$
  select p.id from public.processos p
  where p.empresa_id=p_empresa
    and p.proximo_retorno is not null and p.proximo_retorno<=p_day
    and not exists(select 1 from public.wa_daily_return_checks k
      where k.empresa_id=p_empresa and k.processo_id=p.id
        and k.local_day=p_day and k.mode='due')
  order by p.proximo_retorno,p.id
  limit 1
$$;
revoke all on function public.wa_next_due_return(uuid,date) from public,anon,authenticated;
grant execute on function public.wa_next_due_return(uuid,date) to service_role;
