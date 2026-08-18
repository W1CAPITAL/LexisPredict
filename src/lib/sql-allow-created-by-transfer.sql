-- Permite trocar created_by pelo app (service role / Superadmin).
-- Rode no SQL Editor do Supabase se a transferência falhar com trigger.

-- 1) Ver triggers na tabela processos
SELECT tgname, pg_get_triggerdef(oid)
FROM pg_trigger
WHERE tgrelid = 'public.processos'::regclass
  AND NOT tgisinternal;

-- 2) Remover trigger que impede troca de dono (se existir)
DROP TRIGGER IF EXISTS prevent_created_by_steal ON public.processos;
DROP FUNCTION IF EXISTS public.prevent_created_by_steal() CASCADE;

-- 3) Conferir coluna
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'processos' AND column_name = 'created_by';
