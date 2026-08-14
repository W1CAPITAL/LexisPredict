-- OPCIONAL: só se quiser colunas reais (o app já grava em dados JSONB sem isso)
ALTER TABLE public.processos
  ADD COLUMN IF NOT EXISTS is_procedente BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS procedente_motivo TEXT NULL,
  ADD COLUMN IF NOT EXISTS cumprimento_pendente_necessario BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS data_transito_julgado TIMESTAMPTZ NULL;

-- NÃO é obrigatório criar cumprimento_encerrado / cumprimento_ativo / status_executivo
-- (ficam em dados JSONB)
