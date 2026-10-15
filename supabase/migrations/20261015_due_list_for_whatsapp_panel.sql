-- Authenticated-manager UI reads these through a service-role server action.
CREATE OR REPLACE FUNCTION public.wa_overdue_queue_items(p_empresa uuid,p_day date)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $fn$
 SELECT jsonb_build_object(
 'ready', coalesce((SELECT jsonb_agg(to_jsonb(item)) FROM (
   SELECT p.id,p.protocolo_ref AS cnj,p.cliente,p.proximo_retorno,q.finished_at AS verified_at
   FROM public.wa_portfolio_scan_queue q
   JOIN public.processos p ON p.id=q.processo_id AND p.empresa_id=q.empresa_id
   WHERE q.empresa_id=p_empresa AND p.proximo_retorno<=p_day
     AND p.status IS DISTINCT FROM 'Encerrado'
     AND coalesce(p.status_interno,'')<>'ENCERRADO'
     AND q.outreach_status='pending' AND q.status IN ('verified','partial')
     AND (q.datajud_ok OR q.djen_ok)
     AND q.finished_at>now()-interval '24 hours'
     AND q.finished_at<=now()+interval '1 minute'
     AND q.contact_phone~'^55[0-9]{10,11}$'
     AND q.contact_phone=(CASE WHEN length(regexp_replace(coalesce(p.telefone,''),'[^0-9]','','g')) in(10,11)
       THEN '55'||regexp_replace(coalesce(p.telefone,''),'[^0-9]','','g')
       ELSE regexp_replace(coalesce(p.telefone,''),'[^0-9]','','g') END)
   ORDER BY p.proximo_retorno,p.id LIMIT 15
 ) item),'[]'::jsonb),
 'closureReview', coalesce((SELECT jsonb_agg(to_jsonb(item)) FROM(
   SELECT p.id,p.protocolo_ref AS cnj,r.review_priority,r.court_flag_reason,
     r.last_court_event_at::date AS last_court_event
   FROM public.wa_closure_review_queue r
   JOIN public.processos p ON p.id=r.processo_id AND p.empresa_id=r.empresa_id
   WHERE r.empresa_id=p_empresa AND r.status IN ('needs_official_confirmation','manual_review')
   ORDER BY case r.review_priority when 'old_over_365_days' then 0 when 'old_over_180_days' then 1 else 2 end,p.id LIMIT 12
 )item),'[]'::jsonb)
 );
$fn$;
REVOKE ALL ON FUNCTION public.wa_overdue_queue_items(uuid,date) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.wa_overdue_queue_items(uuid,date) TO service_role;
-- Selector should not return already-closed cases even before its JS filter.
CREATE OR REPLACE FUNCTION public.wa_next_checked_overdue(p_empresa uuid,p_day date,p_limit integer DEFAULT 20)
RETURNS TABLE(queue_id bigint,process_id bigint,phone text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $function$
 SELECT q.id,q.processo_id,q.contact_phone
 FROM public.wa_portfolio_scan_queue q
 JOIN public.processos p ON p.id=q.processo_id AND p.empresa_id=q.empresa_id
 JOIN public.wa_daily_return_settings cfg ON cfg.empresa_id=q.empresa_id
 WHERE q.empresa_id=p_empresa
   AND cfg.enabled AND cfg.consent_attested
   AND q.outreach_status='pending'
   AND q.status IN ('verified','partial')
   AND (q.datajud_ok OR q.djen_ok)
   AND q.finished_at > now()-interval '24 hours'
   AND q.finished_at <= now()+interval '1 minute'
   AND q.contact_phone~'^55[0-9]{10,11}$'
   AND p.proximo_retorno <= p_day
   AND p.status IS DISTINCT FROM 'Encerrado'
   AND coalesce(p.status_interno,'')<>'ENCERRADO'
 ORDER BY p.proximo_retorno ASC,q.id
 LIMIT least(40,greatest(1,p_limit));
$function$;
REVOKE ALL ON FUNCTION public.wa_next_checked_overdue(uuid,date,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.wa_next_checked_overdue(uuid,date,integer) TO service_role;
