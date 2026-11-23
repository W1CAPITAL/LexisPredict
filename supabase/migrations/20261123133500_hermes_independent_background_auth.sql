
-- Operador de consulta judicial 24h, sem alterar dados juridicos ou retornos.
CREATE TABLE IF NOT EXISTS public.hermes_background_control (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id=1),
  datajud_paused_until timestamptz,
  djen_paused_until timestamptz
);
ALTER TABLE public.hermes_background_control ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.hermes_background_control FROM public, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.hermes_background_control TO service_role;
INSERT INTO public.hermes_background_control(id) VALUES(1) ON CONFLICT (id) DO NOTHING;

-- Compara token existente no Vault; nunca retorna o proprio segredo.
-- EXECUTE disponivel apenas ao servidor de servico, nao ao usuario logado.
CREATE OR REPLACE FUNCTION public.hermes_background_authorized(p_token text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, vault
AS $secure$
  SELECT length(coalesce(p_token,'')) >= 32 AND EXISTS(
    SELECT 1 FROM vault.decrypted_secrets secret
    WHERE secret.name='lexis_wa_daily_cron_token'
      AND secret.decrypted_secret=p_token
  );
$secure$;
REVOKE ALL ON FUNCTION public.hermes_background_authorized(text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hermes_background_authorized(text) TO service_role;
