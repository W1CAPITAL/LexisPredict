# P0 — /processos é uma carteira operacional compartilhada

## Regra confirmada
Todos os perfis com sessão Supabase válida e vínculo com a mesma empresa
(Operador, Administrador, Supervisor, Superadmin e Visualizador) podem,
**na aba /processos**, pesquisar, consultar, editar, criar, atender,
encerrar, excluir e reatribuir processos da empresa, inclusive quando o
responsável original é um colega. As permissões para /report/completo,
/security, /team e outras áreas gerenciais são independentes e permanecem
restritas conforme a finalidade.

## Implementação
- UI /processos: `canOperateCompanyCases` e `canManageItem`; ações
  visíveis no `ProcessosCommandCenter`, sem travas por cargo.
- Server Actions: `canAccessExistingCase(ctx,row)` compara a empresa do
  processo com a empresa obtida por `getUserContext()`, nunca da URL.
- Supabase: SELECT/INSERT/UPDATE/DELETE de `public.processos` usam RLS
  por empresa autenticada; INSERT/UPDATE validam que `created_by` pertence
  à empresa. TRUNCATE/TRIGGER/REFERENCES seguem revogados para
  `authenticated`.
- Consulta do scanner e KPIs: agregações empresariais servidoras não ficam
  limitadas por `created_by`; uso de service_role fica confinado ao servidor.
- Auditoria: `atendido_por` e `edited_by` registram o executor, enquanto
  `created_by` identifica o responsável. Espelhamentos em planilhas não
  devem se apresentar como Superadmin quando o ator foi outro usuário.
- Exclusões: requerem confirmação na interface, checagem de empresa na
  ação, registro com executor e invalidação do cache. Não há exclusões de
  processos durante o teste deste lote.

## Evidências sem alteração de dados
- 2.648 processos no tenant atual; nenhum com `created_by` inexistente
  ou sem responsável; 11 perfis autenticáveis com empresa cadastrada.
- RLS vigente concede SELECT/INSERT/UPDATE/DELETE a `authenticated`
  dentro de empresa, sem privilégios TRUNCATE/TRIGGER/REFERENCES.
- SELECT dentro de transação com papel `authenticated` simulou Operador,
  Administrador e Supervisor e retornou a carteira inteira (2.648); um
  login não cadastrado obteve zero resultados. Não houve `UPDATE`,
  `DELETE` ou `INSERT` de dados reais durante a validação.
- Testes Vitest cobrem todos os cinco cargos, outros donos, status ativo e
  encerrado, ausência de sessão e outra empresa.
- Ainda é necessário teste E2E autenticado para confirmar todos os
  botões com um processo de TESTE em ambiente isolado. Teste de leitura e
  permissão de tabela não provam execução real de escrita.

## Limites intencionais
**Nunca** desabilitar RLS, aceitar `empresa_id` arbitrário do cliente ou
expor a chave `service_role` no browser. Permissões gerenciais, exportações
de equipe e configurações de segurança não são abertas por esta regra.
