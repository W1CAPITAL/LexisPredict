-- Server-only helpers. No recipient flags are fabricated by this migration.
alter table public.wa_daily_return_settings
  add column if not exists consent_attested boolean not null default false,
  add column if not exists consent_attested_at timestamptz,
  add column if not exists consent_attested_by uuid;
alter table public.wa_daily_return_sends drop constraint if exists wa_daily_return_sends_mode_check;
alter table public.wa_daily_return_sends add constraint wa_daily_return_sends_mode_check
  check(mode in ('due','requested','single','movement','publication'));
create index if not exists wa_notice_portfolio_idx on public.processos(empresa_id,id);
create unique index if not exists wa_notice_event_once on public.wa_daily_return_sends(empresa_id,event_hash)
  where status in ('reserved','sent','uncertain');

-- Project just the notification fields, avoiding multi-MB dados/tribunal payloads.
create or replace function public.wa_notice_portfolio_rows(p_empresa uuid,p_after bigint default 0,p_limit integer default 600)
returns setof jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object(
  'id',p.id,'empresa_id',p.empresa_id,'cliente',p.cliente,'telefone',p.telefone,'protocolo_ref',p.protocolo_ref,
  'ultimo_retorno',p.ultimo_retorno,'proximo_retorno',p.proximo_retorno,'status',p.status,'status_interno',p.status_interno,
  'datajud_ultimo_movimento',p.datajud_ultimo_movimento,'datajud_ultimo_nome',p.datajud_ultimo_nome,
  'djen_ultima_data',p.djen_ultima_data,'djen_ultimo_resumo',p.djen_ultimo_resumo,
  'dados',jsonb_strip_nulls(jsonb_build_object(
   'cliente',p.dados->'cliente','CLIENTE',p.dados->'CLIENTE','telefone',p.dados->'telefone','TELEFONE',p.dados->'TELEFONE',
   'protocolo',p.dados->'protocolo','situacao',p.dados->'situacao','SITUACAO',p.dados->'SITUACAO',
   'status',p.dados->'status','status_interno',p.dados->'status_interno','statusManual',p.dados->'statusManual','STATUS_MANUAL',p.dados->'STATUS_MANUAL',
   'whatsapp_opt_in',p.dados->'whatsapp_opt_in','consentimento_whatsapp',p.dados->'consentimento_whatsapp','whatsapp_autorizado',p.dados->'whatsapp_autorizado',
   'nao_contatar',p.dados->'nao_contatar','não_contatar',p.dados->'não_contatar','whatsapp_opt_out',p.dados->'whatsapp_opt_out',
   'optOut',p.dados->'optOut','optout',p.dados->'optout','bloquear_whatsapp',p.dados->'bloquear_whatsapp','naoEnviarWhatsapp',p.dados->'naoEnviarWhatsapp',
   'ultimoRetorno',p.dados->'ultimoRetorno','ultimo_retorno',p.dados->'ultimo_retorno',
   'proximoRetorno',p.dados->'proximoRetorno','proximo_retorno',p.dados->'proximo_retorno'
  )))
 from public.processos p where p.empresa_id=p_empresa and p.id>p_after
 order by p.id limit least(600,greatest(1,p_limit))
$$;
create or replace function public.wa_notice_prior(p_empresa uuid)
returns jsonb language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(x),'[]'::jsonb) from (
  select processo_id,event_hash from public.wa_movement_dispatches
   where empresa_id=p_empresa and status in ('pending','processing','sent','uncertain')
  union select processo_id,event_hash from public.wa_daily_return_sends
   where empresa_id=p_empresa and status in ('reserved','sent','uncertain')
 ) x
$$;

-- Shared atomic quota/phone/event reservation for scanner, requests and campaigns.
create or replace function public.wa_reserve_return(
 p_empresa uuid,p_processo bigint,p_phone text,p_hash text,p_source text,
 p_event_at timestamptz,p_mode text,p_message text)
