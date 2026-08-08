-- ============================================================================
-- LEXISPREDICT — MIGRATION SUPABASE (rodar no SQL Editor do Supabase)
-- Extra 1: persistir clientes das abas Revisional e Jurídico no Supabase
-- (múltiplos clientes por empresa, escopados por empresa_id nas server actions)
-- Extra 2: auditoria de exportações (F1) reaproveita a tabela auditoria_logs_app
-- ============================================================================

-- 1) Tabela de Clientes de Operação (Revisional + Jurídico)
CREATE TABLE IF NOT EXISTS public.clientes_operacao (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID NOT NULL,
    tipo TEXT NOT NULL DEFAULT 'revisional' CHECK (tipo IN ('revisional', 'juridico')),
    cliente TEXT NOT NULL,
    banco TEXT,
    protocolo TEXT,
    dados JSONB DEFAULT '{}'::jsonb,
    created_by UUID,
    edited_by_name TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clientes_operacao_empresa
    ON public.clientes_operacao (empresa_id, updated_at DESC);

-- 2) Tabela de Auditoria do App (já usada pelo módulo de auditoria)
CREATE TABLE IF NOT EXISTS public.auditoria_logs_app (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID NOT NULL,
    auth_user_id UUID,
    user_nome TEXT,
    action TEXT,
    protocolo_ref TEXT,
    detalhes JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auditoria_logs_app_empresa
    ON public.auditoria_logs_app (empresa_id, created_at DESC);

-- 3) Permissões (modo MVP: RLS desativado — o app já isola por empresa_id)
GRANT ALL ON public.clientes_operacao TO anon, authenticated, service_role;
GRANT ALL ON public.auditoria_logs_app TO anon, authenticated, service_role;

-- ============================================================================
-- OPCIONAL — ativar RLS por empresa (recomendado em produção).
-- Descomente apenas se os usuários tiverem auth_user_id preenchido na tabela
-- public.usuarios (colunas: email, empresa_id, auth_user_id).
--
-- ALTER TABLE public.clientes_operacao ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.auditoria_logs_app ENABLE ROW LEVEL SECURITY;
--
-- CREATE POLICY "clientes_operacao_select" ON public.clientes_operacao
--   FOR SELECT USING (
--     EXISTS (SELECT 1 FROM public.usuarios u
--             WHERE u.auth_user_id = auth.uid()
--               AND u.empresa_id = clientes_operacao.empresa_id));
--
-- CREATE POLICY "clientes_operacao_insert" ON public.clientes_operacao
--   FOR INSERT WITH CHECK (
--     EXISTS (SELECT 1 FROM public.usuarios u
--             WHERE u.auth_user_id = auth.uid()
--               AND u.empresa_id = clientes_operacao.empresa_id));
--
-- CREATE POLICY "clientes_operacao_update" ON public.clientes_operacao
--   FOR UPDATE USING (
--     EXISTS (SELECT 1 FROM public.usuarios u
--             WHERE u.auth_user_id = auth.uid()
--               AND u.empresa_id = clientes_operacao.empresa_id));
--
-- CREATE POLICY "clientes_operacao_delete" ON public.clientes_operacao
--   FOR DELETE USING (
--     EXISTS (SELECT 1 FROM public.usuarios u
--             WHERE u.auth_user_id = auth.uid()
--               AND u.empresa_id = clientes_operacao.empresa_id));
-- ============================================================================
