# P0-B · Carteira colaborativa por empresa

**Regra confirmada pelo produto:** na aba `/processos`, **todos os usuários autenticados e vinculados à mesma empresa**, inclusive perfis Operador e Visualizador, podem consultar, criar, editar, excluir, atender, reabrir, encerrar, redistribuir e iniciar varreduras/reclassificações de processos da empresa. O campo `created_by` identifica o responsável, **não restringe o acesso a `/processos`**. O autor da ação e o responsável são campos distintos.

## Isolamento obrigatório

- O servidor deriva `auth_id` e `empresa_id` de `getUserContext()`; nunca confiar em IDs enviados pelo navegador.
- Todas as ações que usam `service_role` aplicam `.eq('empresa_id', ctx.empresa_id)` nas leituras e escritas. O segredo jamais é disponibilizado no cliente.
- As quatro políticas RLS atuais de `public.processos` para `authenticated` usam o tenant verificado para SELECT/INSERT/UPDATE/DELETE; INSERT e WITH CHECK de UPDATE exigem `created_by` de um usuário cadastrado na mesma empresa.
- Não alterar proprietário ao editar, atender ou escanear. A transferência de `created_by` é uma ação específica, identificada e auditada.
- Limites de módulos administrativos, segurança, gestão da equipe, faturamento e exportação de relatórios consolidados **não** são alterados por esta regra.
- A aba `/cases` pode manter sua visualização individual; isso não limita `/processos` nem o scanner empresarial.

## Pontos corrigidos

1. `applyBrowserDjenResultAction`: elimina a checagem obsoleta de dono no scanner de processo alheio da mesma empresa; mantém a checagem por tenant.
2. `recalibrateCasesAction`: processa o conjunto empresarial, sem exigir Administrador; grava auditoria da execução.
3. `reclassificarExecutivoCarteiraAction` e `batchScanExecutivoAction`: operam somente no tenant autenticado, não apenas nos registros próprios do executor.
4. `getStoredCasesForEmpresa` e `saveStoredCasesForEmpresa`: opção explícita `companyOperational` para fluxos coletivos, preservando o comportamento pessoal padrão e o responsável original.
5. Middleware: Operador pode alcançar APIs operacionais de scanner, desde que autenticado, vinculado ao tenant e com pacote contratado; APIs financeiras continuam restritas por cargo.

## Validações

- Leitura SQL transacional, com papel `authenticated`, retornou 2.648 registros para Operador, Administrador, Supervisor e Superadmin, correspondendo à carteira atual de uma empresa.
- Os testes de funções verificam que a autorização na operação de processos exige sessão + empresa e não eleva permissões de relatórios ou segurança.
- Não existe atualmente um usuário com cargo Visualizador no banco de produção; sua regra foi verificada pelos testes de código, não por login real.
- Apenas uma empresa possui processos cadastrados na amostra atual; a impossibilidade de consultar empresa alheia foi analisada pela expressão das políticas, **não** testada contra duas carteiras reais.
- Não executar exclusões ou alterações de teste na produção: validar efeitos reais com ambiente de testes ou uma ação legitimamente solicitada e identificada.

## Checklist de regressão

- `/processos`: Operador e Visualizador têm os botões e podem editar, atender e excluir um caso pertencente a colega do mesmo tenant.
- `/processos`: Scanner local Full/Híbrido recupera a fila inteira; nuvem exige validação do pacote; DataJud/DJEN externos podem continuar indisponíveis independentemente da RLS.
- Auditoria/último retorno: crédito para o ator do atendimento, `created_by` preservado.
- `/cases`: lista pessoal e KPIs pessoais seguem corretos.
- Outra empresa: resultado vazio/403; nenhum usuário obtém dados ou executa operações fora do tenant.
- Relatórios consolidados e gestão de usuários não sofrem elevação de permissão.
