-- Recompute from the explicit classifier; do not preserve stale divergence
-- labels that were caused solely by the unreliable legacy is_procedente flag.
CREATE OR REPLACE FUNCTION public.lexis_atualizar_merito_indice()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_categoria text;
BEGIN
  v_categoria := public.lexis_merito_categoria_calc(
    NEW.is_procedente,NEW.dados,NEW.procedente_motivo
  );
  INSERT INTO public.lexis_merito_indice(processo_id,empresa_id,created_by,categoria)
  VALUES(NEW.id,NEW.empresa_id,NEW.created_by,v_categoria)
  ON CONFLICT(processo_id) DO UPDATE SET
    empresa_id=excluded.empresa_id,created_by=excluded.created_by,
    categoria=excluded.categoria,atualizado_em=now()
  WHERE (lexis_merito_indice.empresa_id,lexis_merito_indice.created_by,lexis_merito_indice.categoria)
    IS DISTINCT FROM (excluded.empresa_id,excluded.created_by,excluded.categoria);
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_lexis_merito_indice ON public.processos;
CREATE TRIGGER trg_lexis_merito_indice
AFTER INSERT OR UPDATE OF dados,is_procedente,procedente_motivo,created_by,empresa_id
ON public.processos FOR EACH ROW EXECUTE FUNCTION public.lexis_atualizar_merito_indice();

-- Repair all existing rows and backfill any missing index rows.
INSERT INTO public.lexis_merito_indice(processo_id,empresa_id,created_by,categoria)
SELECT p.id,p.empresa_id,p.created_by,
  public.lexis_merito_categoria_calc(p.is_procedente,p.dados,p.procedente_motivo)
FROM public.processos p
ON CONFLICT(processo_id) DO UPDATE SET
  empresa_id=excluded.empresa_id,created_by=excluded.created_by,
  categoria=excluded.categoria,atualizado_em=now()
WHERE (lexis_merito_indice.empresa_id,lexis_merito_indice.created_by,lexis_merito_indice.categoria)
  IS DISTINCT FROM (excluded.empresa_id,excluded.created_by,excluded.categoria);

