# Lotes 2–8 — implementação incremental

Data: 12/11/2026. Base: auditoria de IA Infinitum e PR #176.

## Lote 2 — checklist colaborativo
- Criada tabela `lexis_case_workflow_steps`, índice por empresa/processo, políticas RLS e trilha `lexis_case_workflow_audit`.
- Criadas ações de servidor para listar e concluir/reabrir etapas, exigindo autenticação, empresa, processo pertencente à carteira e perfil não visualizador.
- `AtividadesChecklist` passa a ler/gravar no banco, com estado de carregamento, erros e atualização após confirmação do servidor.
- Sem fallback silencioso para localStorage: falhas ficam visíveis.
- Migração deve ser aplicada no Supabase antes de liberar a nova interface.

## Lotes 3–8 — fundações de dados, sem funcionalidades fictícias
- Lote 3: `lexis_team_inbox` guarda apenas metadados de atribuição por hash do telefone, sem conteúdo de mensagens.
- Lote 4: `lexis_agent_versions` guarda versões e ferramentas permitidas; publicação e editor ainda não estão conectados.
- Lote 5: `lexis_intake_forms` guarda definição, hash do token, validade e revogação; não há endpoint público de envio ainda.
- Lote 6: todas as tabelas têm RLS de leitura por empresa; escrita do cliente desabilitada nas fundações. As permissões por ação ainda exigem implementação.
- Lote 7: `lexis_call_metadata` registra estados e consentimento; não implementa telefonia ou gravação sem provedor.
- Lote 8: `lexis_integration_health` guarda estados e datas; conectores precisam alimentar esses estados de verdade.

## Pendências de integração

1. Aplicar migrações no ambiente Supabase correto e testar isolamento entre duas empresas.
2. Validar que a coluna `empresa_id` dos processos e usuários é UUID na instalação alvo.
3. Adicionar UI e ações autorizadas para atribuição de WhatsApp, estúdio de versões, formulários, telefonia e saúde de integrações.
4. Não habilitar rotas públicas de formulário sem limitação de uso, antivírus, tamanho de upload e token seguro.
5. Não registrar mensagens, áudios ou transcrições sem política de consentimento/retenção.
6. Executar CI, migrações em staging e testes de ponta a ponta antes do merge.

## Critério de conclusão

Somente o lote 2 está conectado à interface; lotes 3–8 têm **estrutura inicial de banco**, não estão funcionalmente concluídos. A migração e a implantação não foram executadas automaticamente.
