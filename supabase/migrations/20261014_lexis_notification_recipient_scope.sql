-- Validar que o destinatário da notificação pertence ao mesmo tenant.
ALTER POLICY notificacoes_insert_tenant ON public.notificacoes
 WITH CHECK (
   empresa_id = (select public.get_user_empresa_id())
   AND EXISTS (
     SELECT 1 FROM public.usuarios u
     WHERE u.auth_user_id = notificacoes.recipient_user_id
       AND u.empresa_id = notificacoes.empresa_id
   )
 );
