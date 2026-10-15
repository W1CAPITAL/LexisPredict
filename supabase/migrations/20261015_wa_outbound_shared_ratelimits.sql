-- Safety gate: all outbound preparation paths use the same tenant pause and slow cadence.
CREATE OR REPLACE FUNCTION public.wa_reserve_return(p_empresa uuid, p_processo bigint, p_phone text, p_hash text, p_source text, p_event_at timestamp with time zone, p_mode text, p_message text)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare result_id uuid; v_day date:=(now() at time zone 'America/Sao_Paulo')::date;
begin
 perform pg_advisory_xact_lock(hashtextextended('wa-notice:'||p_empresa::text,0));
 -- A paused or restricted number must not generate new outbound jobs.
 if exists(select 1 from public.wa_outbound_safety_limits cfg where cfg.empresa_id=p_empresa
     and (cfg.paused or cfg.cooldown_until>now())) then return null; end if;
 -- Never prepare a second outbound while an existing job awaits dispatch.
 if exists(select 1 from public.wa_local_jobs j where j.empresa_id=p_empresa
     and j.status in ('pending','claimed')) then return null; end if;
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
     and status in ('reserved','sent','uncertain'))>=12 then return null; end if;
 if exists(select 1 from public.wa_daily_return_sends where empresa_id=p_empresa
    and status in ('reserved','sent','uncertain') and created_at>now()-interval '15 minutes') then return null; end if;
 insert into public.wa_daily_return_sends(empresa_id,processo_id,phone,local_day,event_hash,source,event_at,mode,message,status)
 values(p_empresa,p_processo,p_phone,v_day,p_hash,p_source,p_event_at,p_mode,p_message,'reserved')
 on conflict(empresa_id,phone,local_day) do update set
  processo_id=excluded.processo_id,event_hash=excluded.event_hash,source=excluded.source,event_at=excluded.event_at,
  mode=excluded.mode,message=excluded.message,status='reserved',created_at=now(),last_error=null
 where wa_daily_return_sends.status='rejected'
 returning id into result_id;
 return result_id;
end $function$;
CREATE OR REPLACE FUNCTION public.wa_claim_movement(p_campaign uuid DEFAULT NULL::uuid)
 RETURNS SETOF wa_movement_dispatches
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare c public.wa_movement_campaigns%rowtype;
        e public.wa_movement_dispatches%rowtype;
        daily_count integer;
        publication_count integer;
        next_work timestamptz;
        min_gap interval;
