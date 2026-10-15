-- 2026-10-15 WhatsApp outbound circuit breaker: all linked-device sending
-- passes through a DB transaction with tenant lock. Tenant-specific PAUSE
-- and cooldown values are created by operational incident handling, not seed.
create table if not exists public.wa_outbound_safety_limits(
 empresa_id uuid primary key references public.empresas(id) on delete cascade,
 paused boolean not null default true,
 min_gap_minutes integer not null default 15 check(min_gap_minutes between 5 and 120),
 daily_limit integer not null default 12 check(daily_limit between 1 and 40),
 business_start_hour integer not null default 9 check(business_start_hour between 0 and 23),
 business_end_hour integer not null default 17 check(business_end_hour between 1 and 24),
 weekdays_only boolean not null default true,
 cooldown_until timestamptz,
 pause_reason text,
 updated_at timestamptz not null default now()
);
alter table public.wa_outbound_safety_limits enable row level security;
revoke all on public.wa_outbound_safety_limits from anon,authenticated,public;
grant all on public.wa_outbound_safety_limits to service_role;
CREATE OR REPLACE FUNCTION public.wa_local_claim(p_empresa uuid)
 RETURNS SETOF wa_local_jobs
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v public.wa_outbound_safety_limits%rowtype;
        v_local timestamp:=now() at time zone 'America/Sao_Paulo';
begin
 -- Serialize worker polling, even across several Render and Vercel instances.
 perform pg_advisory_xact_lock(hashtextextended('wa-local-safety:'||p_empresa::text,0));
 select * into v from public.wa_outbound_safety_limits where empresa_id=p_empresa for update;
 if found then
  if v.paused or (v.cooldown_until is not null and now()<v.cooldown_until) then return; end if;
  if (v.weekdays_only and extract(isodow from v_local)>5) or
     extract(hour from v_local)<v.business_start_hour or extract(hour from v_local)>=v.business_end_hour
  then return; end if;
  if (select count(*) from public.wa_local_jobs j
       where j.empresa_id=p_empresa and j.claimed_at is not null
       and (j.claimed_at at time zone 'America/Sao_Paulo')::date=v_local::date
      )>=v.daily_limit then return; end if;
  if exists(select 1 from public.wa_local_jobs j
       where j.empresa_id=p_empresa and j.claimed_at>now()-make_interval(mins=>v.min_gap_minutes))
  then return; end if;
 end if;
 return query
 with next_job as (
  select j.id from public.wa_local_jobs j
  where j.empresa_id=p_empresa and j.status='pending'
   and not exists (select 1 from public.wa_contact_optouts o
                   where o.empresa_id=p_empresa and o.phone=j.to_phone)
  order by j.created_at,j.id for update skip locked limit 1
 )
 update public.wa_local_jobs j set status='claimed',claimed_at=now()
 from next_job where j.id=next_job.id returning j.*;
end $function$;
revoke all on function public.wa_local_claim(uuid) from public,anon,authenticated;
grant execute on function public.wa_local_claim(uuid) to service_role;
