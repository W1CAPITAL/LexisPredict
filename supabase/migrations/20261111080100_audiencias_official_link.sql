-- URL só quando foi mencionada explicitamente na publicação/movimento verificado.
-- Nunca derive links de sala, gere tokens ou abra páginas com CAPTCHA automaticamente.
ALTER TABLE public.audiencias_monitoradas
 ADD COLUMN IF NOT EXISTS meeting_url text;
COMMENT ON COLUMN public.audiencias_monitoradas.meeting_url IS
 'Link literal da audiência citado na evidência oficial. Não comprova que a sala esteja aberta nem a validade da pauta.';
