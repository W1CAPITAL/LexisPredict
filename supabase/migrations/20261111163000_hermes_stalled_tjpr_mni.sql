-- Keep TJPR MNI status separate in the independent stalled-process monitor.
ALTER TABLE public.hermes_stalled_reviews
  ADD COLUMN IF NOT EXISTS tribunal_api_ok boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tribunal_api_source text,
  ADD COLUMN IF NOT EXISTS tribunal_api_checked_at timestamptz;

COMMENT ON COLUMN public.hermes_stalled_reviews.tribunal_api_ok IS
  'Confirmação independente de API oficial do tribunal, como TJPR PROJUDI MNI.';
COMMENT ON COLUMN public.hermes_stalled_reviews.tribunal_api_source IS
  'Nome da fonte oficial do tribunal acionada pelo Hermes.';
COMMENT ON COLUMN public.hermes_stalled_reviews.tribunal_api_checked_at IS
  'Horário da tentativa automática da API oficial do tribunal.';
