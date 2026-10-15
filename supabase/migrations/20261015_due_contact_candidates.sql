-- Dedicated overdue follow-up candidate selector. Read-only and tenant-scoped.
-- Only a recent successful official verification qualifies; no stale/failed scans.
ALTER TABLE public.wa_portfolio_scan_queue DROP CONSTRAINT IF EXISTS wa_portfolio_scan_queue_outreach_status_check;
ALTER TABLE public.wa_portfolio_scan_queue ADD CONSTRAINT wa_portfolio_scan_queue_outreach_status_check
CHECK(outreach_status IN ('pending','no_phone','duplicate','blocked','covered','movement','queued','failed','ineligible'));
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
 ORDER BY p.proximo_retorno ASC,q.id
 LIMIT least(40,greatest(1,p_limit));
$function$;
REVOKE ALL ON FUNCTION public.wa_next_checked_overdue(uuid,date,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.wa_next_checked_overdue(uuid,date,integer) TO service_role;
