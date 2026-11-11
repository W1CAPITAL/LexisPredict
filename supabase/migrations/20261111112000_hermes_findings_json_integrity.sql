-- Complementa a integridade de /audiencias (já aplicada em 20261111105000).
-- Saneia EXCLUSIVAMENTE o campo endDate impossível no JSON do Hermes;
-- texto DJEN, DataJud, audiência inicial e todas as demais evidências são mantidos.
WITH corrected AS (
 SELECT s.empresa_id,s.processo_id,
  jsonb_agg(
   CASE
    WHEN item->>'date' ~ '^20[0-9]{2}-[0-9]{2}-[0-9]{2}$'
     AND item->>'endDate' ~ '^20[0-9]{2}-[0-9]{2}-[0-9]{2}$'
     AND item->>'endDate' < item->>'date'
    THEN jsonb_set(item,'{endDate}','null'::jsonb,false)
    ELSE item
   END ORDER BY pos
  ) AS hearings
 FROM public.hermes_portfolio_scans s
 CROSS JOIN LATERAL jsonb_array_elements(
  CASE WHEN jsonb_typeof(s.findings->'hearings')='array'
       THEN s.findings->'hearings' ELSE '[]'::jsonb END
 ) WITH ORDINALITY AS x(item,pos)
 GROUP BY s.empresa_id,s.processo_id
)
UPDATE public.hermes_portfolio_scans s
SET findings=jsonb_set(s.findings,'{hearings}',corrected.hearings,false)
FROM corrected
WHERE s.empresa_id=corrected.empresa_id
 AND s.processo_id=corrected.processo_id
 AND s.findings->'hearings' IS DISTINCT FROM corrected.hearings;
