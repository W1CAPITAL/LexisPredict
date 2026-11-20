# Operações integradas — lotes 2 a 8

**LexisPredict · 12 de novembro de 2026**  
**Interface:** \`/operacoes-integradas\`  
**Entrega:** parte do PR #176, a partir da auditoria dos seis arquivos IA Infinitum.

## Lote 2 — Fluxos colaborativos

- Etapas associadas a processos existentes da **própria empresa**.
- Campos: título, instrução, categoria, responsável, prioridade, status, evidência e data operacional opcional.
- Ações de iniciar, concluir e reabrir.
- Chave única por \`empresa_id+cnj+step_key\`, para evitar tarefas duplicadas.
- Gerador de etapas derivadas do motor de evidências \`legal-workflow\`; execução somente por clique do operador.
- Importação de sugestões sem sobrescrever etapas abertas nem criar datas de prazo.
- Registro de todas as alterações na auditoria.

**Limite:** estas etapas não substituem as tarefas e os prazos judiciais oficiais do Lexis; são checklists jurídicos colaborativos adicionais.

## Lote 3 — WhatsApp compartilhado

- Fila de contatos por telefone, status, CNJ, nome e responsável.
- Estados: não atribuído, em atendimento, aguardando, encerrado.
- Atribuição, transferência e registro de notas internas no log.
- Importação **manual** dos contatos confirmados de \`whatsapp_messages\` de uma empresa, sem copiar o conteúdo.
- O terminal de envio WhatsApp original é mantido e continua responsável pelo envio; essa nova fila não dispara mensagens.
- Somente metadados operacionais são persistidos.

**Limite:** não há webhook de mensagens criando/atribuindo as filas instantaneamente. A importação de contatos é por clique. O estado não deve ser apresentado como leitura ao vivo do provedor.

## Lote 4 — Estúdio e versões de agentes

- Cadastro de agentes por nome, slug, instruções, ferramentas autorizadas e limite.
- Ferramentas autorizadas: \`read_case\`, \`suggest_tasks\`, \`draft_message\`, \`lookup_official\`.
- Versionamento, testes e publicação atômica de somente uma versão.
- O banco impede publicar uma versão não testada.
- Execução manual contra processo confirmado da mesma empresa; roteiro determinístico do motor jurídico.
- Rascunho de IA opcional, **somente com clique do operador**, sem ferramentas de envio/edição.
- Auditoria com motor manual e flag de uso de IA.

**Limite:** é um motor de configuração e execução limitada. Não é um sistema de ferramentas arbitrárias ou de execução autônoma de atividades externas.

## Lote 5 — Formulários, anexos e validação

- Formulários públicos com token criptograficamente aleatório (32 bytes); o banco guarda apenas SHA-256 do token.
- Validade entre 1 e 90 dias, limite de respostas, revogação.
- Campos configuráveis: texto, e-mail, telefone, texto longo.
- Validação server-side de tipo, tamanho, obrigatoriedade e campos inesperados.
- Consentimento explícito antes do envio e carimbo de data/hora.
- Rate limit por formulário e fingerprint de rede em hash, sem armazenar IP.
- Anexos privados: até dois arquivos, cada um até 4 MB, tipos PDF, PNG ou JPEG e conferência de assinatura de arquivo.
- URLs de leitura assinadas com validade curta, liberadas apenas em ação autenticada de revisão.

**Limites:** a versão inicial recebe arquivos e respostas; associação a processo, OCR e automação de petições continuam sob revisão humana nos módulos já existentes. Não há protocolo automático.

## Lote 6 — Permissões e auditoria

- Matriz de permissões baseadas no cargo e overrides explícitos por pessoa.
- **\`permissions.manage\` não pode ser concedida por override**.
- Server Actions verificam identidade por Supabase Auth, empresa do usuário e concessões no banco; ignoram empresa_id enviado pelo navegador.
- Mutations usam service role exclusivamente no servidor com escopo por empresa.
- Tabelas novas com RLS; revogadas permissões \`anon\` e \`authenticated\` de escrita. Algumas tabelas permitem somente leitura por usuário autenticado da própria empresa; dados sensíveis são exclusivamente server-side.
- Auditoria contém ator, empresa, objeto, evento, data e detalhes permitidos.

## Lote 7 — Ligação e transcrição

- Registro manual de ligações de entrada/saída, resultado, operador, telefone, CNJ e observações.
- Texto transcrito só é aceito com consentimento de gravação/transcrição registrado.
- Registro e transcript separados por permissão, consulta por empresa.
- **Não** foi adicionado um provedor de telefonia ao vivo nem iniciadas gravações automáticas, porque isso exige uma conta/provedor autorizado e configuração própria. A interface identifica a origem como \`manual\`.

## Lote 8 — Saúde das integrações

- Verificação explícita e registro em banco por provedor: DataJud, DJEN, WhatsApp local, Google Calendar e motores de IA.
- Estado mostra \`configurado\`, \`nao_configurado\`, \`desconhecido\` ou \`falhou\`.
- Consulta dados reais **já armazenados**: últimos timestamps dos tribunais, sessão do bridge, conexões OAuth do usuário e existência de configuração de IA.
- Não afirma conexão em tempo real nem disponibilidade confirmada quando apenas uma variável/chave existe.
- Histórico de checagens para a empresa e auditoria do operador.

**Limite:** o painel ainda não monitora todos os provedores automaticamente, nem implementa fila própria de importações. Devem-se usar os scanners e importadores Lexis já existentes para execução.

## Arquitetura de segurança

Tabelas novas:
\`lexis_ops_workflows\`, \`lexis_ops_inbox\`, \`lexis_ops_agents\`,
\`lexis_ops_forms\`, \`lexis_ops_submissions\`, \`lexis_ops_intake_limits\`,
\`lexis_ops_calls\`, \`lexis_ops_integrations\`, \`lexis_ops_grants\` e
\`lexis_ops_audit\`.

Funções de banco:
- \`lexis_ops_publish_agent\`: publica versão testada em transação.
- \`lexis_ops_intake_slot\`: controla quota de envios.
- \`lexis_ops_submit_intake\`: valida token, expiração e quota, grava submissão em transação.

**Storage**: \`lexis-intake-private\` privado. Não conceder acesso público ao bucket nem tornar seus objetos navegáveis.

## Publicação e verificação

1. Executar \`pnpm run typecheck\`, \`pnpm test\`, \`pnpm run commercial:check\`, testes WA.Auto e \`pnpm run build\` pelo CI do GitHub.
2. Confirmar o projeto Supabase de destino **correspondente ao ambiente real do Lexis**.
3. Aplicar a migração \`20261112213000_lexis_ops_suite_lotes_2_8.sql\` nesse projeto, verificando tabelas, RLS e funções. Não aplicar em banco não identificado.
4. Testar criação de formulário e acesso anônimo com token/expiração; testar leitura e negação entre duas empresas.
5. Testar transação de publicação de agente e gravação de checklist e auditoria.
6. Mesclar o PR depois dos testes; observar build e deploy de produção.
7. Se houver falha, não mascarar status nem enviar mensagens, e reverter o código sem apagar tabelas/dados existentes.

## Não afirmar que está pronto antes de validar

- Deploy de produção não é o mesmo que teste de código no CI.
- Integração real de telefonia e transcrição ao vivo não está conectada por essa entrega.
- Resumos DJEN/DataJud ainda precisam da publicação ou fonte oficial antes de qualquer comunicação.
- Submissão de um formulário não cria processo nem inicia contato automático.
