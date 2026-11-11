-- Circuit breaker por fonte: nenhum processo de uma mesma instância
-- é consultado enquanto o tribunal reportar 429, 500, timeout ou rejeição.
-- Não atualiza provas, dados de clientes ou retornos.
CREATE INDEX IF NOT EXISTS idx_hermes_tribunal_adapter_failure
 ON public.hermes_tribunal_public_movements(adapter,status,checked_at DESC);

CREATE OR REPLACE FUNCTION public.hermes_claim_tribunal_connector()
RETURNS TABLE(empresa_id uuid,processo_id bigint,cnj text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
#variable_conflict use_column
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
   -- Fallback global: HTTP 500 e bloqueios de um processo interrompem
   -- TODA a fonte, impedindo bombardear outros CNJs do mesmo tribunal.
   AND NOT EXISTS (
    SELECT 1 FROM public.hermes_tribunal_public_movements busy
    WHERE busy.adapter=CASE
      WHEN substring(regexp_replace(coalesce(p.protocolo_ref,''),'\D','','g') from 14 for 3)='816'
       THEN 'tjpr-scmpp' ELSE 'tjpe-mni' END
     AND (
      (busy.status='rate_limited' AND busy.checked_at>now()-interval '4 hours')
      OR (busy.status='unavailable' AND busy.checked_at>now()-interval '4 hours')
      OR (busy.status='timeout' AND busy.checked_at>now()-interval '3 hours')
      OR (busy.status='restricted' AND busy.checked_at>now()-interval '24 hours')
      OR (busy.status='unexpected_response' AND busy.checked_at>now()-interval '24 hours')
      OR (busy.status='cnj_mismatch' AND busy.checked_at>now()-interval '24 hours')
     )
   )
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

