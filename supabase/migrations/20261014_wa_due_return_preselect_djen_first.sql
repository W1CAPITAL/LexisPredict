-- Filtra inviáveis antes de qualquer acesso remoto (não faz envios).
-- Mantém o isolamento por empresa e o ledger de checks, sem alterar retorno.
create or replace function public.wa_next_due_return(p_empresa uuid,p_day date)
returns bigint
language sql stable set search_path to ''
as $$
 select p.id from public.processos p where p.empresa_id=p_empresa
 and p.proximo_retorno is not null and p.proximo_retorno<=p_day
 and concat_ws(' ',p.status,p.status_interno,p.dados->>'situacao',p.dados->>'SITUACAO',
   p.dados->>'status',p.dados->>'status_interno',p.dados->>'statusManual',p.dados->>'STATUS_MANUAL')
   !~* '(ENCERRAD|ARQUIVAD|ARQUIVAMENTO|EXTINT|EXTIN[ÇC][AÃ]O|SUSPENS|BAIXA DEFINITIVA|FINALIZAD|IM[OÓ]VEL)'
 -- Valida o telefone normalizado, inclusive campos legados no JSON.
 and regexp_replace(coalesce(nullif(trim(p.telefone::text),''),
     nullif(trim(p.dados->>'telefone'),''),
     nullif(trim(p.dados->>'TELEFONE'),''),''),'[^0-9]','','g')
     ~ '^(55)?[0-9]{10,11}$'
 -- Sem último retorno não há referência para comparar.
 and coalesce(nullif(trim(p.ultimo_retorno::text),''),
     nullif(trim(p.dados->>'ultimoRetorno'),''),
     nullif(trim(p.dados->>'ultimo_retorno'),'')) is not null
 -- Evita chamadas a tribunal com números malformados.
 and regexp_replace(coalesce(p.protocolo_ref::text,''),'[^0-9]','','g') ~ '^[0-9]{20}$'
 and not exists(select 1 from public.wa_daily_return_checks k
   where k.empresa_id=p_empresa and k.processo_id=p.id and k.local_day=p_day and k.mode='due')
 order by
 -- DJEN com data posterior ao retorno ganha prioridade; não exclui casos DataJud.
 case when left(coalesce(p.djen_ultima_data::text,''),10)
   > coalesce(nullif(p.ultimo_retorno::text,''),p.dados->>'ultimoRetorno',p.dados->>'ultimo_retorno','')
   then 0 else 1 end,
 p.proximo_retorno,p.id limit 1
$$;
create index if not exists processos_wa_due_empresa_data_idx
on public.processos(empresa_id,proximo_retorno,id)
where proximo_retorno is not null;
