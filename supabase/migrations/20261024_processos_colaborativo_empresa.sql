-- P0 2026-10-24 /processos colaborativo.
-- A leitura/escrita é compartilhada por todos os usuários AUTENTICADOS
-- de cada empresa, sem depender de created_by. Outros tenants seguem isolados.
-- Superadmin global preserva o comportamento anterior.
-- NUNCA remover RLS nem habilitar acesso anônimo ou TRUNCATE.
BEGIN;
ALTER TABLE public.processos ENABLE ROW LEVEL SECURITY;
REVOKE TRUNCATE,TRIGGER,REFERENCES ON TABLE public.processos FROM anon,authenticated;
REVOKE ALL ON TABLE public.processos FROM anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.processos TO authenticated;

DROP POLICY IF EXISTS processos_select ON public.processos;
CREATE POLICY processos_select ON public.processos
  FOR SELECT TO authenticated USING (
    (SELECT auth.uid()) IS NOT NULL
    AND (
      empresa_id = (SELECT public.get_user_empresa_id())
      OR (SELECT public.is_superadmin())
    )
  );

DROP POLICY IF EXISTS processos_insert ON public.processos;
CREATE POLICY processos_insert ON public.processos
  FOR INSERT TO authenticated WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL
    AND (
      (SELECT public.is_superadmin())
      OR (
        empresa_id = (SELECT public.get_user_empresa_id())
        AND created_by IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.usuarios u
          WHERE u.empresa_id = processos.empresa_id
            AND (u.id = processos.created_by OR u.auth_user_id = processos.created_by)
        )
      )
    )
  );

DROP POLICY IF EXISTS processos_update ON public.processos;
CREATE POLICY processos_update ON public.processos
  FOR UPDATE TO authenticated
  USING (
    (SELECT auth.uid()) IS NOT NULL
    AND (
      empresa_id = (SELECT public.get_user_empresa_id())
      OR (SELECT public.is_superadmin())
    )
  )
  WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL
    AND (
      (SELECT public.is_superadmin())
      OR (
        empresa_id = (SELECT public.get_user_empresa_id())
        AND created_by IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.usuarios u
          WHERE u.empresa_id = processos.empresa_id
            AND (u.id = processos.created_by OR u.auth_user_id = processos.created_by)
        )
      )
    )
  );

DROP POLICY IF EXISTS processos_delete ON public.processos;
CREATE POLICY processos_delete ON public.processos
  FOR DELETE TO authenticated USING (
    (SELECT auth.uid()) IS NOT NULL
    AND (
      empresa_id = (SELECT public.get_user_empresa_id())
      OR (SELECT public.is_superadmin())
    )
  );
COMMIT;
