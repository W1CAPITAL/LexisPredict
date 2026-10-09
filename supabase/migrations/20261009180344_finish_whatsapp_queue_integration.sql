create or replace function public.wa_add_campaign_notice(p_campaign uuid,p_notice jsonb)
returns uuid language plpgsql security invoker set search_path='' as $$
declare c public.wa_movement_campaigns%rowtype; result_id uuid;
begin
 select * into c from public.wa_movement_campaigns where id=p_campaign and status in ('running','paused') and consent_attested for update;
 if not found or not exists(select 1 from public.processos where id=(p_notice->>'processo_id')::bigint and empresa_id=c.empresa_id) then return null; end if;
 if exists(select 1 from public.wa_daily_return_sends where empresa_id=c.empresa_id and event_hash=p_notice->>'event_hash' and status in ('sent','uncertain','reserved')) then return null; end if;
 insert into public.wa_movement_dispatches(empresa_id,campaign_id,processo_id,protocolo,phone,client_name,source,event_at,event_hash,message)
 values(c.empresa_id,c.id,(p_notice->>'processo_id')::bigint,p_notice->>'protocolo',p_notice->>'phone',p_notice->>'client_name',p_notice->>'source',(p_notice->>'event_at')::timestamptz,p_notice->>'event_hash',p_notice->>'message')
 on conflict(empresa_id,processo_id,event_hash) do update set campaign_id=excluded.campaign_id,status='pending',message=excluded.message,phone=excluded.phone,claimed_at=null,last_error=null
 where wa_movement_dispatches.status in ('failed','cancelled') returning id into result_id;
 return result_id;
end $$;
revoke all on function public.wa_add_campaign_notice(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.wa_add_campaign_notice(uuid,jsonb) to service_role;

create or replace function public.wa_next_due_return(p_empresa uuid,p_day date)
returns bigint language sql stable security invoker set search_path='' as $$
 select p.id from public.processos p where p.empresa_id=p_empresa
 and p.proximo_retorno is not null and p.proximo_retorno<=p_day
 and concat_ws(' ',p.status,p.status_interno,p.dados->>'situacao',p.dados->>'SITUACAO',p.dados->>'status',p.dados->>'status_interno',p.dados->>'statusManual',p.dados->>'STATUS_MANUAL')
 !~* '(ENCERRAD|ARQUIVAD|ARQUIVAMENTO|EXTINT|EXTIN[ÇC][AÃ]O|SUSPENS|BAIXA DEFINITIVA|FINALIZAD|IM[OÓ]VEL)'
 and not exists(select 1 from public.wa_daily_return_checks k where k.empresa_id=p_empresa and k.processo_id=p.id and k.local_day=p_day and k.mode='due')
 order by p.proximo_retorno,p.id limit 1
$$;
revoke all on function public.wa_next_due_return(uuid,date) from public,anon,authenticated;
grant execute on function public.wa_next_due_return(uuid,date) to service_role;
