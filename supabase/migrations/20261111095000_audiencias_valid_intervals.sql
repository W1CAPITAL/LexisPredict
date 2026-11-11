-- Validação de intervalos judiciais em produção (TJSP/eproc, TRFs, TRTs etc).
-- Nunca considerar prazo de oposição, publicação ou inscrição como fim de uma sessão.
-- Histórico de evidências e demais datas permanecem preservados.
UPDATE public.audiencias_monitoradas
SET data_fim = NULL, hora_fim = NULL, atualizado_em = now()
WHERE data_evento IS NOT NULL AND data_fim IS NOT NULL
  AND data_fim < data_evento;

DO $$
BEGIN
 IF NOT EXISTS (
  SELECT 1 FROM pg_constraint
  WHERE conrelid='public.audiencias_monitoradas'::regclass
    AND conname='audiencias_monitoradas_interval_consistency'
 ) THEN
  ALTER TABLE public.audiencias_monitoradas
  ADD CONSTRAINT audiencias_monitoradas_interval_consistency
    CHECK (data_evento IS NULL OR data_fim IS NULL OR data_fim >= data_evento);
 END IF;
END $$;

-- Corrige apenas a data final impossível nos sinais do Hermes.
-- Não apaga a data do início, o texto, a fonte nem os demais eventos.
WITH fixed AS (
 SELECT s.empresa_id,s.processo_id,
  jsonb_agg(
   CASE
    WHEN h->>'date' ~ '^20[0-9]{2}-[0-9]{2}-[0-9]{2}$'
     AND h->>'endDate' ~ '^20[0-9]{2}-[0-9]{2}-[0-9]{2}$'
     AND h->>'endDate' < h->>'date'
    THEN jsonb_set(h,'{endDate}','null'::jsonb,false)
    ELSE h
   END ORDER BY item_index
  ) as hearings
 FROM public.hermes_portfolio_scans s
 CROSS JOIN LATERAL jsonb_array_elements(coalesce(s.findings->'hearings','[]'::jsonb))
  WITH ORDINALITY as t(h,item_index)
 WHERE jsonb_typeof(coalesce(s.findings->'hearings','[]'::jsonb))='array'
 GROUP BY s.empresa_id,s.processo_id
)
UPDATE public.hermes_portfolio_scans s
SET findings=jsonb_set(s.findings,'{hearings}',fixed.hearings,false)
FROM fixed
WHERE s.empresa_id=fixed.empresa_id AND s.processo_id=fixed.processo_id
 AND s.findings->'hearings' IS DISTINCT FROM fixed.hearings;
