-- Company-wide return KPIs: typed process columns override stale legacy JSON.
-- A return is overdue after its scheduled date when no later contact exists;
-- a contact on the same calendar date does not cancel the scheduled return.
CREATE OR REPLACE FUNCTION public.lexis_portfolio_snapshot(
  p_empresa uuid,
  p_owner uuid DEFAULT NULL::uuid
)
RETURNS TABLE(
  total bigint,
  ativos bigint,
  encerrados bigint,
  vencidos bigint,
  baixas bigint,
  procedentes bigint,
  cumprimentos bigint,
  novidades bigint
)
LANGUAGE sql
STABLE
SET search_path TO 'public','pg_temp'
AS $function$
WITH owner_ids AS (
  SELECT id AS owner_id FROM public.usuarios
  WHERE empresa_id=p_empresa AND (id=p_owner OR auth_user_id=p_owner)
  UNION
  SELECT auth_user_id AS owner_id FROM public.usuarios
  WHERE empresa_id=p_empresa AND (id=p_owner OR auth_user_id=p_owner)
),
scoped AS (
  SELECT
    p.id,
    p.status,
    p.status_interno,
    p.proximo_retorno,
    p.ultimo_retorno,
    p.datajud_encerrado_tribunal,
    p.tem_atualizacao_pos_retorno,
    p.djen_nova_comunicacao,
    p.em_cumprimento_sentenca,
    p.cumprimento_pendente_necessario,
    p.dados,
    p.status_executivo,
    p.detalhes_execucao,
    coalesce(i.categoria,'sem_indicador') AS merit_category,
    CASE
      WHEN upper(coalesce(p.status,'')) ~ '(ENCERRAD|ARQUIVAD|EXTINT|BAIXA[[:space:]]*DEFINITIVA|FINALIZAD)'
        THEN true
      WHEN nullif(trim(coalesce(p.status_interno,'')),'') IS NOT NULL
        THEN upper(trim(p.status_interno)) ~ '(ENCERRAD|ARQUIVAD|EXTINT|BAIXA[[:space:]]*DEFINITIVA|FINALIZAD)'
      WHEN lower(coalesce(p.dados->>'via_scan_auto_encerrar','false'))='true'
        OR p.dados->'operacao_sistema'->>'tipo'='SCAN_AUTO_ENCERRAR'
        THEN true
      ELSE upper(coalesce(
        nullif(p.dados->>'situacao',''),
        nullif(p.dados->>'SITUACAO',''),
        nullif(p.dados->>'status_interno',''),
        nullif(p.dados->>'statusManual',''),
        nullif(p.dados->>'STATUS_MANUAL',''),
        nullif(p.status,''),
        nullif(p.dados->>'status',''),
        'EM ANDAMENTO'
      )) ~ '(ENCERRAD|ARQUIVAD|EXTINT|BAIXA[[:space:]]*DEFINITIVA|FINALIZAD)'
    END AS closed_crm,
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
  LEFT JOIN public.lexis_merito_indice i
    ON i.processo_id=p.id AND i.empresa_id=p.empresa_id
  WHERE p.empresa_id=p_empresa
    AND (p_owner IS NULL OR p.created_by=p_owner OR p.created_by IN (SELECT owner_id FROM owner_ids))
)
SELECT
  count(*)::bigint,
  count(*) FILTER(WHERE NOT closed_crm)::bigint,
  count(*) FILTER(WHERE closed_crm)::bigint,
  count(*) FILTER(
    WHERE NOT closed_crm
      AND proximo_retorno < (now() AT TIME ZONE 'America/Sao_Paulo')::date
      AND (ultimo_retorno IS NULL OR ultimo_retorno <= proximo_retorno)
  )::bigint,
  count(*) FILTER(WHERE datajud_encerrado_tribunal IS TRUE)::bigint,
  count(*) FILTER(WHERE merit_category='procedente')::bigint,
  count(*) FILTER(
    WHERE em_cumprimento_sentenca IS TRUE AND exec_active AND NOT exec_closed
  )::bigint,
  count(*) FILTER(WHERE tem_atualizacao_pos_retorno IS TRUE OR djen_nova_comunicacao IS TRUE)::bigint
FROM scoped;
$function$;

COMMENT ON FUNCTION public.lexis_portfolio_snapshot(uuid,uuid) IS
'Resumo de carteira. Vencidos = retorno administrativo com data passada e sem atendimento posterior; colunas tipadas prevalecem sobre JSON legado.';