CREATE OR REPLACE FUNCTION public.lexis_merito_snapshot(
  p_empresa uuid,p_owner uuid DEFAULT NULL::uuid
)
RETURNS jsonb LANGUAGE sql STABLE SET search_path TO 'public'
AS $function$
WITH owner_ids AS (
  SELECT id AS owner_id FROM public.usuarios
  WHERE empresa_id=p_empresa AND (id=p_owner OR auth_user_id=p_owner)
  UNION
  SELECT auth_user_id AS owner_id FROM public.usuarios
  WHERE empresa_id=p_empresa AND (id=p_owner OR auth_user_id=p_owner)
),
cats AS (
  SELECT i.categoria FROM public.lexis_merito_indice i
  WHERE i.empresa_id=p_empresa
    AND (p_owner IS NULL OR i.created_by=p_owner OR i.created_by IN (SELECT owner_id FROM owner_ids))
),
c AS (
  SELECT p.status,p.em_cumprimento_sentenca,p.cumprimento_pendente_necessario,
    p.dados,p.status_executivo,p.detalhes_execucao,
    p.dados->>'merito_fonte' AS fonte,
    p.dados->'merito_datajud_20261022'->>'resultado' AS resultado,
    (
      lower(coalesce(p.dados->>'status_executivo',''))='ativo'
      OR lower(coalesce(p.status_executivo,''))='ativo'
      OR lower(coalesce(p.detalhes_execucao->>'status_executivo',''))='ativo'
      OR lower(coalesce(p.dados->>'cumprimento_ativo','false'))='true'
      OR lower(coalesce(p.detalhes_execucao->>'cumprimento_ativo','false'))='true'
    ) AS exec_active,
    (
      lower(coalesce(p.dados->>'status_executivo','')) ~ '(encerrad|extint|arquiv|baixad)'
      OR lower(coalesce(p.status_executivo,'')) ~ '(encerrad|extint|arquiv|baixad)'
      OR lower(coalesce(p.detalhes_execucao->>'status_executivo','')) ~ '(encerrad|extint|arquiv|baixad)'
      OR lower(coalesce(p.dados->>'cumprimento_encerrado','false'))='true'
      OR lower(coalesce(p.detalhes_execucao->>'cumprimento_encerrado','false'))='true'
    ) AS exec_closed
  FROM public.processos p
  WHERE p.empresa_id=p_empresa
    AND (p_owner IS NULL OR p.created_by=p_owner OR p.created_by IN (SELECT owner_id FROM owner_ids))
),
base AS (
  SELECT count(*) AS total,
    count(*) FILTER(WHERE categoria='procedente') AS procedentes,
    count(*) FILTER(WHERE categoria='improcedente') AS improcedentes,
    count(*) FILTER(WHERE categoria='parcial') AS parciais,
    count(*) FILTER(WHERE categoria='divergente') AS divergentes,
    count(*) FILTER(WHERE categoria='sem_indicador') AS sem_indicador
  FROM cats
),
exec_counts AS (
  SELECT
    count(*) FILTER(WHERE em_cumprimento_sentenca IS TRUE AND exec_active AND NOT exec_closed) AS cumprimentos_ativos,
    count(*) FILTER(WHERE cumprimento_pendente_necessario IS TRUE AND NOT exec_active AND NOT exec_closed) AS cumprimentos_pendentes,
    count(*) FILTER(WHERE em_cumprimento_sentenca IS TRUE AND NOT exec_active AND NOT exec_closed) AS cumprimentos_revisar,
    count(*) FILTER(WHERE em_cumprimento_sentenca IS TRUE OR cumprimento_pendente_necessario IS TRUE) AS cumprimentos_sinalizados,
    count(*) FILTER(WHERE exec_closed) AS cumprimentos_encerrados
  FROM c
),
oficial AS (
  SELECT
    count(*) FILTER(WHERE status='Encerrado') AS encerrados,
    count(*) FILTER(WHERE status='Encerrado' AND em_cumprimento_sentenca) AS encerrados_cumprimento,
    count(*) FILTER(WHERE status='Encerrado' AND fonte='datajud_tpu_2026-10-22' AND resultado='improcedente') AS improcedentes,
    count(*) FILTER(WHERE status='Encerrado' AND fonte='datajud_tpu_2026-10-22' AND resultado='procedente') AS procedentes,
    count(*) FILTER(WHERE status='Encerrado' AND fonte='datajud_tpu_2026-10-22' AND resultado='parcial') AS parciais,
    count(*) FILTER(WHERE status='Encerrado' AND fonte='datajud_tpu_2026-10-22' AND resultado='conflito_resultados') AS divergentes,
    count(*) FILTER(WHERE status='Encerrado' AND resultado='sem_merito') AS sem_merito,
    count(*) FILTER(WHERE status='Encerrado' AND resultado='acordo_homologado') AS acordos,
    count(*) FILTER(WHERE status='Encerrado' AND resultado='indeferimento_inicial') AS indeferimentos,
    count(*) FILTER(WHERE status='Encerrado' AND resultado='cancelamento_distribuicao') AS cancelamentos,
    count(*) FILTER(WHERE status='Encerrado' AND resultado='desistencia') AS desistencias,
    count(*) FILTER(WHERE status='Encerrado' AND resultado='abandono') AS abandonos,
    count(*) FILTER(WHERE status='Encerrado' AND resultado='nao_determinado') AS nao_determinados,
    count(*) FILTER(WHERE status='Encerrado' AND resultado='nao_localizado') AS nao_localizados
  FROM c
)
SELECT jsonb_build_object(
  'total',base.total,'procedentes',base.procedentes,'improcedentes',base.improcedentes,
  'parciais',base.parciais,'divergentes',base.divergentes,'semIndicador',base.sem_indicador,
  'cumprimentosAtivos',exec_counts.cumprimentos_ativos,
  'cumprimentosPendentes',exec_counts.cumprimentos_pendentes,
  'cumprimentosRevisar',exec_counts.cumprimentos_revisar,
  'cumprimentosSinalizados',exec_counts.cumprimentos_sinalizados,
  'cumprimentosEncerrados',exec_counts.cumprimentos_encerrados,
  'criterio','Resultado classificado pelo motivo cadastrado e por campos estruturados explícitos. Resultado de movimentação não confirma trânsito em julgado ou resultado definitivo de recurso.',
  'oficial',jsonb_build_object(
    'encerrados',oficial.encerrados,'procedentes',oficial.procedentes,
    'improcedentes',oficial.improcedentes,'parciais',oficial.parciais,
    'divergentes',oficial.divergentes,'sem_merito',oficial.sem_merito,
    'acordos',oficial.acordos,'indeferimentos',oficial.indeferimentos,
    'cancelamentos',oficial.cancelamentos,'desistencias',oficial.desistencias,
    'abandonos',oficial.abandonos,'nao_determinados',oficial.nao_determinados,
    'nao_localizados',oficial.nao_localizados,
    'encerrados_cumprimento',oficial.encerrados_cumprimento
  ),
  'consultadoEm',now()
)
FROM base CROSS JOIN oficial CROSS JOIN exec_counts;
$function$;

