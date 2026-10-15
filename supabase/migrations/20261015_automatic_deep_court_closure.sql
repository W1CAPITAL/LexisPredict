-- Auto-investigação de encerramento: não depender de revisão manual.
ALTER TABLE public.wa_closure_review_queue
  ADD COLUMN IF NOT EXISTS decision_state text NOT NULL DEFAULT 'investigating'
    CHECK (decision_state IN ('investigating','deep_scan_running','confirmed_closed','active_enforcement','not_confirmed','source_unavailable')),
  ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz,
  ADD COLUMN IF NOT EXISTS next_check_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS last_deep_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS decision_reason text,
  ADD COLUMN IF NOT EXISTS evidence jsonb NOT NULL DEFAULT '{}'::jsonb;
CREATE INDEX IF NOT EXISTS wa_closure_auto_due_idx
 ON public.wa_closure_review_queue(empresa_id,next_check_at,decision_state);

-- Todas as indicações de encerramento contraditórias na carteira, não somente sem telefone.
INSERT INTO public.wa_closure_review_queue
 (empresa_id,processo_id,status,review_priority,last_court_event_at,court_flag_reason)
SELECT p.empresa_id,p.id,'needs_official_confirmation',
 CASE WHEN p.datajud_ultimo_movimento<now()-interval '365 days' THEN 'old_over_365_days'
      WHEN p.datajud_ultimo_movimento<now()-interval '180 days' THEN 'old_over_180_days' ELSE 'standard' END,
 p.datajud_ultimo_movimento,left(p.datajud_encerrado_motivo,500)
FROM public.processos p
WHERE p.empresa_id='d37fd4bb-1c71-4dca-b97e-292355918d39'
 AND p.datajud_encerrado_tribunal=true
 AND p.status IS DISTINCT FROM 'Encerrado'
 AND p.status_interno IS DISTINCT FROM 'ENCERRADO'
ON CONFLICT(empresa_id,processo_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.wa_claim_deep_closure(p_empresa uuid)
RETURNS TABLE(processo_id bigint, empresa_id uuid, attempt integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
BEGIN
 RETURN QUERY WITH candidate AS (
  SELECT q.processo_id FROM public.wa_closure_review_queue q
  WHERE q.empresa_id=p_empresa AND q.next_check_at<=now()
  AND (q.decision_state<>'deep_scan_running'
    OR q.claimed_at<now()-interval '5 minutes')
  ORDER BY CASE q.review_priority WHEN 'old_over_365_days' THEN 0
                  WHEN 'old_over_180_days' THEN 1 ELSE 2 END,
           q.next_check_at,q.processo_id
  FOR UPDATE SKIP LOCKED LIMIT 1
 )
 UPDATE public.wa_closure_review_queue q
 SET decision_state='deep_scan_running',claimed_at=now(),
     attempts=q.attempts+1
 FROM candidate c
 WHERE q.empresa_id=p_empresa AND q.processo_id=c.processo_id
 RETURNING q.processo_id,q.empresa_id,q.attempts;
END
$fn$;
REVOKE ALL ON FUNCTION public.wa_claim_deep_closure(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.wa_claim_deep_closure(uuid) TO service_role;
