-- Reduce portfolio preview from five slow network pages to one compact RPC.
-- Reuses the existing small judicial projection; never dumps entire 'dados'.
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
 order by p.id limit least(3000,greatest(1,p_limit))
$$;

revoke all on function public.wa_notice_portfolio_rows(uuid,bigint,integer) from public,anon,authenticated;
grant execute on function public.wa_notice_portfolio_rows(uuid,bigint,integer) to service_role;

-- Bulk insert is atomic per request and restricted to existing per-tenant
-- campaign rows. It delegates actual constraints to wa_add_campaign_notice.
create or replace function public.wa_add_campaign_notices(p_campaign uuid,p_notices jsonb)
returns integer language plpgsql security invoker set search_path='' as $$
declare
  campaign public.wa_movement_campaigns%rowtype;
  item jsonb;
  accepted uuid;
  total integer:=0;
begin
  if jsonb_typeof(p_notices)<>'array' or jsonb_array_length(p_notices)>500
  then raise exception 'Invalid campaign batch'; end if;
  select * into campaign from public.wa_movement_campaigns
    where id=p_campaign and status='paused' and consent_attested=true
    for update;
  if not found then raise exception 'Campaign not ready for queueing'; end if;
  for item in select value from jsonb_array_elements(p_notices) loop
    if item->>'empresa_id' is distinct from campaign.empresa_id::text
    then raise exception 'Tenant mismatch'; end if;
    accepted:=public.wa_add_campaign_notice(p_campaign,item);
    if accepted is not null then total:=total+1; end if;
  end loop;
  return total;
end $$;
revoke all on function public.wa_add_campaign_notices(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.wa_add_campaign_notices(uuid,jsonb) to service_role;
