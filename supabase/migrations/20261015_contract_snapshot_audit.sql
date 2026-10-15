-- Histórico auditável de termos aceitos, sem armazenar informações desnecessárias
-- sobre dispositivo ou localização. Preserve o texto exatamente aceito.
ALTER TABLE public.lexis_user_legal_acceptances
 ADD COLUMN IF NOT EXISTS contract_text_snapshot text,
 ADD COLUMN IF NOT EXISTS contract_locale text NOT NULL DEFAULT 'pt-BR',
 ADD COLUMN IF NOT EXISTS acceptance_context text NOT NULL DEFAULT 'lexispredict-profile';
COMMENT ON COLUMN public.lexis_user_legal_acceptances.contract_text_snapshot
 IS 'Cópia imutável do documento apresentado no aceite eletrônico simples; acompanhada por SHA-256 e versão.';
