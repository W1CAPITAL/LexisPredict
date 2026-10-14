-- Fechar leitura global indevida de auditoria (policy antiga possuía OR TRUE).
DROP POLICY IF EXISTS auditoria_select_empresa ON public.auditoria_logs_app;
CREATE POLICY auditoria_select_empresa_tenant
  ON public.auditoria_logs_app FOR SELECT TO authenticated
  USING (empresa_id = (select public.get_user_empresa_id()) OR (select public.is_superadmin()));
REVOKE ALL ON TABLE public.auditoria_logs_app FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.auditoria_logs_app FROM authenticated;

-- Restrição de rotas RPC privilegiadas. Helpers usados por políticas RLS
-- continuam executáveis por usuários autenticados e pelo backend.
REVOKE EXECUTE ON FUNCTION public.current_cargo() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.current_cargo() TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.current_empresa_id() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.current_empresa_id() TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.current_usuario() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.current_usuario() TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.get_user_empresa_id() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_empresa_id() TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.is_knowledge_manager() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_knowledge_manager() TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.is_superadmin() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_superadmin() TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.meu_empresa_id() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.meu_empresa_id() TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.processos_audit_log_trigger() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.processos_audit_log_trigger() TO service_role;
REVOKE EXECUTE ON FUNCTION public.wa_automatic_return_ack() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wa_automatic_return_ack() TO service_role;
REVOKE EXECUTE ON FUNCTION public.wa_movement_local_ack() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wa_movement_local_ack() TO service_role;
REVOKE EXECUTE ON FUNCTION public.wa_redact_completed_outbound() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wa_redact_completed_outbound() TO service_role;
-- Ferramenta interna de reset nunca deve estar disponível como RPC público.
REVOKE EXECUTE ON FUNCTION public._lexis_reset_policies(text) FROM PUBLIC, anon, authenticated;
-- Fixar search_path em funções legadas, evitando resolução via schema mutável.
ALTER FUNCTION public.set_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION public.search_knowledge_chunks(text,text[],integer) SET search_path = public, pg_temp;
ALTER FUNCTION public.recompute_scan_priority(bigint) SET search_path = public, pg_temp;
ALTER FUNCTION public._lexis_reset_policies(text) SET search_path = public, pg_temp;
ALTER FUNCTION public.processos_audit_log_trigger() SET search_path = public, pg_temp;
ALTER FUNCTION public.knowledge_docs_fill_defaults() SET search_path = public, pg_temp;
ALTER FUNCTION public.set_processos_updated_at() SET search_path = public, pg_temp;
