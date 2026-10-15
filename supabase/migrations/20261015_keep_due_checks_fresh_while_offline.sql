-- Stale verified overdue notices must be revalidated, not abandoned when
-- the linked WhatsApp is offline longer than the official evidence window.
CREATE OR REPLACE FUNCTION public.wa_portfolio_scan_claim(p_empresa uuid)
RETURNS TABLE(queue_id bigint, process_id bigint, company_id uuid)
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
   AND (
      (q.attempts<3 AND (
       q.status='pending'
       OR (q.status='processing' AND q.claimed_at<now()-interval '8 minutes')
       OR (q.status IN('partial','unavailable','failed')
           AND q.finished_at<now()-interval '6 hours')
      ))
      OR
      (q.status IN ('verified','partial')
        AND q.finished_at<now()-interval '20 hours'
        AND q.outreach_status='pending'
        AND q.contact_phone ~ '^55[0-9]{10,11}$'
        AND EXISTS(
          SELECT 1 FROM public.processos p
          WHERE p.empresa_id=q.empresa_id AND p.id=q.processo_id
            AND p.proximo_retorno <= (now() at time zone 'America/Sao_Paulo')::date
            AND p.status IS DISTINCT FROM 'Encerrado'
            AND coalesce(p.status_interno,'') <> 'ENCERRADO'
        )
      )
   )
  ORDER BY
   CASE WHEN EXISTS(
    SELECT 1 FROM public.wa_closure_review_queue r
    WHERE r.empresa_id=q.empresa_id AND r.processo_id=q.processo_id
      AND r.status='needs_official_confirmation'
   ) THEN 0 ELSE 1 END,
   CASE WHEN q.status='pending' THEN 0
        WHEN q.status IN('verified','partial')
         AND q.finished_at < now()-interval '20 hours' THEN 1
        ELSE 2 END,
   q.attempts,q.id
  FOR UPDATE OF q SKIP LOCKED LIMIT 1
 )
 UPDATE public.wa_portfolio_scan_queue q
 SET status='processing',
     attempts=CASE WHEN q.status IN('verified','partial')
              AND q.finished_at<now()-interval '20 hours'
              THEN 1 ELSE q.attempts+1 END,
     claimed_at=now(),last_error=NULL
 FROM next_row WHERE q.id=next_row.id
 RETURNING q.id,q.processo_id,q.empresa_id;
END
$function$;
REVOKE ALL ON FUNCTION public.wa_portfolio_scan_claim(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.wa_portfolio_scan_claim(uuid) TO service_role;
