# P0 — Scanner, KPIs e permissões da carteira empresarial (26/10/2026)

## Escopo autorizado

Em `/processos`, Operador, Administrador, Supervisor, Superadmin e Visualizador autenticados na empresa podem consultar, criar, editar, excluir e atender seus processos. Essa regra **não** abre relatórios gerenciais, `/cases` pessoal, configurações, outros tenants ou a chave técnica ao navegador.

## RLS vigente — validação apenas de leitura

No Supabase `lexis-predict` foram verificadas as políticas RLS da tabela `public.processos`:

- RLS está ativada e o papel `authenticated` possui `SELECT/INSERT/UPDATE/DELETE`; `TRUNCATE/TRIGGER/REFERENCES` não foram liberados.
- A política usa `auth.uid()` e `get_user_empresa_id()`, com exceção legada de `is_superadmin()` global. As ações operacionais do Next ainda validam `empresa_id` no servidor.
- Transações `READ ONLY`, simulando contextos reais do Supabase Auth, retornaram **2.648 processos em uma empresa, zero fora dela** para cada perfil existente: Operador, Administrador e Supervisor.
- Um UUID de login não cadastrado retornou **zero processos**.
- Não havia usuário autenticável com cargo Visualizador nessa empresa; a matriz de código contempla esse cargo, mas o teste de sessão real permanece pendente.
- Nenhum `INSERT`, `UPDATE`, `DELETE`, alteração de RLS ou dados de cliente foi executado nessa verificação.

Uma leitura autenticada **não comprova** que operações de escrita funcionam ponta a ponta. Recomenda-se verificar CRUD, auditoria e scanner usando processos fictícios numa empresa/ambiente de homologação, preservando rastros e limpando apenas dados de teste.

## Problemas corrigidos neste lote

1. `/api/queue/enqueue-scan` não pode autenticar `Bearer undefined` quando `DATAJUD_WORKER_SECRET` estiver ausente; valida UUID da empresa e restringe modo.
2. A fila backend `getGlobalPendingProcessesSystem` agora **lança erro** em falhas nas consultas de ativos, encerrados, complemento e cumprimento, em vez de devolver lista vazia (falso fim da varredura).
3. A triagem paginada de cumprimento com `since` continua procurando além dos primeiros falsos candidatos, usando cursor estável. Se atingir o limite de segurança antes de terminar, **declara falha**, não conclusão.
4. `runCloudScanBatch` só informa `success=true` para lote com consultas oficiais bem-sucedidas; mantém `processed`, `successCount` e `failedCount` para diagnóstico e não transforma falha de banco em conclusão.
5. `fetchCarteiraCountsAction` utiliza `lexis_portfolio_snapshot`, mesma função SQL oficial dos indicadores. Não interpreta `datajud_encerrado_tribunal` como encerramento operacional, não mistura `atendido_por` com titularidade e não publica `ok=true` para RPC indisponível ou totais incoerentes. O hook exibe erro em vez de zero falso.

## Próxima verificação integrada

- Testar com uma conta de cada cargo e pelo menos duas empresas de homologação.
- Criar processo **fictício** em A, editar/atender/excluir por um colega em A, provar rejeição de B, validar auditoria do executor e retorno da busca/KPIs.
- Simular indisponibilidade do Supabase e dos tribunais em fila Full/Cumprimento; confirmar que nenhuma execução é marcada concluída por erro.
- Confirmar equivalência entre os KPIs de `/processos`, `/vencidos`, `/tarefas` e a RPC por empresa, sem dedução por página.
- **Não** simular exclusão ou envio em processos reais de clientes apenas para teste.
