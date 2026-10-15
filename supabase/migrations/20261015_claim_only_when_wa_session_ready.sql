CREATE OR REPLACE FUNCTION public.wa_local_claim(p_empresa uuid)
 RETURNS SETOF wa_local_jobs
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v public.wa_outbound_safety_limits%rowtype;
        v_local timestamp:=now() at time zone 'America/Sao_Paulo';
begin
 -- A worker token can be online while the WhatsApp account is not paired.
 -- Never claim a job for an offline, restricted, QR, or stale bridge.
 if not exists(
   select 1 from public.wa_local_bridges b
    where b.empresa_id=p_empresa and b.state='ready'
      and b.last_seen>now()-interval '45 seconds'
 ) then return; end if;
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
