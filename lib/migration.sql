
-- MIGRATION SCRIPT: LEXISPREDICT RELATIONAL ARCHITECTURE
-- OBJETIVO: SEGURANÇA RLS, AUDITORIA NATIVA E PERFORMANCE DE BUSCA

-- 1. Tabela de Processos (Camada Relacional Plana)
CREATE TABLE IF NOT EXISTS public.processos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users DEFAULT auth.uid(),
    cliente TEXT NOT NULL,
    protocolo TEXT UNIQUE NOT NULL,
    advogado TEXT,
    situacao TEXT DEFAULT 'EM ANDAMENTO',
    proximo_prazo TEXT, -- Mantendo texto para compatibilidade com o parser atual
    tribunal TEXT,
    status TEXT,
    dias_faltando INTEGER,
    link_consulta TEXT,
    tipo TEXT,
    telefone TEXT,
    atendente TEXT,
    score_ia INTEGER,
    risco_ia TEXT,
    parecer_ia TEXT,
    ultimo_retorno TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. Tabela de Notas
CREATE TABLE IF NOT EXISTS public.notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users DEFAULT auth.uid(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 3. Tabela de Auditoria (Audit Trail)
CREATE TABLE IF NOT EXISTS public.auditoria_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users,
    table_name TEXT NOT NULL,
    record_id TEXT NOT NULL,
    action TEXT NOT NULL, -- INSERT, UPDATE, DELETE
    old_data JSONB,
    new_data JSONB,
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 4. Função de Gatilho de Auditoria
CREATE OR REPLACE FUNCTION public.process_audit_log()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        INSERT INTO auditoria_logs(user_id, table_name, record_id, action, old_data)
        VALUES (auth.uid(), TG_TABLE_NAME, OLD.id::text, TG_OP, to_jsonb(OLD));
        RETURN OLD;
    ELSIF (TG_OP = 'UPDATE') THEN
        INSERT INTO auditoria_logs(user_id, table_name, record_id, action, old_data, new_data)
        VALUES (auth.uid(), TG_TABLE_NAME, NEW.id::text, TG_OP, to_jsonb(OLD), to_jsonb(NEW));
        RETURN NEW;
    ELSIF (TG_OP = 'INSERT') THEN
        INSERT INTO auditoria_logs(user_id, table_name, record_id, action, new_data)
        VALUES (auth.uid(), TG_TABLE_NAME, NEW.id::text, TG_OP, to_jsonb(NEW));
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Ativação dos Triggers
DROP TRIGGER IF EXISTS tr_audit_processos ON processos;
CREATE TRIGGER tr_audit_processos
AFTER INSERT OR UPDATE OR DELETE ON processos
FOR EACH ROW EXECUTE FUNCTION process_audit_log();

-- 6. Row Level Security (RLS) - Blindagem de Dados
ALTER TABLE public.processos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

-- Políticas para Processos
CREATE POLICY "Acesso Total aos Próprios Processos" ON processos
    FOR ALL USING (auth.uid() = user_id);

-- Políticas para Notas
CREATE POLICY "Acesso Total às Próprias Notas" ON notes
    FOR ALL USING (auth.uid() = user_id);

-- 7. Desativar RLS para modo MVP/Demo se necessário (Opcional, recomendado manter ativado)
-- ALTER TABLE public.processos DISABLE ROW LEVEL SECURITY;
