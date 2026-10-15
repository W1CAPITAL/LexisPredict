CREATE OR REPLACE FUNCTION public.wa_overdue_queue_summary(p_empresa uuid, p_day date)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 WITH x AS (
  SELECT p.id,p.status,p.status_interno,p.proximo_retorno,p.datajud_encerrado_tribunal,
   p.telefone,q.status scan_status,q.outreach_status,q.contact_phone,q.finished_at,q.datajud_ok,q.djen_ok,
   CASE WHEN length(regexp_replace(coalesce(p.telefone,''),'[^0-9]','','g')) IN (10,11)
        THEN '55'||regexp_replace(p.telefone,'[^0-9]','','g')
        ELSE regexp_replace(coalesce(p.telefone,''),'[^0-9]','','g') END phone
  FROM public.processos p
  LEFT JOIN public.wa_portfolio_scan_queue q ON q.empresa_id=p.empresa_id AND q.processo_id=p.id
  WHERE p.empresa_id=p_empresa AND p.proximo_retorno<=p_day
 ), filtered AS (
  SELECT *,
    (status='Encerrado' OR status_interno='ENCERRADO') is_closed,
    phone ~ '^55[0-9]{10,11}$' phone_ok,
    (scan_status IN ('partial','verified') AND (datajud_ok OR djen_ok)
      AND finished_at>now()-interval '24 hours' AND finished_at<=now()+interval '1 minute') proof_fresh
  FROM x
 )
 SELECT jsonb_build_object(
   'dueTotal',count(*),
   'missingPhone',count(*) FILTER(WHERE NOT phone_ok),
   'alreadyClosed',count(*) FILTER(WHERE is_closed),
   'awaitingWhatsApp',count(*) FILTER(
     WHERE phone_ok AND NOT is_closed AND proof_fresh AND outreach_status='pending'
       AND contact_phone=phone
   ),
   'needsSourceCheck',count(*) FILTER(
     WHERE phone_ok AND NOT is_closed AND NOT proof_fresh
   ),
   'closureReview',(
     SELECT count(*) FROM public.wa_closure_review_queue r
     WHERE r.empresa_id=p_empresa AND r.status IN ('needs_official_confirmation','manual_review')
   ),
   'oldClosureReview',(
     SELECT count(*) FROM public.wa_closure_review_queue r
     WHERE r.empresa_id=p_empresa AND r.status IN ('needs_official_confirmation','manual_review')
       AND r.review_priority='old_over_365_days'
   )
 ) FROM filtered;
$function$;
-- Both court sources were freshly consulted; none of these eight has a
-- fresh, unambiguous last movement of "baixa definitiva" / "arquivamento
-- definitivo" qualifying automatic case closure. Keep for manual review.
UPDATE public.wa_closure_review_queue r
SET status='manual_review',checked_at=now()
FROM public.processos p
WHERE r.empresa_id=p.empresa_id AND r.processo_id=p.id
  AND r.empresa_id='d37fd4bb-1c71-4dca-b97e-292355918d39'
  AND r.status='needs_official_confirmation'
  AND p.datajud_last_ok=true AND p.djen_last_ok=true
  AND p.datajud_consultado_em>now()-interval '1 day'
  AND p.djen_consultado_em>now()-interval '1 day'
  AND NOT (p.datajud_ultimo_nome ~* '^(baixa definitiva|arquivamento definitivo|processo baixado)$'
           AND p.datajud_ultimo_movimento<now()-interval '365 days'
           AND p.em_cumprimento_sentenca IS DISTINCT FROM true
           AND p.cumprimento_pendente_necessario IS DISTINCT FROM true);
