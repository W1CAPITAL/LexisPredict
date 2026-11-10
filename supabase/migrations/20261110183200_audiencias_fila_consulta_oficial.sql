-- Diferencia a consulta de tribunal realizada com sucesso da tentativa e da reindexação de documento antigo.
ALTER TABLE public.audiencias_monitoradas
  ADD COLUMN IF NOT EXISTS ultima_tentativa_em timestamptz,
  ADD COLUMN IF NOT EXISTS ultima_consulta_oficial_em timestamptz;
CREATE INDEX IF NOT EXISTS idx_audiencias_auto_fila
  ON public.audiencias_monitoradas(ultima_tentativa_em ASC NULLS FIRST)
  WHERE situacao <> 'cancelada';