begin
  if exists(select 1 from public.wa_outbound_safety_limits cfg
    join public.wa_movement_campaigns camp on camp.empresa_id=cfg.empresa_id
    where camp.status='running'
      and (p_campaign is null or camp.id=p_campaign)
      and (cfg.paused or cfg.cooldown_until>now())) then return; end if;
  update public.wa_movement_dispatches
     set status='uncertain',
         last_error='Resultado desconhecido após interrupção; confira a conversa antes de reenviar.'
   where status='processing' and claimed_at < now()-interval '5 minutes';
  update public.wa_movement_campaigns c0
     set status='paused',updated_at=now()
   where status='running' and exists(
     select 1 from public.wa_movement_dispatches d
      where d.campaign_id=c0.id and d.status='uncertain'
   );
  select * into c from public.wa_movement_campaigns
   where status='running' and next_send_at<=now()
     and (p_campaign is null or id=p_campaign)
   order by next_send_at,created_at
   for update skip locked limit 1;
  if not found then return; end if;

  select count(*) into daily_count from public.wa_movement_dispatches
   where empresa_id=c.empresa_id and status='sent'
     and (sent_at at time zone 'America/Sao_Paulo')::date =
         (now() at time zone 'America/Sao_Paulo')::date;
  if daily_count >= 12 then
    update public.wa_movement_campaigns set next_send_at =
      (date_trunc('day',now() at time zone 'America/Sao_Paulo') + interval '1 day 9 hours')
      at time zone 'America/Sao_Paulo'
      where id=c.id;
    return;
  end if;
  if c.campaign_kind='publication' then
    select count(*) into publication_count
      from public.wa_movement_dispatches d
      join public.wa_movement_campaigns camp on camp.id=d.campaign_id
      where d.empresa_id=c.empresa_id and d.status='sent'
        and camp.campaign_kind='publication'
        and (d.sent_at at time zone 'America/Sao_Paulo')::date =
            (now() at time zone 'America/Sao_Paulo')::date;
    if publication_count>=8 then
      update public.wa_movement_campaigns set next_send_at =
        (date_trunc('day',now() at time zone 'America/Sao_Paulo') + interval '1 day 9 hours')
           at time zone 'America/Sao_Paulo'
      where id=c.id;
      return;
    end if;
    -- Send business notices only during staffed weekday hours.
    if extract(isodow from now() at time zone 'America/Sao_Paulo')>5 or
       (now() at time zone 'America/Sao_Paulo')::time < time '09:00' or
       (now() at time zone 'America/Sao_Paulo')::time >= time '18:00' then
      update public.wa_movement_campaigns set next_send_at=now()+interval '1 hour'
      where id=c.id;
      return;
    end if;
  end if;
  if exists(select 1 from public.wa_local_jobs j where j.empresa_id=c.empresa_id
     and (j.status in ('pending','claimed') or j.claimed_at>now()-interval '15 minutes'))
  then
    update public.wa_movement_campaigns set next_send_at=now()+interval '15 minutes' where id=c.id;
    return;
  end if;
  select * into e from public.wa_movement_dispatches
   where campaign_id=c.id and status='pending'
     and not exists(select 1 from public.wa_daily_return_sends shared where shared.empresa_id=c.empresa_id
       and shared.status in ('reserved','sent','uncertain') and (shared.event_hash=wa_movement_dispatches.event_hash
         or (shared.phone=wa_movement_dispatches.phone and shared.local_day=(now() at time zone 'America/Sao_Paulo')::date)))
     and (c.campaign_kind<>'publication' or not exists (
       select 1 from public.wa_movement_dispatches previous
        where previous.empresa_id=c.empresa_id
          and previous.phone=wa_movement_dispatches.phone
          and previous.status='sent'
          and previous.sent_at>now()-interval '24 hours'
     ))
   order by created_at,id for update skip locked limit 1;
  if not found then
    if exists(select 1 from public.wa_movement_dispatches
              where campaign_id=c.id and status='pending') then
      -- Remaining recipients are waiting for their 24h window; do not
      -- incorrectly complete the campaign.
      update public.wa_movement_campaigns set next_send_at=now()+interval '1 hour' where id=c.id;
    elsif not exists(select 1 from public.wa_movement_dispatches
                  where campaign_id=c.id and status='processing') then
      update public.wa_movement_campaigns
        set status='completed',updated_at=now() where id=c.id;
    end if;
    return;
  end if;
  update public.wa_movement_dispatches
    set status='processing',claimed_at=now() where id=e.id;
  min_gap=interval '15 minutes';
  update public.wa_movement_campaigns
    set next_send_at=now()+min_gap,updated_at=now() where id=c.id;
  e.status='processing';e.claimed_at=now();
  return next e;
end $function$;
CREATE OR REPLACE FUNCTION public.lexis_queue_welcome_one()
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r record; new_job uuid;
begin
 select p.auth_user_id,p.empresa_id,p.display_name,p.phone
 into r from public.lexis_user_experience p
 join public.wa_local_bridges b on b.empresa_id=p.empresa_id
 where p.welcome_status='waiting' and p.welcome_opt_in=true
 and p.terms_accepted_at is not null and p.phone ~ '^55[1-9][0-9]{9,10}$'
 and b.state='ready' and b.last_seen>now()-interval '45 seconds'
 order by p.created_at
 for update of p skip locked limit 1;
 if not found then return null; end if;
 if exists(select 1 from public.wa_outbound_safety_limits cfg where cfg.empresa_id=r.empresa_id
   and (cfg.paused or cfg.cooldown_until>now())) then return null; end if;
 if exists(select 1 from public.wa_contact_optouts o
           where o.empresa_id=r.empresa_id and o.phone=r.phone) then
  update public.lexis_user_experience set welcome_status='not_sent',updated_at=now()
   where auth_user_id=r.auth_user_id;
  return null;
 end if;
 if exists(select 1 from public.wa_local_jobs j where j.empresa_id=r.empresa_id
  and j.created_at>now()-interval '15 minutes') then return null; end if;
 if (select count(*) from public.wa_local_jobs j
       where j.empresa_id=r.empresa_id
         and j.created_at>(now() at time zone 'America/Sao_Paulo')::date
           at time zone 'America/Sao_Paulo')>=12 then return null; end if;
 insert into public.wa_local_jobs(empresa_id,created_by,to_phone,body,status)
 values (r.empresa_id,r.auth_user_id,r.phone,
   format('Olá, %s! 👋 Boas-vindas ao LexisPredict! Seu ambiente foi personalizado e suas preferências estão salvas. Este número recebe apenas esta mensagem inicial por sua escolha no cadastro. Para ajuda, acesse o suporte dentro do aplicativo.',split_part(r.display_name,' ',1)),
   'pending')
 returning id into new_job;
 update public.lexis_user_experience
 set welcome_job_id=new_job,welcome_status='queued',updated_at=now()
 where auth_user_id=r.auth_user_id;
 return new_job;
end
$function$;
REVOKE ALL ON FUNCTION public.lexis_queue_welcome_one() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.lexis_queue_welcome_one() TO service_role;
