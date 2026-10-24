-- P0 2026-10-24. Harden direct PostgREST access to public.processos.
-- Maintains company-wide read via authenticated server-side /processos, not
-- arbitrary browser SELECT. Database writers using service_role are unchanged.
-- The legacy owner identifier can be either auth.uid() or usuarios.id.
BEGIN;

REVOKE TRUNCATE, TRIGGER, REFERENCES ON TABLE public.processos FROM anon, authenticated;

DROP POLICY IF EXISTS processos_select ON public.processos;
CREATE POLICY processos_select ON public.processos FOR SELECT TO authenticated USING (
  (SELECT public.is_superadmin())
  OR (
    empresa_id = (SELECT public.get_user_empresa_id())
    AND (
      lower(coalesce((SELECT public.current_cargo()),'')) IN ('supervisor','superadmin')
      OR created_by = (SELECT auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.usuarios u
        WHERE u.empresa_id = processos.empresa_id
          AND u.auth_user_id = (SELECT auth.uid()) AND u.id = processos.created_by
      )
    )
  )
);

DROP POLICY IF EXISTS processos_insert ON public.processos;
CREATE POLICY processos_insert ON public.processos FOR INSERT TO authenticated WITH CHECK (
  (SELECT public.is_superadmin())
  OR (
    empresa_id = (SELECT public.get_user_empresa_id())
    AND (
      (
        lower(coalesce((SELECT public.current_cargo()),'')) = 'supervisor'
        AND EXISTS (SELECT 1 FROM public.usuarios u
          WHERE u.empresa_id = processos.empresa_id
            AND (u.id = processos.created_by OR u.auth_user_id = processos.created_by))
      )
      OR (
        lower(coalesce((SELECT public.current_cargo()),'')) IN ('administrador','operador')
        AND (
          created_by = (SELECT auth.uid())
          OR EXISTS (SELECT 1 FROM public.usuarios u
            WHERE u.empresa_id = processos.empresa_id AND u.auth_user_id = (SELECT auth.uid()) AND u.id = processos.created_by)
        )
      )
    )
  )
);

DROP POLICY IF EXISTS processos_update ON public.processos;
CREATE POLICY processos_update ON public.processos FOR UPDATE TO authenticated
USING (
  (SELECT public.is_superadmin())
  OR (
    empresa_id = (SELECT public.get_user_empresa_id())
    AND (
      lower(coalesce((SELECT public.current_cargo()),'')) = 'supervisor'
      OR (
        lower(coalesce((SELECT public.current_cargo()),'')) IN ('administrador','operador')
        AND (
          created_by = (SELECT auth.uid())
          OR EXISTS (SELECT 1 FROM public.usuarios u
            WHERE u.empresa_id = processos.empresa_id AND u.auth_user_id = (SELECT auth.uid()) AND u.id = processos.created_by)
        )
      )
    )
  )
)
WITH CHECK (
  (SELECT public.is_superadmin())
  OR (
    empresa_id = (SELECT public.get_user_empresa_id())
    AND (
      (
        lower(coalesce((SELECT public.current_cargo()),'')) = 'supervisor'
        AND EXISTS (SELECT 1 FROM public.usuarios u
          WHERE u.empresa_id = processos.empresa_id
            AND (u.id = processos.created_by OR u.auth_user_id = processos.created_by))
      )
      OR (
        lower(coalesce((SELECT public.current_cargo()),'')) IN ('administrador','operador')
        AND (
          created_by = (SELECT auth.uid())
          OR EXISTS (SELECT 1 FROM public.usuarios u
            WHERE u.empresa_id = processos.empresa_id AND u.auth_user_id = (SELECT auth.uid()) AND u.id = processos.created_by)
        )
      )
    )
  )
);

DROP POLICY IF EXISTS processos_delete ON public.processos;
CREATE POLICY processos_delete ON public.processos FOR DELETE TO authenticated USING (
  (SELECT public.is_superadmin())
  OR (
    empresa_id = (SELECT public.get_user_empresa_id())
    AND (
      lower(coalesce((SELECT public.current_cargo()),'')) = 'supervisor'
      OR (
        lower(coalesce((SELECT public.current_cargo()),'')) = 'administrador'
        AND (
          created_by = (SELECT auth.uid())
          OR EXISTS (SELECT 1 FROM public.usuarios u
            WHERE u.empresa_id = processos.empresa_id AND u.auth_user_id = (SELECT auth.uid()) AND u.id = processos.created_by)
        )
      )
    )
  )
);
COMMIT;
