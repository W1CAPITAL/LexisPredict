-- LexisPredict: RLS por empresa com acesso técnico mantido para service_role.
-- Clientes web autenticados veem apenas registros do próprio tenant;
-- visitantes anônimos não leem tabelas operacionais do CRM.
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.notes FROM anon;
ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.empresas FROM anon;
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.usuarios FROM anon;
ALTER TABLE public.processos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.processos FROM anon;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.whatsapp_messages FROM anon;
ALTER TABLE public.advogados_banca ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.advogados_banca FROM anon;
ALTER TABLE public.knowledge_docs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.knowledge_docs FROM anon;
ALTER TABLE public.knowledge_chunks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.knowledge_chunks FROM anon;
ALTER TABLE public.scan_metrics ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.scan_metrics FROM anon;
ALTER TABLE public.alert_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.alert_events FROM anon;
ALTER TABLE public.ba_scan_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ba_scan_logs FROM anon;
ALTER TABLE public.honorarios ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.honorarios FROM anon;
ALTER TABLE public.clientes_operacao ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.clientes_operacao FROM anon;
ALTER TABLE public.auditoria_logins ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.auditoria_logins FROM anon;
ALTER TABLE public.crm_atividades ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.crm_atividades FROM anon;
ALTER TABLE public.crm_tarefas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.crm_tarefas FROM anon;
ALTER TABLE public.crm_agent_tasks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.crm_agent_tasks FROM anon;
ALTER TABLE public.crm_agent_facts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.crm_agent_facts FROM anon;
ALTER TABLE public.chat_threads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.chat_threads FROM anon;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.chat_messages FROM anon;
CREATE POLICY clientes_operacao_tenant_rw ON public.clientes_operacao FOR ALL TO authenticated USING (empresa_id = (select public.get_user_empresa_id()) OR (select public.is_superadmin())) WITH CHECK (empresa_id = (select public.get_user_empresa_id()) OR (select public.is_superadmin()));
CREATE POLICY crm_atividades_tenant_rw ON public.crm_atividades FOR ALL TO authenticated USING (empresa_id = (select public.get_user_empresa_id()) OR (select public.is_superadmin())) WITH CHECK (empresa_id = (select public.get_user_empresa_id()) OR (select public.is_superadmin()));
CREATE POLICY crm_tarefas_tenant_rw ON public.crm_tarefas FOR ALL TO authenticated USING (empresa_id = (select public.get_user_empresa_id()) OR (select public.is_superadmin())) WITH CHECK (empresa_id = (select public.get_user_empresa_id()) OR (select public.is_superadmin()));
CREATE POLICY crm_agent_tasks_tenant_rw ON public.crm_agent_tasks FOR ALL TO authenticated USING (empresa_id = (select public.get_user_empresa_id()) OR (select public.is_superadmin())) WITH CHECK (empresa_id = (select public.get_user_empresa_id()) OR (select public.is_superadmin()));
CREATE POLICY crm_agent_facts_tenant_rw ON public.crm_agent_facts FOR ALL TO authenticated USING (empresa_id = (select public.get_user_empresa_id()) OR (select public.is_superadmin())) WITH CHECK (empresa_id = (select public.get_user_empresa_id()) OR (select public.is_superadmin()));
CREATE POLICY chat_threads_tenant_rw ON public.chat_threads FOR ALL TO authenticated USING (empresa_id = (select public.get_user_empresa_id()) OR (select public.is_superadmin())) WITH CHECK (empresa_id = (select public.get_user_empresa_id()) OR (select public.is_superadmin()));
CREATE POLICY chat_messages_tenant_rw ON public.chat_messages FOR ALL TO authenticated USING (empresa_id = (select public.get_user_empresa_id()) OR (select public.is_superadmin())) WITH CHECK (empresa_id = (select public.get_user_empresa_id()) OR (select public.is_superadmin()));

-- Auditoria: escrita somente pela conexão administrativa do servidor.
CREATE POLICY auditoria_logins_tenant_read ON public.auditoria_logins FOR SELECT TO authenticated USING (empresa_id = (select public.get_user_empresa_id()) OR (select public.is_superadmin()));
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.auditoria_logins FROM authenticated;

-- O próprio usuário pode editar somente nome/foto; jamais cargo, empresa,
-- perfil de acesso ou identificador de autenticação.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.usuarios FROM authenticated;
GRANT UPDATE (nome, avatar_url) ON TABLE public.usuarios TO authenticated;

-- O cadastro de empresas não é gerenciado diretamente pelo cliente web.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.empresas FROM authenticated;

-- Políticas antigas com USING(true) vazavam mensagens entre empresas.
DROP POLICY IF EXISTS wa_messages_select_auth ON public.whatsapp_messages;
DROP POLICY IF EXISTS wa_messages_insert_auth ON public.whatsapp_messages;
DROP POLICY IF EXISTS whatsapp_all ON public.whatsapp_messages;
CREATE POLICY wa_messages_tenant_read ON public.whatsapp_messages FOR SELECT TO authenticated USING (empresa_id = (select public.get_user_empresa_id()) OR (select public.is_superadmin()));
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.whatsapp_messages FROM authenticated;

-- View de métricas obedece às políticas do scanner e não é pública.
REVOKE ALL ON TABLE public.v_scan_success_24h FROM anon;
