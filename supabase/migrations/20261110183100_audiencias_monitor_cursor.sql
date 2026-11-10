-- Cursor global para monitoramento incremental de evidências oficiais, sem recomeçar do zero a cada cron.
CREATE TABLE IF NOT EXISTS public.audiencias_monitor_cursor(
  id text PRIMARY KEY,
  ultimo_id bigint NOT NULL DEFAULT 0,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.audiencias_monitor_cursor ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.audiencias_monitor_cursor FROM anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.audiencias_monitor_cursor TO service_role;
