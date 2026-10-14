-- Corrigir cinco políticas antigas USING(TRUE): leitura/edição só no tenant autorizado.
DROP POLICY IF EXISTS crm_servicos_empresa ON public.crm_servicos;
CREATE POLICY crm_servicos_tenant_all ON public.crm_servicos FOR ALL TO authenticated USING (empresa_id = (select public.get_user_empresa_id()) OR (select public.is_superadmin())) WITH CHECK (empresa_id = (select public.get_user_empresa_id()) OR (select public.is_superadmin()));
REVOKE ALL ON TABLE public.crm_servicos FROM anon;
DROP POLICY IF EXISTS crm_fornecedores_empresa ON public.crm_fornecedores;
CREATE POLICY crm_fornecedores_tenant_all ON public.crm_fornecedores FOR ALL TO authenticated USING (empresa_id = (select public.get_user_empresa_id()) OR (select public.is_superadmin())) WITH CHECK (empresa_id = (select public.get_user_empresa_id()) OR (select public.is_superadmin()));
REVOKE ALL ON TABLE public.crm_fornecedores FROM anon;
DROP POLICY IF EXISTS crm_negocios_empresa ON public.crm_negocios;
CREATE POLICY crm_negocios_tenant_all ON public.crm_negocios FOR ALL TO authenticated USING (empresa_id = (select public.get_user_empresa_id()) OR (select public.is_superadmin())) WITH CHECK (empresa_id = (select public.get_user_empresa_id()) OR (select public.is_superadmin()));
REVOKE ALL ON TABLE public.crm_negocios FROM anon;
DROP POLICY IF EXISTS crm_receber_empresa ON public.crm_receber;
CREATE POLICY crm_receber_tenant_all ON public.crm_receber FOR ALL TO authenticated USING (empresa_id = (select public.get_user_empresa_id()) OR (select public.is_superadmin())) WITH CHECK (empresa_id = (select public.get_user_empresa_id()) OR (select public.is_superadmin()));
REVOKE ALL ON TABLE public.crm_receber FROM anon;
DROP POLICY IF EXISTS crm_pagar_empresa ON public.crm_pagar;
CREATE POLICY crm_pagar_tenant_all ON public.crm_pagar FOR ALL TO authenticated USING (empresa_id = (select public.get_user_empresa_id()) OR (select public.is_superadmin())) WITH CHECK (empresa_id = (select public.get_user_empresa_id()) OR (select public.is_superadmin()));
REVOKE ALL ON TABLE public.crm_pagar FROM anon;
-- Notificações privadas do destinatário, sem a antiga política ALL para todos da empresa.
DROP POLICY IF EXISTS notificacoes_all ON public.notificacoes;
REVOKE ALL ON TABLE public.notificacoes FROM anon;
CREATE POLICY notificacoes_insert_tenant ON public.notificacoes FOR INSERT TO authenticated WITH CHECK (
 empresa_id = (select public.get_user_empresa_id())
 AND EXISTS (SELECT 1 FROM public.usuarios u WHERE u.auth_user_id = recipient_user_id AND u.empresa_id = empresa_id)
);
-- Memorizar helpers por consulta SQL para evitar lookup de usuário por cada linha.
ALTER POLICY advogados_all ON public.advogados_banca USING (empresa_id = (select public.get_user_empresa_id()) OR (select public.is_superadmin())) WITH CHECK (empresa_id = (select public.get_user_empresa_id()) OR (select public.is_superadmin()));
ALTER POLICY alert_events_all ON public.alert_events USING (empresa_id = (select public.get_user_empresa_id()) OR (select public.is_superadmin())) WITH CHECK (empresa_id = (select public.get_user_empresa_id()) OR (select public.is_superadmin()));
ALTER POLICY ba_scan_logs_all ON public.ba_scan_logs USING (empresa_id = (select public.get_user_empresa_id()) OR (select public.is_superadmin())) WITH CHECK (empresa_id = (select public.get_user_empresa_id()) OR (select public.is_superadmin()));
ALTER POLICY honorarios_all ON public.honorarios USING (empresa_id = (select public.get_user_empresa_id()) OR (select public.is_superadmin())) WITH CHECK (empresa_id = (select public.get_user_empresa_id()) OR (select public.is_superadmin()));
ALTER POLICY knowledge_chunks_all ON public.knowledge_chunks USING (empresa_id = (select public.get_user_empresa_id()) OR (select public.is_superadmin())) WITH CHECK (empresa_id = (select public.get_user_empresa_id()) OR (select public.is_superadmin()));
ALTER POLICY knowledge_docs_all ON public.knowledge_docs USING (empresa_id = (select public.get_user_empresa_id()) OR (select public.is_superadmin())) WITH CHECK (empresa_id = (select public.get_user_empresa_id()) OR (select public.is_superadmin()));
ALTER POLICY notes_all ON public.notes USING (empresa_id = (select public.get_user_empresa_id()) OR (select public.is_superadmin())) WITH CHECK (empresa_id = (select public.get_user_empresa_id()) OR (select public.is_superadmin()));
ALTER POLICY scan_metrics_all ON public.scan_metrics USING (empresa_id = (select public.get_user_empresa_id()) OR (select public.is_superadmin())) WITH CHECK (empresa_id = (select public.get_user_empresa_id()) OR (select public.is_superadmin()));
ALTER POLICY empresas_select ON public.empresas USING (id=(select public.get_user_empresa_id()) OR (select public.is_superadmin()));
ALTER POLICY usuarios_select ON public.usuarios USING (auth_user_id=(select auth.uid()) OR (empresa_id = (select public.get_user_empresa_id()) OR (select public.is_superadmin())));
ALTER POLICY usuarios_update_own ON public.usuarios USING (auth_user_id=(select auth.uid())) WITH CHECK (auth_user_id=(select auth.uid()));
ALTER POLICY processos_select ON public.processos USING (empresa_id = (select public.get_user_empresa_id()) OR (select public.is_superadmin()));
ALTER POLICY processos_insert ON public.processos WITH CHECK (empresa_id = (select public.get_user_empresa_id()) OR (select public.is_superadmin()));
ALTER POLICY processos_update ON public.processos USING (empresa_id = (select public.get_user_empresa_id()) OR (select public.is_superadmin())) WITH CHECK (empresa_id = (select public.get_user_empresa_id()) OR (select public.is_superadmin()));
ALTER POLICY processos_delete ON public.processos USING (empresa_id = (select public.get_user_empresa_id()) OR (select public.is_superadmin()));
-- As políticas redundantes faziam leituras repetidas na tabela de usuários.
DROP POLICY IF EXISTS processos_select_empresa ON public.processos;
DROP POLICY IF EXISTS processos_insert_empresa ON public.processos;
DROP POLICY IF EXISTS processos_update_empresa ON public.processos;
