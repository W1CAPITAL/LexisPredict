-- Scanner incremental de serviços MNI publicados (TJPR/SCMPP e TJPE/PJe).
-- Guarda evidência com origem, fecha RLS e nunca armazena dados das partes/documentos.
CREATE TABLE IF NOT EXISTS public.hermes_tribunal_public_movements (
 empresa_id uuid NOT NULL,
 processo_id bigint NOT NULL REFERENCES public.processos(id) ON DELETE CASCADE,
 cnj text NOT NULL,
 adapter text NOT NULL,
 status text NOT NULL DEFAULT 'pending',
 checked_at timestamptz,
 next_allowed_at timestamptz NOT NULL DEFAULT now(),
 movements jsonb NOT NULL DEFAULT '[]'::jsonb,
 movements_verified_at timestamptz,
 http_status integer,
 source_url text,
 note text,
 PRIMARY KEY(empresa_id,processo_id),
 CONSTRAINT hermes_tribunal_adapter_check CHECK(adapter IN ('tjpr-scmpp','tjpe-mni')),
 CONSTRAINT hermes_tribunal_status_check CHECK(status IN
 ('pending','checking','verified','verified_empty','restricted','rate_limited',
  'timeout','unavailable','unexpected_response','cnj_mismatch')),
 CONSTRAINT hermes_tribunal_movements_array_check CHECK(jsonb_typeof(movements)='array')
);
CREATE INDEX IF NOT EXISTS idx_hermes_tribunal_next
 ON public.hermes_tribunal_public_movements(next_allowed_at,status);
ALTER TABLE public.hermes_tribunal_public_movements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.hermes_tribunal_public_movements FROM anon,authenticated;
GRANT ALL ON public.hermes_tribunal_public_movements TO service_role;
COMMENT ON TABLE public.hermes_tribunal_public_movements IS
 'Somente movimentos públicos com CNJ comprovado via MNI; status não confirmados preservam evidência anteriormente verificada. Exclusivo backend service_role.';

-- Concorrência: seleciona um processo elegível, reserva horário antes do HTTP.
-- Não usa rotas de cliente e não faz varredura maciça; no máximo 1 por rodada.
CREATE OR REPLACE FUNCTION public.hermes_claim_tribunal_connector()
RETURNS TABLE(empresa_id uuid,processo_id bigint,cnj text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
BEGIN
 RETURN QUERY
 WITH candidato AS (
  SELECT p.empresa_id AS e,p.id AS pid,
   regexp_replace(coalesce(p.protocolo_ref,''),'\D','','g') AS n,
   CASE
    WHEN substring(regexp_replace(coalesce(p.protocolo_ref,''),'\D','','g') from 14 for 3)='816' THEN 'tjpr-scmpp'
    ELSE 'tjpe-mni'
   END AS adapter
  FROM public.processos p
  LEFT JOIN public.hermes_tribunal_public_movements t
   ON t.empresa_id=p.empresa_id AND t.processo_id=p.id
  WHERE length(regexp_replace(coalesce(p.protocolo_ref,''),'\D','','g'))=20
   AND substring(regexp_replace(coalesce(p.protocolo_ref,''),'\D','','g') from 14 for 3) IN ('816','817')
   AND coalesce(p.status_interno,'') !~* '(ENCERRAD|ARQUIVAD|FINALIZAD)'
   AND (t.next_allowed_at IS NULL OR t.next_allowed_at<=now())
  ORDER BY t.next_allowed_at NULLS FIRST,p.id
  LIMIT 1
  FOR UPDATE OF p SKIP LOCKED
 ), reservado AS (
  INSERT INTO public.hermes_tribunal_public_movements
   (empresa_id,processo_id,cnj,adapter,status,checked_at,next_allowed_at)
  SELECT e,pid,n,adapter,'checking',now(),now()+interval '20 minutes' FROM candidato
  ON CONFLICT(empresa_id,processo_id) DO UPDATE SET
   cnj=excluded.cnj,adapter=excluded.adapter,status='checking',
   checked_at=now(),next_allowed_at=excluded.next_allowed_at
  RETURNING hermes_tribunal_public_movements.empresa_id,
   hermes_tribunal_public_movements.processo_id,
   hermes_tribunal_public_movements.cnj
 )
 SELECT reservado.empresa_id,reservado.processo_id,reservado.cnj FROM reservado;
END;
$$;
REVOKE ALL ON FUNCTION public.hermes_claim_tribunal_connector() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.hermes_claim_tribunal_connector() TO service_role;

-- Cron Supabase: mesmo endpoint serverless do Hermes, plano Hobby, 1 caso a cada 15 min.
SELECT cron.schedule(
 'lexis-hermes-tribunal-connectors',
 '*/15 * * * *',
 $cron$
 SELECT net.http_get(
  url := 'https://lexispredict.vercel.app/api/cron/hermes-returns?hermesRoute=court-connectors',
  headers := jsonb_build_object('Authorization','Bearer ' ||
    (SELECT decrypted_secret FROM vault.decrypted_secrets
     WHERE name='lexis_wa_daily_cron_token' LIMIT 1)),
  timeout_milliseconds := 45000
 );
 $cron$
);
