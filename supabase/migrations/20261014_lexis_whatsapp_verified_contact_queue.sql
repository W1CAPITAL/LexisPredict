
-- Check-ins are distinct from court movement notices. One neutral, truthful
-- contact update per unique opt-in phone, only AFTER an official scan succeeds.
ALTER TABLE public.wa_portfolio_scan_queue
 ADD COLUMN IF NOT EXISTS contact_phone text,
 ADD COLUMN IF NOT EXISTS outreach_status text NOT NULL DEFAULT 'pending'
   CHECK(outreach_status IN ('pending','no_phone','duplicate','blocked','covered','movement','queued','failed')),
 ADD COLUMN IF NOT EXISTS outreach_job_id uuid;

UPDATE public.wa_portfolio_scan_queue q
 SET contact_phone = CASE
   WHEN length(regexp_replace(coalesce(p.telefone,''),'[^0-9]','','g')) IN (10,11)
   THEN '55'||regexp_replace(coalesce(p.telefone,''),'[^0-9]','','g')
   ELSE regexp_replace(coalesce(p.telefone,''),'[^0-9]','','g')
 END
FROM public.processos p WHERE p.empresa_id=q.empresa_id AND p.id=q.processo_id
 AND q.contact_phone IS NULL;

UPDATE public.wa_portfolio_scan_queue
 SET outreach_status='no_phone'
 WHERE contact_phone IS NULL OR contact_phone !~ '^55[0-9]{10,11}$';

WITH repeated AS (
 SELECT id, row_number() OVER (PARTITION BY empresa_id,contact_phone ORDER BY id) rn
 FROM public.wa_portfolio_scan_queue
 WHERE contact_phone ~ '^55[0-9]{10,11}$'
)
UPDATE public.wa_portfolio_scan_queue q SET outreach_status='duplicate'
FROM repeated r WHERE q.id=r.id AND r.rn>1 AND q.outreach_status='pending';

CREATE INDEX IF NOT EXISTS wa_portfolio_outreach_pending_idx
 ON public.wa_portfolio_scan_queue(empresa_id,outreach_status,status,id);
