-- Flags executivas (rode no Supabase SQL Editor)
ALTER TABLE public.processos
  ADD COLUMN IF NOT EXISTS is_procedente BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS procedente_motivo TEXT NULL,
  ADD COLUMN IF NOT EXISTS em_cumprimento_sentenca BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS cumprimento_pendente_necessario BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS data_transito_julgado TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS detalhes_execucao JSONB DEFAULT '{}'::jsonb;

-- Observação: cumprimento_ativo / cumprimento_encerrado / status_executivo
-- ficam preferencialmente em dados JSONB (compatível sem migration extra).
