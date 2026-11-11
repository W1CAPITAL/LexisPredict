-- Hermes: cronologia de fontes oficiais para toda a carteira, sem depender de
-- retorno, status administrativo ou quinze dias sem movimento.
-- Conteúdo jurídico só é visível por endpoints internos autenticados por empresa.
CREATE TABLE IF NOT EXISTS public.hermes_portfolio_scans(
 empresa_id uuid NOT NULL,
 processo_id bigint NOT NULL REFERENCES public.processos(id) ON DELETE CASCADE,
 state text NOT NULL DEFAULT 'scanning'
  CHECK (state in ('scanning','ready','partial','unavailable','skipped')),
 attempted_at timestamptz NOT NULL DEFAULT now(),
 checked_at timestamptz,
 datajud_ok boolean NOT NULL DEFAULT false,
 djen_ok boolean NOT NULL DEFAULT false,
 last_datajud_movement_at date,
 last_djen_publication_at date,
 source_errors jsonb NOT NULL DEFAULT '{}'::jsonb,
 events jsonb NOT NULL DEFAULT '[]'::jsonb,
 findings jsonb NOT NULL DEFAULT '{}'::jsonb,
 PRIMARY KEY(empresa_id,processo_id)
);
CREATE INDEX IF NOT EXISTS hermes_portfolio_scans_order_idx
 ON public.hermes_portfolio_scans(empresa_id,checked_at DESC);
ALTER TABLE public.hermes_portfolio_scans ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.hermes_portfolio_scans FROM public,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.hermes_portfolio_scans TO service_role;

-- Claim atômico com trava em (empresa,processo) e janela específica para cada estado.
-- Inclui processos ativos e encerrados (histórico), priorizando os ativos.
CREATE OR REPLACE FUNCTION public.hermes_claim_portfolio_scan(p_today date)
RETURNS TABLE(empresa_id uuid,processo_id bigint)
LANGUAGE sql SET search_path=public AS $claim$
WITH candidate AS (
 SELECT p.id,p.empresa_id
 FROM public.processos p
 LEFT JOIN public.hermes_portfolio_scans r
   ON r.empresa_id=p.empresa_id AND r.processo_id=p.id
 WHERE p.empresa_id IS NOT NULL
  AND length(regexp_replace(coalesce(p.protocolo_ref,''),'[^0-9]','','g'))=20
  AND (
   r.processo_id IS NULL
   OR (r.state='scanning' AND r.attempted_at<now()-interval '12 minutes')
   OR (r.state='unavailable' AND r.attempted_at<now()-interval '3 hours')
   OR (r.state='partial' AND r.checked_at<now()-interval '18 hours')
   OR (r.state='ready' AND r.checked_at<now()-interval '72 hours'
       AND upper(concat_ws(' ',p.status,p.status_interno,p.dados->>'situacao'))
           !~ '(ENCERRAD|FINALIZAD|ARQUIVAD|EXTINT|BAIXA DEFINITIVA)')
   OR (r.state in ('ready','skipped') AND r.checked_at<now()-interval '30 days'
       AND upper(concat_ws(' ',p.status,p.status_interno,p.dados->>'situacao'))
           ~ '(ENCERRAD|FINALIZAD|ARQUIVAD|EXTINT|BAIXA DEFINITIVA)')
  )
 ORDER BY
  CASE WHEN upper(concat_ws(' ',p.status,p.status_interno,p.dados->>'situacao'))
             ~ '(ENCERRAD|FINALIZAD|ARQUIVAD|EXTINT|BAIXA DEFINITIVA)' THEN 1 ELSE 0 END,
  CASE WHEN p.proximo_retorno BETWEEN p_today AND p_today+7 THEN 0 ELSE 1 END,
  coalesce(r.checked_at,'1970-01-01'::timestamptz),p.id
 LIMIT 1
), claimed AS (
 INSERT INTO public.hermes_portfolio_scans(empresa_id,processo_id,state,attempted_at)
 SELECT c.empresa_id,c.id,'scanning',now() FROM candidate c
 ON CONFLICT (empresa_id,processo_id) DO UPDATE
 SET state='scanning',attempted_at=now()
 WHERE
   (hermes_portfolio_scans.state='scanning' AND hermes_portfolio_scans.attempted_at<now()-interval '12 minutes')
   OR (hermes_portfolio_scans.state='unavailable' AND hermes_portfolio_scans.attempted_at<now()-interval '3 hours')
   OR (hermes_portfolio_scans.state='partial' AND hermes_portfolio_scans.checked_at<now()-interval '18 hours')
   OR (hermes_portfolio_scans.state='ready' AND hermes_portfolio_scans.checked_at<now()-interval '72 hours')
   OR (hermes_portfolio_scans.state='skipped' AND hermes_portfolio_scans.checked_at<now()-interval '30 days')
 RETURNING hermes_portfolio_scans.empresa_id,hermes_portfolio_scans.processo_id
)
SELECT claimed.empresa_id,claimed.processo_id FROM claimed;
$claim$;
REVOKE ALL ON FUNCTION public.hermes_claim_portfolio_scan(date) FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.hermes_claim_portfolio_scan(date) TO service_role;