returns uuid language plpgsql security invoker set search_path='' as $$
declare result_id uuid; v_day date:=(now() at time zone 'America/Sao_Paulo')::date;
begin
 perform pg_advisory_xact_lock(hashtextextended('wa-notice:'||p_empresa::text,0));
 if p_mode not in ('due','requested','single','movement','publication') or
    p_phone !~ '^55[0-9]{10,11}$' or p_hash !~ '^[0-9a-f]{64}$' or
    not exists(select 1 from public.processos where id=p_processo and empresa_id=p_empresa)
 then raise exception 'Invalid notice reservation'; end if;
 if p_mode<>'requested' and (
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
end $$;

create or replace function public.wa_record_return(p_empresa uuid,p_processo bigint,p_prior date,p_day date,p_interval integer,p_send uuid)
returns boolean language plpgsql security invoker set search_path='' as $$
declare updated_id bigint;
begin
 if not exists(select 1 from public.wa_daily_return_sends where id=p_send and empresa_id=p_empresa
   and processo_id=p_processo and status='sent' and local_day=p_day) then return false; end if;
 update public.processos set ultimo_retorno=p_day,proximo_retorno=p_day+least(30,greatest(1,p_interval)),updated_at=now(),
   dados=coalesce(dados,'{}'::jsonb)||jsonb_build_object('ultimoRetorno',p_day,'proximoRetorno',p_day+least(30,greatest(1,p_interval)),
     'wa_ultimo_retorno',jsonb_build_object('data',p_day,'envio_id',p_send))
 where empresa_id=p_empresa and id=p_processo and ultimo_retorno is not distinct from p_prior
 returning id into updated_id;
 return updated_id is not null;
end $$;

create or replace function public.wa_enqueue_notice(p_empresa uuid,p_owner uuid,p_notice jsonb)
returns uuid language plpgsql security invoker set search_path='' as $$
declare v_campaign_id uuid; result_id uuid;
begin
 perform pg_advisory_xact_lock(hashtextextended('wa-enqueue:'||p_empresa::text,0));
 if not exists(select 1 from public.wa_daily_return_settings where empresa_id=p_empresa
   and owner_auth_id=p_owner and enabled and consent_attested) then return null; end if;
 if not exists(select 1 from public.usuarios where empresa_id=p_empresa and auth_user_id=p_owner
   and lower(cargo) in ('superadmin','supervisor','administrador')) then return null; end if;
 if not exists(select 1 from public.processos where empresa_id=p_empresa and id=(p_notice->>'processo_id')::bigint)
 then return null; end if;
 if exists(select 1 from public.wa_daily_return_sends where empresa_id=p_empresa and event_hash=p_notice->>'event_hash'
   and status in ('reserved','sent','uncertain')) then return null; end if;
 select id into v_campaign_id from public.wa_movement_campaigns where empresa_id=p_empresa
   and owner_auth_id=p_owner and status in ('running','paused') order by created_at desc limit 1 for update;
 if v_campaign_id is null then
  insert into public.wa_movement_campaigns(empresa_id,owner_auth_id,consent_attested,status,campaign_kind)
   values(p_empresa,p_owner,true,'running','movement') returning id into v_campaign_id;
 end if;
 insert into public.wa_movement_dispatches(empresa_id,campaign_id,processo_id,protocolo,phone,client_name,source,event_at,event_hash,message)
 values(p_empresa,v_campaign_id,(p_notice->>'processo_id')::bigint,p_notice->>'protocolo',p_notice->>'phone',
   p_notice->>'client_name',p_notice->>'source',(p_notice->>'event_at')::timestamptz,p_notice->>'event_hash',p_notice->>'message')
 on conflict(empresa_id,processo_id,event_hash) do update set campaign_id=excluded.campaign_id,status='pending',
   message=excluded.message,phone=excluded.phone,claimed_at=null,last_error=null
 where wa_movement_dispatches.status in ('failed','cancelled') returning id into result_id;
 if result_id is not null then
  update public.wa_movement_campaigns set total=(select count(*) from public.wa_movement_dispatches d where d.campaign_id=wa_movement_campaigns.id),updated_at=now()
   where id=v_campaign_id;
 end if;
 return result_id;
end $$;

revoke all on function public.wa_notice_portfolio_rows(uuid,bigint,integer),public.wa_notice_prior(uuid),
 public.wa_reserve_return(uuid,bigint,text,text,text,timestamptz,text,text),public.wa_record_return(uuid,bigint,date,date,integer,uuid),
 public.wa_enqueue_notice(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.wa_notice_portfolio_rows(uuid,bigint,integer),public.wa_notice_prior(uuid),
 public.wa_reserve_return(uuid,bigint,text,text,text,timestamptz,text,text),public.wa_record_return(uuid,bigint,date,date,integer,uuid),
 public.wa_enqueue_notice(uuid,uuid,jsonb) to service_role;

