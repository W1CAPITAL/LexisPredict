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
    (coalesce(status,'')='Encerrado' OR coalesce(status_interno,'')='ENCERRADO') is_closed,
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
