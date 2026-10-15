ALTER TABLE public.wa_daily_return_settings ADD COLUMN IF NOT EXISTS send_anytime boolean NOT NULL DEFAULT false;
UPDATE public.wa_daily_return_settings SET send_anytime=true,updated_at=now()
 WHERE empresa_id='d37fd4bb-1c71-4dca-b97e-292355918d39' AND enabled=true AND consent_attested=true;
CREATE OR REPLACE FUNCTION public.wa_reserve_return(p_empresa uuid, p_processo bigint, p_phone text, p_hash text, p_source text, p_event_at timestamp with time zone, p_mode text, p_message text)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare result_id uuid; v_day date:=(now() at time zone 'America/Sao_Paulo')::date;
begin
 perform pg_advisory_xact_lock(hashtextextended('wa-notice:'||p_empresa::text,0));
 if p_mode not in ('due','requested','single','movement','publication') or
    p_phone !~ '^55[0-9]{10,11}$' or p_hash !~ '^[0-9a-f]{64}$' or
    not exists(select 1 from public.processos where id=p_processo and empresa_id=p_empresa)
 then raise exception 'Invalid notice reservation'; end if;
 if p_mode<>'requested' and
  not exists(select 1 from public.wa_daily_return_settings cfg where cfg.empresa_id=p_empresa
      and cfg.enabled=true and cfg.consent_attested=true and cfg.send_anytime=true)
  and (
   extract(isodow from now() at time zone 'America/Sao_Paulo')>5 or
   (now() at time zone 'America/Sao_Paulo')::time<time '09:00' or
   (now() at time zone 'America/Sao_Paulo')::time>=time '18:00') then return null; end if;
 if exists(select 1 from public.wa_daily_return_sends where empresa_id=p_empresa
   and status in ('reserved','sent','uncertain') and (event_hash=p_hash or (phone=p_phone and v_day=wa_daily_return_sends.local_day)))
 then return null; end if;
 if exists(select 1 from public.wa_movement_dispatches where empresa_id=p_empresa
   and status in ('sent','uncertain') and (event_hash=p_hash or (phone=p_phone and (sent_at at time zone 'America/Sao_Paulo')::date=v_day)))
 then return null; end if;
 if (select count(*) from public.wa_daily_return_sends where empresa_id=p_empresa and v_day=wa_daily_return_sends.local_day
     and status in ('reserved','sent','uncertain'))>=120 then return null; end if;
 if exists(select 1 from public.wa_daily_return_sends where empresa_id=p_empresa
    and status in ('reserved','sent','uncertain') and created_at>now()-interval '45 seconds') then return null; end if;
 insert into public.wa_daily_return_sends(empresa_id,processo_id,phone,local_day,event_hash,source,event_at,mode,message,status)
 values(p_empresa,p_processo,p_phone,v_day,p_hash,p_source,p_event_at,p_mode,p_message,'reserved')
 on conflict(empresa_id,phone,local_day) do update set
  processo_id=excluded.processo_id,event_hash=excluded.event_hash,source=excluded.source,event_at=excluded.event_at,
  mode=excluded.mode,message=excluded.message,status='reserved',created_at=now(),last_error=null
 where wa_daily_return_sends.status='rejected'
 returning id into result_id;
 return result_id;
end $function$

