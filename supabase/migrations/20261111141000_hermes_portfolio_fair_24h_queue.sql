-- Keep the 24-hour full-company scan ahead of retries for partial sources.
-- The queue spends spare capacity on retries only after unscanned/daily-due
-- processes, so frequent DataJud cooldowns cannot starve the rest of the company.
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
    CASE
      WHEN r.processo_id IS NULL THEN 0
      WHEN r.state IN ('ready','skipped') AND r.checked_at<now()-interval '24 hours' THEN 1
      WHEN r.state='partial' AND r.checked_at<now()-interval '12 hours' THEN 2
      WHEN r.state='unavailable' AND r.attempted_at<now()-interval '6 hours' THEN 3
      WHEN r.state='scanning' AND r.attempted_at<now()-interval '12 minutes' THEN 4
      ELSE 5
    END,
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

COMMENT ON FUNCTION public.hermes_claim_portfolio_scan_batch(date,integer) IS
'Claims up to two distinct company processes per minute. Daily-due and unscanned processes take priority over partial/unavailable retries.';
