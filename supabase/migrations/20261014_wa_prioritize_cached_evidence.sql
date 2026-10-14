-- Reuse verified source data before accessing the courts. Prioritize
-- sendable official evidence, then successful recent scans, then stale notices.
-- This selector never sends WhatsApp messages or changes return dates.
create or replace function public.wa_next_due_return(p_empresa uuid,p_day date)
returns bigint language sql stable set search_path to ''
as $$
 select p.id from public.processos p where p.empresa_id=p_empresa
 and p.proximo_retorno is not null and p.proximo_retorno<=p_day
 and concat_ws(' ',p.status,p.status_interno,p.dados->>'situacao',p.dados->>'SITUACAO',
   p.dados->>'status',p.dados->>'status_interno',p.dados->>'statusManual',p.dados->>'STATUS_MANUAL')
   !~* '(ENCERRAD|ARQUIVAD|ARQUIVAMENTO|EXTINT|EXTIN[ÇC][AÃ]O|SUSPENS|BAIXA DEFINITIVA|FINALIZAD|IM[OÓ]VEL)'
 and regexp_replace(coalesce(nullif(trim(p.telefone::text),''),
    nullif(trim(p.dados->>'telefone'),''),nullif(trim(p.dados->>'TELEFONE'),''),''),
    '[^0-9]','','g') ~ '^(55)?[0-9]{10,11}$'
 and coalesce(nullif(trim(p.ultimo_retorno::text),''),
    nullif(trim(p.dados->>'ultimoRetorno'),''),nullif(trim(p.dados->>'ultimo_retorno'),'')) is not null
 and regexp_replace(coalesce(p.protocolo_ref::text,''),'[^0-9]','','g') ~ '^[0-9]{20}$'
 and not exists (
    select 1 from public.wa_daily_return_checks k
    where k.empresa_id=p_empresa and k.processo_id=p.id and k.local_day=p_day and k.mode='due'
 )
 order by
  case
    -- DJEN evidence can be used directly only when original publication,
    -- matching CNJ, timestamp and content have been persisted recently.
    when p.djen_last_ok is true and p.djen_consultado_em between now()-interval '24 hours' and now()+interval '1 minute'
     and p.dados->'wa_djen_evidence'->>'origin'='official-djen'
     and p.dados->'wa_djen_evidence'->>'cnj'=regexp_replace(p.protocolo_ref::text,'[^0-9]','','g')
     and nullif(trim(p.dados->'wa_djen_evidence'->>'text'),'') is not null
     and left(coalesce(p.dados->'wa_djen_evidence'->>'eventAt',''),10)=left(coalesce(p.djen_ultima_data,''),10)
     and left(coalesce(p.djen_ultima_data,''),10)>coalesce(p.ultimo_retorno::text,p.dados->>'ultimoRetorno',p.dados->>'ultimo_retorno','')
     then 0
    -- Official DataJud movement already saved AND recently verified. The
    -- policy will still reject ambiguous, terminal and generic movements.
    when p.datajud_last_ok is true and p.datajud_consultado_em between now()-interval '24 hours' and now()+interval '1 minute'
     and (p.datajud_ultimo_movimento at time zone 'America/Sao_Paulo')::date>p.ultimo_retorno
     and nullif(trim(p.datajud_ultimo_nome),'') is not null then 0
    -- Both official sources scanned successfully in the past 6h can be
    -- closed out with a local check, without another HTTP round trip.
    when p.datajud_last_ok is true and p.djen_last_ok is true
     and p.datajud_consultado_em between now()-interval '6 hours' and now()+interval '1 minute'
     and p.djen_consultado_em between now()-interval '6 hours' and now()+interval '1 minute' then 1
    -- Stale movements after the last return deserve early targeted refresh.
    when left(coalesce(p.djen_ultima_data,''),10)>coalesce(p.ultimo_retorno::text,p.dados->>'ultimoRetorno',p.dados->>'ultimo_retorno','')
      or (p.datajud_ultimo_movimento at time zone 'America/Sao_Paulo')::date>p.ultimo_retorno then 2
    else 3
  end,
  p.proximo_retorno,p.id limit 1
$$;