-- Claim two independent processes per minute. Row locks on processos prevent
-- duplicate claims when invocations overlap. The full portfolio is revisited
-- within approximately 24 hours (2 x 60 x 24 slots).
CREATE OR REPLACE FUNCTION public.hermes_claim_portfolio_scan_batch(
  p_today date,
  p_limit integer DEFAULT 2
)
RETURNS TABLE(empresa_id uuid,processo_id bigint)
LANGUAGE sql
SET search_path=public
AS $claim$
WITH candidate AS (
  SELECT
    p.id,
    p.empresa_id,
    resolution.closed_crm
  FROM public.processos p
  LEFT JOIN public.hermes_portfolio_scans r
    ON r.empresa_id=p.empresa_id AND r.processo_id=p.id
  CROSS JOIN LATERAL (
    SELECT CASE
      WHEN upper(coalesce(p.status,'')) ~ '(ENCERRAD|ARQUIVAD|EXTINT|BAIXA[[:space:]]*DEFINITIVA|FINALIZAD)'
        THEN true
      WHEN nullif(trim(coalesce(p.status_interno,'')),'') IS NOT NULL
        THEN upper(trim(p.status_interno)) ~ '(ENCERRAD|ARQUIVAD|EXTINT|BAIXA[[:space:]]*DEFINITIVA|FINALIZAD)'
      WHEN lower(coalesce(p.dados->>'via_scan_auto_encerrar','false'))='true'
        OR p.dados->'operacao_sistema'->>'tipo'='SCAN_AUTO_ENCERRAR'
        THEN true
      ELSE upper(coalesce(
        nullif(p.dados->>'situacao',''),
        nullif(p.dados->>'SITUACAO',''),
        nullif(p.dados->>'status_interno',''),
        nullif(p.dados->>'statusManual',''),
        nullif(p.dados->>'STATUS_MANUAL',''),
        nullif(p.status,''),
        nullif(p.dados->>'status',''),
        'EM ANDAMENTO'
      )) ~ '(ENCERRAD|ARQUIVAD|EXTINT|BAIXA[[:space:]]*DEFINITIVA|FINALIZAD)'
    END AS closed_crm
  ) resolution
  WHERE p.empresa_id IS NOT NULL
    AND length(regexp_replace(coalesce(p.protocolo_ref,''),'[^0-9]','','g'))=20
    AND (
      r.processo_id IS NULL
      OR (r.state='scanning' AND r.attempted_at<now()-interval '12 minutes')
      OR (r.state='unavailable' AND r.attempted_at<now()-interval '6 hours')
      OR (r.state='partial' AND r.checked_at<now()-interval '12 hours')
      OR (r.state='ready' AND r.checked_at<now()-interval '24 hours')
      OR (r.state='skipped' AND r.checked_at<now()-interval '24 hours')
    )
  ORDER BY
    resolution.closed_crm ASC,
    CASE WHEN p.proximo_retorno BETWEEN p_today AND p_today+7 THEN 0 ELSE 1 END,
    coalesce(r.checked_at,'1970-01-01'::timestamptz),
    p.id
  LIMIT LEAST(GREATEST(coalesce(p_limit,2),1),2)
  FOR UPDATE OF p SKIP LOCKED
),
claimed AS (
  INSERT INTO public.hermes_portfolio_scans(
    empresa_id,processo_id,state,attempted_at
  )
  SELECT c.empresa_id,c.id,'scanning',now()
  FROM candidate c
  ON CONFLICT (empresa_id,processo_id) DO UPDATE
    SET state='scanning',attempted_at=now()
    WHERE hermes_portfolio_scans.state<>'scanning'
       OR hermes_portfolio_scans.attempted_at<now()-interval '12 minutes'
  RETURNING hermes_portfolio_scans.empresa_id,hermes_portfolio_scans.processo_id
)
SELECT claimed.empresa_id,claimed.processo_id FROM claimed;
$claim$;

CREATE OR REPLACE FUNCTION public.hermes_claim_portfolio_scan(p_today date)
RETURNS TABLE(empresa_id uuid,processo_id bigint)
LANGUAGE sql
SET search_path=public
AS $claim$
  SELECT * FROM public.hermes_claim_portfolio_scan_batch(p_today,1);
$claim$;

REVOKE ALL ON FUNCTION public.hermes_claim_portfolio_scan_batch(date,integer) FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.hermes_claim_portfolio_scan_batch(date,integer) TO service_role;
REVOKE ALL ON FUNCTION public.hermes_claim_portfolio_scan(date) FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.hermes_claim_portfolio_scan(date) TO service_role;

-- Keep the existing authenticated pg_net request and token, but run continuously.
DO $schedule$
DECLARE existing_job bigint;
BEGIN
  SELECT jobid INTO existing_job
  FROM cron.job
  WHERE jobname='lexis-hermes-full-portfolio'
  LIMIT 1;

  IF existing_job IS NULL THEN
    PERFORM cron.schedule(
      'lexis-hermes-full-portfolio',
      '* * * * *',
      $command$
        select net.http_get(
          url := 'https://lexispredict.vercel.app/api/cron/hermes-returns?hermesRoute=portfolio',
          headers := jsonb_build_object('Authorization','Bearer ' ||
            (select decrypted_secret from vault.decrypted_secrets
             where name='lexis_wa_daily_cron_token' limit 1)),
          timeout_milliseconds := 50000
        );
      $command$
    );
  ELSE
    PERFORM cron.alter_job(
      job_id := existing_job,
      schedule := '* * * * *',
      active := true
    );
  END IF;
END;
$schedule$;
