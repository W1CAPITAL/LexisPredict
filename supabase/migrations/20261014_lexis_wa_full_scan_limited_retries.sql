
-- Retentativas limitadas quando tribunal ficou indisponível ou respondeu parcialmente.
-- A fila inicial sempre tem prioridade e nenhuma verificação falha vira "sem movimento".
CREATE OR REPLACE FUNCTION public.wa_portfolio_scan_claim(p_empresa uuid)
RETURNS TABLE (queue_id bigint, process_id bigint, company_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
BEGIN
 IF NOT EXISTS(
  SELECT 1 FROM public.wa_daily_return_settings s
  WHERE s.empresa_id=p_empresa AND s.enabled=true AND s.consent_attested=true
 ) THEN RETURN; END IF;
 RETURN QUERY
 WITH next_row AS (
   SELECT q.id FROM public.wa_portfolio_scan_queue q
   WHERE q.empresa_id=p_empresa
     AND q.attempts<3
     AND (
       q.status='pending'
       OR (q.status='processing' AND q.claimed_at < now()-interval '8 minutes')
       OR (q.status IN ('partial','unavailable','failed')
           AND q.finished_at < now()-interval '6 hours')
     )
   ORDER BY CASE WHEN q.status='pending' THEN 0 ELSE 1 END,q.attempts,q.id
   FOR UPDATE SKIP LOCKED LIMIT 1
 )
 UPDATE public.wa_portfolio_scan_queue q
 SET status='processing',attempts=q.attempts+1,claimed_at=now(),last_error=NULL
 FROM next_row
 WHERE q.id=next_row.id
 RETURNING q.id,q.processo_id,q.empresa_id;
END
$function$;
REVOKE ALL ON FUNCTION public.wa_portfolio_scan_claim(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.wa_portfolio_scan_claim(uuid) TO service_role;
