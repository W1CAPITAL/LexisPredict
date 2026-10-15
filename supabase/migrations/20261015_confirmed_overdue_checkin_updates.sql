ALTER TABLE public.wa_daily_return_sends DROP CONSTRAINT IF EXISTS wa_daily_return_sends_mode_check;
ALTER TABLE public.wa_daily_return_sends ADD CONSTRAINT wa_daily_return_sends_mode_check
CHECK (mode IN ('due','requested','single','movement','publication','checkin'));
CREATE OR REPLACE FUNCTION public.wa_reserve_return(p_empresa uuid, p_processo bigint, p_phone text, p_hash text, p_source text, p_event_at timestamp with time zone, p_mode text, p_message text)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare result_id uuid; v_day date:=(now() at time zone 'America/Sao_Paulo')::date;
begin
 perform pg_advisory_xact_lock(hashtextextended('wa-notice:'||p_empresa::text,0));
 if p_mode not in ('due','requested','single','movement','publication','checkin') or
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
end $function$;
CREATE OR REPLACE FUNCTION public.wa_automatic_return_ack()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare s public.wa_daily_return_sends%rowtype; cfg record; changed bigint;
begin
  if new.status is not distinct from old.status then return new; end if;
  if new.status in ('accepted','delivered','read') then
    update public.wa_daily_return_sends set status='sent',
      sent_at=coalesce(sent_at,now()),last_error=null
    where empresa_id=new.empresa_id and wa_job_id=new.id and status='reserved'
    returning * into s;
    if found then
      select interval_days into cfg from public.wa_daily_return_settings
        where empresa_id=s.empresa_id;
      update public.processos
        set ultimo_retorno=s.local_day,
          proximo_retorno=s.local_day + least(30,greatest(1,coalesce(cfg.interval_days,1))),
          updated_at=now(),
          dados=coalesce(dados,'{}'::jsonb)||jsonb_build_object(
            'ultimoRetorno',s.local_day,
            'ultimo_retorno',s.local_day,
            'proximoRetorno',s.local_day+least(30,greatest(1,coalesce(cfg.interval_days,1))),
            'wa_ultimo_retorno',jsonb_build_object('data',s.local_day,'envio_id',s.id))
      where empresa_id=s.empresa_id and id=s.processo_id
        and ultimo_retorno is not distinct from s.prior_return
        and ((s.mode='checkin' and proximo_retorno <= (now() at time zone 'America/Sao_Paulo')::date)
     or (s.mode<>'checkin' and (s.event_at at time zone 'America/Sao_Paulo')::date > coalesce(ultimo_retorno,date '2000-01-01')))
      returning id into changed;
      update public.wa_daily_return_checks
        set result=case when changed is not null then 'sent' else 'sent_dates_review' end,
          checked_at=now()
        where empresa_id=s.empresa_id and processo_id=s.processo_id
          and local_day=s.local_day and mode='due';
    end if;
  elsif new.status in ('failed','uncertain') then
    update public.wa_daily_return_sends
      set status=case when new.status='failed' then 'rejected' else 'uncertain' end,
        last_error=coalesce(new.last_error,'WhatsApp did not confirm the send')
      where empresa_id=new.empresa_id and wa_job_id=new.id and status='reserved'
      returning * into s;
    if found then
      update public.wa_daily_return_checks
      set result=case when new.status='failed' then 'send_rejected' else 'send_uncertain' end,
        checked_at=now()
      where empresa_id=s.empresa_id and processo_id=s.processo_id
        and local_day=s.local_day and mode='due';
    end if;
  end if;
  return new;
end $function$;
