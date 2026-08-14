-- Colunas executivas — SQL Editor Supabase
ALTER TABLE public.processos
  ADD COLUMN IF NOT EXISTS is_procedente BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS procedente_motivo TEXT NULL,
  ADD COLUMN IF NOT EXISTS em_cumprimento_sentenca BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS cumprimento_pendente_necessario BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS data_transito_julgado TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS detalhes_execucao JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_processos_cumprimento_aba
  ON public.processos (empresa_id, cumprimento_pendente_necessario, em_cumprimento_sentenca, is_procedente)
  WHERE is_procedente = TRUE
     OR em_cumprimento_sentenca = TRUE
     OR cumprimento_pendente_necessario = TRUE;
