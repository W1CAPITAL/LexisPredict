
-- Verificação integral, persistente e independente da sessão do navegador.
-- Cada empresa possui fila própria. Somente o servidor pode reivindicar itens.
CREATE TABLE IF NOT EXISTS public.wa_portfolio_scan_queue (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  empresa_id uuid NOT NULL,
  processo_id bigint NOT NULL REFERENCES public.processos(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK(status IN ('pending','processing','verified','partial','unavailable','invalid','failed')),
  attempts integer NOT NULL DEFAULT 0,
  datajud_ok boolean NOT NULL DEFAULT false,
  djen_ok boolean NOT NULL DEFAULT false,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  claimed_at timestamptz,
  finished_at timestamptz,
  UNIQUE(empresa_id,processo_id)
);
CREATE INDEX IF NOT EXISTS wa_portfolio_scan_work_idx
 ON public.wa_portfolio_scan_queue(empresa_id,status,attempts,id);
ALTER TABLE public.wa_portfolio_scan_queue ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.wa_portfolio_scan_queue FROM anon,authenticated;
REVOKE ALL ON SEQUENCE public.wa_portfolio_scan_queue_id_seq FROM anon,authenticated;
GRANT ALL ON public.wa_portfolio_scan_queue TO service_role;
GRANT USAGE,SELECT ON SEQUENCE public.wa_portfolio_scan_queue_id_seq TO service_role;

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
   WHERE q.empresa_id=p_empresa AND
     (q.status='pending' OR
       (q.status='processing' AND q.claimed_at<now()-interval '8 minutes' AND q.attempts<3))
     AND q.attempts<3
   ORDER BY q.attempts,q.id
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
