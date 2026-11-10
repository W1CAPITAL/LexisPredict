-- Cada consulta pública DataJud é espaçada por tribunal em todas as instâncias Hermes.
-- HTTP 429/timeout implica recuo, não falha do processo nem novo contato.
-- Esta fila não altera processos ou retornos, somente controle de chamadas da fonte.
create table if not exists public.hermes_datajud_capacity (
 alias text primary key,
 next_allowed_at timestamptz not null default now(),
 failure_streak integer not null default 0,
 last_outcome text,
 last_attempt_at timestamptz,
 last_success_at timestamptz,
 updated_at timestamptz not null default now()
);
alter table public.hermes_datajud_capacity enable row level security;
revoke all on public.hermes_datajud_capacity from public,anon,authenticated;
grant select,insert,update on public.hermes_datajud_capacity to service_role;

create or replace function public.hermes_reserve_datajud_slot(p_alias text)
returns table(allowed boolean,retry_at timestamptz)
language plpgsql set search_path = public as $body$
declare
 v_retry timestamptz;
begin
 if p_alias is null or p_alias !~ '^(tj[a-z]{2,4}|trf[1-9]|trt([1-9]|1[0-9]|2[0-4])|stj|tst|tse|stm)$'
 then
  return query select false,now()+interval '30 minutes'; return;
 end if;
 insert into public.hermes_datajud_capacity(alias,next_allowed_at,last_attempt_at,updated_at)
 values(p_alias,now()+interval '12 minutes',now(),now())
 on conflict(alias)
 do update set
  next_allowed_at=now()+interval '12 minutes',
  last_attempt_at=now(),updated_at=now()
 where hermes_datajud_capacity.next_allowed_at<=now()
 returning hermes_datajud_capacity.next_allowed_at into v_retry;
 if found then
  return query select true,v_retry;return;
 end if;
 select c.next_allowed_at into v_retry from public.hermes_datajud_capacity c where c.alias=p_alias;
 return query select false,coalesce(v_retry,now()+interval '12 minutes');
end;
$body$;
revoke all on function public.hermes_reserve_datajud_slot(text) from public, anon, authenticated;
grant execute on function public.hermes_reserve_datajud_slot(text) to service_role;

create or replace function public.hermes_finish_datajud_slot(
 p_alias text,p_outcome text,p_retry_after_seconds integer default null
)
returns void
language plpgsql set search_path = public as $body$
begin
 update public.hermes_datajud_capacity c
 set
 failure_streak=case
  when p_outcome in ('rate_limited','timeout','index_timeout','server_error')
    then least(5,c.failure_streak+1)
  else 0 end,
 last_outcome=case when p_outcome in ('ok','not_found','rate_limited','timeout','index_timeout','server_error','auth_error','other_error')
   then p_outcome else 'other_error' end,
 last_success_at=case when p_outcome in ('ok','not_found') then now() else c.last_success_at end,
 next_allowed_at=case
  when p_outcome='rate_limited' then greatest(
    c.next_allowed_at,
    now()+make_interval(mins=>least(180,30*(1+c.failure_streak))),
    now()+make_interval(secs=>least(14400,greatest(0,coalesce(p_retry_after_seconds,0))))
  )
  when p_outcome in ('timeout','index_timeout','server_error') then
     greatest(c.next_allowed_at,now()+make_interval(mins=>least(60,12*(1+c.failure_streak))))
  when p_outcome='auth_error' then greatest(c.next_allowed_at,now()+interval '2 hours')
  else greatest(c.next_allowed_at,now()+interval '12 minutes')
 end,
 updated_at=now()
 where c.alias=p_alias;
end;
$body$;
revoke all on function public.hermes_finish_datajud_slot(text,text,integer) from public,anon,authenticated;
grant execute on function public.hermes_finish_datajud_slot(text,text,integer) to service_role;
