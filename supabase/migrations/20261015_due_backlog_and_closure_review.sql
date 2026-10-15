-- Private backlog of phone-less cases with ambiguous terminal evidence.
CREATE TABLE IF NOT EXISTS public.wa_closure_review_queue (
  empresa_id uuid NOT NULL,
  processo_id bigint NOT NULL REFERENCES public.processos(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'needs_official_confirmation'
    CHECK (status IN ('needs_official_confirmation','confirmed','not_closed','manual_review')),
  review_priority text NOT NULL DEFAULT 'standard'
    CHECK (review_priority IN ('old_over_365_days','old_over_180_days','standard')),
  last_court_event_at timestamptz,
  court_flag_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  checked_at timestamptz,
  PRIMARY KEY(empresa_id,processo_id)
);
ALTER TABLE public.wa_closure_review_queue ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.wa_closure_review_queue FROM anon,authenticated,PUBLIC;
GRANT ALL ON public.wa_closure_review_queue TO service_role;

INSERT INTO public.wa_closure_review_queue(empresa_id,processo_id,review_priority,last_court_event_at,court_flag_reason)
SELECT p.empresa_id,p.id,
 CASE WHEN p.datajud_ultimo_movimento<now()-interval '365 days' THEN 'old_over_365_days'
      WHEN p.datajud_ultimo_movimento<now()-interval '180 days' THEN 'old_over_180_days'
      ELSE 'standard' END,
 p.datajud_ultimo_movimento,left(p.datajud_encerrado_motivo,500)
FROM public.processos p
WHERE p.empresa_id='d37fd4bb-1c71-4dca-b97e-292355918d39'
 AND p.proximo_retorno<=(now() at time zone 'America/Sao_Paulo')::date
 AND length(regexp_replace(coalesce(p.telefone,''),'[^0-9]','','g')) NOT IN(10,11,12,13)
 AND p.datajud_encerrado_tribunal=true
 AND p.status IS DISTINCT FROM 'Encerrado'
 AND coalesce(p.status_interno,'')<>'ENCERRADO'
ON CONFLICT (empresa_id,processo_id) DO UPDATE
 SET review_priority=excluded.review_priority,last_court_event_at=excluded.last_court_event_at,
     court_flag_reason=excluded.court_flag_reason;

-- Closed cases remain in process history but cannot be re-contacted as overdue.
UPDATE public.wa_portfolio_scan_queue q
SET outreach_status='ineligible',last_error='process_closed_not_for_outreach'
FROM public.processos p
WHERE p.id=q.processo_id AND p.empresa_id=q.empresa_id
 AND q.empresa_id='d37fd4bb-1c71-4dca-b97e-292355918d39'
 AND (p.status='Encerrado' OR p.status_interno='ENCERRADO')
 AND q.outreach_status='pending';

-- Server-only summary: "waiting for WhatsApp" is preparation, not device delivery.
CREATE OR REPLACE FUNCTION public.wa_overdue_queue_summary(p_empresa uuid,p_day date)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $fn$
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
     WHERE r.empresa_id=p_empresa AND r.status='needs_official_confirmation'
   ),
   'oldClosureReview',(
     SELECT count(*) FROM public.wa_closure_review_queue r
     WHERE r.empresa_id=p_empresa AND r.status='needs_official_confirmation'
       AND r.review_priority='old_over_365_days'
   )
 ) FROM filtered;
$fn$;
REVOKE ALL ON FUNCTION public.wa_overdue_queue_summary(uuid,date) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.wa_overdue_queue_summary(uuid,date) TO service_role;
