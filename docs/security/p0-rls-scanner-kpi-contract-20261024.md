# P0 — Contrato de compatibilidade: RLS, scanner, busca e KPIs

A segurança do Supabase **não** pode quebrar o funcionamento do LexisPredict.
Esta matriz é baseada no código real e na política do banco verificada em 24/10/2026.

| Fluxo | Origem/execução | Escopo | RLS/segurança | Regra obrigatória |
| --- | --- | --- | --- | --- |
| /cases e minha carteira | Next.js: getStoredCasesPageForEmpresa | Próprios | Usuário autenticado + filtro validado por backend | created_by pode ser usuarios.id **ou** auth_user_id |
| /processos — lista empresarial | Next.js: /api/carteira/fast?scope=empresa | Empresa vinculada | Leitura via service_role somente no servidor, tenant derivado do login | Nunca confiar em empresa_id da URL |
| /processos — busca global | Server Action: searchCompanyProcessosAction | Empresa vinculada | RPC buscar_carteira_empresa_rapido via servidor | CNJ, cliente, telefone e advogado: não limitar à página em cache |
| Scanner local Full / Híbrido | Server Action: fetchScannerQueueAction | Empresa vinculada | service_role apenas servidor, tenant autenticado | Buscar e confirmar contagem completa ANTES de iniciar; sem fallback para lista em cache |
| Scanner em nuvem | /api/datajud-trigger e cloud-scan-batch | Empresa autenticada | Dados no servidor e worker | Controlar carga, não transformar consulta externa falha em sucesso |
| KPIs de /processos | /api/carteira/indicadores | Empresa | RPC lexis_portfolio_snapshot com empresa validada | Fonte única, nunca deduzir a partir da página 1 |
| KPIs pessoais e de equipe | /api/carteira/fast e /report | Próprios ou empresa autorizada | RPCs parametrizadas com IDs validados; service_role só backend | Não mostrar zeros quando a função de agregação falhar |
| /tarefas e /vencidos | Server Actions/HTTP tenant-scoped | Próprios e operações autorizadas | RLS onde o navegador precisa acessar; servidor usa contexto validado | Não confundir vencido operacional com prazo processual |
| /whatsapp | Server Actions, worker autenticado ou deep link | Contatos autorizados | service_role exclusivamente no servidor | Não registrar envio sem confirmação da ponte/canal |
| /report/completo e PDF | Next.js middleware e API | Somente supervisão no consolidado | Gate de perfil no servidor | Download e dados de equipe nunca dependem só de botão oculto |
| CRM/financeiro/documentos | Ações de servidor + tabelas RLS | Empresa/cargo | Tenant + perfil + ação explícita | Escrita não pode ser liberada somente por autenticação |

## Regra principal

RLS fica **ligada** em tabelas expostas. Não se criam políticas permissivas ALL/USING(true)
para "destravar" consultas. O backend da Vercel pode usar uma conta técnica somente
depois de confirmar identidade, empresa, papel e operação, filtrar pelos dados
declarados e devolver o subconjunto permitido. A chave técnica nunca vai ao navegador.

Tabelas internas (índice de mérito, filas WA.Auto, auditoria, controles técnicos)
com RLS e **0 políticas** podem ser intencionalmente internas: não abrir acesso
direto só para remover aviso do auditor. Caso uma tela precise dados, construir
leitura autenticada no servidor, em vez de conceder ALL ao usuário.

## Pontos corrigidos neste lote

- Dois formatos reais de created_by: banco contém 1.176 linhas com auth_user_id
  e 1.472 com usuarios.id. Ambas precisam aparecer na carteira do MESMO usuário.
- getStoredCasesPageForEmpresa e getStoredCasesForEmpresa usam os dois UUIDs
  verificados pelo contexto do servidor; não aceitam ownerId arbitrário do navegador.
- Scanner exige fila remota completa e verificação de total antes de processar.
- Scanner não trata registros em memória como carteira atual se a fonte confirmada
  não retornar processos.
- A API paginada não substitui falha de snapshot por zero ou contagem da primeira página.

## Verificação segura em ambiente real

1. Ler total no banco vs RPC lexis_portfolio_snapshot com p_owner nulo:
   os valores devem coincidir.
2. Ler carteira de Administrador com ambas as representações de owner,
   comparar a soma com RPC de proprietário e com a listagem paginada.
3. Confirmar com papel Visualizador que nenhuma escrita é permitida,
   sem simular criação/remoção em produção.
4. Confirmar fila scanner com contagem do mesmo tenant e nenhuma perda por página.
5. Buscar por CNJ fora da primeira página, sem forçar filtros de dono.
6. KPIs falhando devem retornar erro explícito/indisponível, não zeros falsos.
7. Conferir tabelas com zero policies; não conceder direitos apenas para melhorar UX.
8. Testar modo de usuário/servidor com JWT verdadeiro em sessão autorizada.
9. Scanner jurídico ainda depende de DataJud/DJEN, rede e limites do tribunal:
   fila completa NÃO garante retorno oficial de todos os CNJs.

As verificações de SQL em nível de serviço não substituem testes de navegador
com operadores reais autenticados. Não registrar nome, CPF, telefone ou CNJ nos
logs de diagnóstico.
