-- Persist the status of the authorized TJPR PROJUDI MNI source independently
-- from DataJud and DJEN. A tribunal API movement is not mislabeled as DataJud.
ALTER TABLE public.hermes_portfolio_scans
  ADD COLUMN IF NOT EXISTS tribunal_api_ok boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tribunal_api_source text,
  ADD COLUMN IF NOT EXISTS tribunal_api_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_court_movement_at date;

COMMENT ON COLUMN public.hermes_portfolio_scans.tribunal_api_ok IS
  'Confirmação independente de uma API oficial do tribunal, como TJPR PROJUDI MNI; não equivale a DataJud.';
COMMENT ON COLUMN public.hermes_portfolio_scans.tribunal_api_source IS
  'Identificador da fonte oficial do tribunal consultada pelo Hermes.';
COMMENT ON COLUMN public.hermes_portfolio_scans.tribunal_api_checked_at IS
  'Data da tentativa automática à API oficial do tribunal; NULL quando não foi acionada.';
COMMENT ON COLUMN public.hermes_portfolio_scans.last_court_movement_at IS
  'Movimento processual mais recente confirmado por DataJud ou API oficial do tribunal.';
