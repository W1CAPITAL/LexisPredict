-- P0 /vencidos: "retorno vencido" e um agendamento expirado, NAO um
-- texto manual de status. O KPI principal passa a refletir o retorno vencido.
-- Alteracao somente na funcao de leitura: nenhuma linha, status, prazo ou
-- politica RLS e modificada. Mesma assinatura/colunas para os consumidores.
--
-- Fonte: proximo_retorno DATE, ultimo_retorno DATE.
-- Prazo judicial e proximo_prazo legado NAO entram nesta metrica.
CREATE OR REPLACE FUNCTION public.lexis_portfolio_snapshot(
 p_empresa uuid, p_owner uuid DEFAULT NULL::uuid
)
RETURNS TABLE(total bigint, ativos bigint, encerrados bigint,
              vencidos bigint, baixas bigint, procedentes bigint,
              cumprimentos bigint, novidades bigint)
LANGUAGE sql STABLE SET search_path TO 'public','pg_temp' AS $function$
WITH owner_ids AS (
 SELECT id owner_id FROM public.usuarios
 WHERE empresa_id=p_empresa AND (id=p_owner OR auth_user_id=p_owner)
 UNION
 SELECT auth_user_id owner_id FROM public.usuarios
 WHERE empresa_id=p_empresa AND (id=p_owner OR auth_user_id=p_owner)
), scoped AS (
 SELECT p.status, p.proximo_retorno, p.ultimo_retorno,
 p.datajud_encerrado_tribunal,p.is_procedente,p.em_cumprimento_sentenca,
 p.cumprimento_pendente_necessario,p.tem_atualizacao_pos_retorno,p.djen_nova_comunicacao,
 (upper(coalesce(p.dados->>'situacao','')) ~ '(ENCERRAD|ARQUIVAD|EXTINT)'
  OR upper(coalesce(p.status_interno,'')) ~ '(ENCERRAD|ARQUIVAD|EXTINT)'
  OR upper(coalesce(p.status,'')) ~ '(ENCERRAD|ARQUIVAD|EXTINT)') closed_crm,
 (upper(coalesce(p.dados->>'statusManual','')) ~ '(ENCERRAD|ARQUIVAD|EXTINT|BAIXA DEFINITIVA|FINALIZAD)') closed_manual
 FROM public.processos p WHERE p.empresa_id=p_empresa
 AND (p_owner IS NULL OR p.created_by=p_owner OR p.created_by IN (SELECT owner_id FROM owner_ids))
)
SELECT count(*)::bigint,
 count(*) FILTER(WHERE NOT closed_crm)::bigint,
 count(*) FILTER(WHERE closed_crm)::bigint,
 -- Um retorno esta vencido quando ja venceu a data agendada e nao houve
 -- retorno posterior ou no mesmo dia do agendamento. Status manual e
 -- considerado apenas para impedir contagem de caso encerrado.
 count(*) FILTER(WHERE NOT closed_crm AND NOT closed_manual
   AND proximo_retorno < (now() AT TIME ZONE 'America/Sao_Paulo')::date
   AND (ultimo_retorno IS NULL OR ultimo_retorno < proximo_retorno))::bigint,
 count(*) FILTER(WHERE datajud_encerrado_tribunal IS TRUE)::bigint,
 count(*) FILTER(WHERE is_procedente IS TRUE)::bigint,
 count(*) FILTER(WHERE em_cumprimento_sentenca IS TRUE OR cumprimento_pendente_necessario IS TRUE)::bigint,
 count(*) FILTER(WHERE tem_atualizacao_pos_retorno IS TRUE OR djen_nova_comunicacao IS TRUE)::bigint
FROM scoped;
$function$;

COMMENT ON FUNCTION public.lexis_portfolio_snapshot(uuid,uuid) IS
'Portfolio snapshot; vencidos = retornos agendados expirados sem atendimento posterior, nao status manual nem prazo judicial.';