CREATE OR REPLACE FUNCTION public.lexis_portfolio_snapshot(
  p_empresa uuid,p_owner uuid DEFAULT NULL::uuid
)
RETURNS TABLE(total bigint,ativos bigint,encerrados bigint,vencidos bigint,baixas bigint,procedentes bigint,cumprimentos bigint,novidades bigint)
LANGUAGE sql STABLE SET search_path TO 'public','pg_temp'
AS $function$
WITH owner_ids AS (
  SELECT id owner_id FROM public.usuarios
  WHERE empresa_id=p_empresa AND (id=p_owner OR auth_user_id=p_owner)
  UNION
  SELECT auth_user_id owner_id FROM public.usuarios
  WHERE empresa_id=p_empresa AND (id=p_owner OR auth_user_id=p_owner)
),
scoped AS (
  SELECT p.id,p.status,p.proximo_retorno,p.ultimo_retorno,
    p.datajud_encerrado_tribunal,p.tem_atualizacao_pos_retorno,p.djen_nova_comunicacao,
    p.em_cumprimento_sentenca,p.cumprimento_pendente_necessario,p.dados,p.status_executivo,p.detalhes_execucao,
    coalesce(i.categoria,'sem_indicador') AS merit_category,
    (
      upper(coalesce(p.dados->>'situacao','')) ~ '(ENCERRAD|ARQUIVAD|EXTINT)'
      OR upper(coalesce(p.status_interno,'')) ~ '(ENCERRAD|ARQUIVAD|EXTINT)'
      OR upper(coalesce(p.status,'')) ~ '(ENCERRAD|ARQUIVAD|EXTINT)'
    ) AS closed_crm,
    upper(coalesce(p.dados->>'statusManual','')) ~ '(ENCERRAD|ARQUIVAD|EXTINT|BAIXA DEFINITIVA|FINALIZAD)' AS closed_manual,
    (
      lower(coalesce(p.dados->>'status_executivo',''))='ativo'
      OR lower(coalesce(p.status_executivo,''))='ativo'
      OR lower(coalesce(p.detalhes_execucao->>'status_executivo',''))='ativo'
      OR lower(coalesce(p.dados->>'cumprimento_ativo','false'))='true'
      OR lower(coalesce(p.detalhes_execucao->>'cumprimento_ativo','false'))='true'
    ) AS exec_active,
    (
      lower(coalesce(p.dados->>'status_executivo','')) ~ '(encerrad|extint|arquiv|baixad)'
      OR lower(coalesce(p.status_executivo,'')) ~ '(encerrad|extint|arquiv|baixad)'
      OR lower(coalesce(p.detalhes_execucao->>'status_executivo','')) ~ '(encerrad|extint|arquiv|baixad)'
      OR lower(coalesce(p.dados->>'cumprimento_encerrado','false'))='true'
      OR lower(coalesce(p.detalhes_execucao->>'cumprimento_encerrado','false'))='true'
    ) AS exec_closed
  FROM public.processos p
  LEFT JOIN public.lexis_merito_indice i ON i.processo_id=p.id AND i.empresa_id=p.empresa_id
  WHERE p.empresa_id=p_empresa
    AND (p_owner IS NULL OR p.created_by=p_owner OR p.created_by IN (SELECT owner_id FROM owner_ids))
)
SELECT count(*)::bigint,
  count(*) FILTER(WHERE NOT closed_crm)::bigint,
  count(*) FILTER(WHERE closed_crm)::bigint,
  count(*) FILTER(WHERE NOT closed_crm AND NOT closed_manual
    AND proximo_retorno < (now() AT TIME ZONE 'America/Sao_Paulo')::date
    AND (ultimo_retorno IS NULL OR ultimo_retorno < proximo_retorno))::bigint,
  count(*) FILTER(WHERE datajud_encerrado_tribunal IS TRUE)::bigint,
  count(*) FILTER(WHERE merit_category='procedente')::bigint,
  count(*) FILTER(WHERE em_cumprimento_sentenca IS TRUE AND exec_active AND NOT exec_closed)::bigint,
  count(*) FILTER(WHERE tem_atualizacao_pos_retorno IS TRUE OR djen_nova_comunicacao IS TRUE)::bigint
FROM scoped;
$function$;
