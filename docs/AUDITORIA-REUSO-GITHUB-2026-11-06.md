# Auditoria de reuso de repositórios para LexisPredict — 06/11/2026

## Escopo e critérios

Inventário dos URLs fornecidos pelo usuário. Avaliação por metadados públicos, estrutura/README de projetos selecionados, inspeção da implementação atual do LexisPredict e revisão pontual de código de referência. **Não é auditoria de segurança completa de todos os terceiros**, nem aprovação automática de implantação. As licenças assinaladas são as identificadas no GitHub durante a triagem; licença não informada no metadado deve ser conferida no repositório e nos arquivos antes de copiar código.

Critérios: utilidade jurídica real, maturidade, licença compatível com software proprietário, segurança/LGPD, requisitos de APIs e infraestrutura, não duplicar o que Lexis já tem, possibilidade de testes e reversibilidade.

## Mudanças efetivamente desenvolvidas nesta branch

- Corrige `src/lib/cnj-higiene.ts`: dígito verificador CNJ (Resolução 65/2008), concatenando **00** antes de calcular módulo 97. Corrige rejeição de CNJs legítimos.
- Testes de regressão `src/lib/cnj-higiene.test.ts` com dois números de exemplo públicos retirados de `tests/test_cnj.py` do MAAT.
- `src/lib/oab-discovery.ts`: importa texto colado do portal, extrai números CNJ, valida dígito/estrutura, deduplica e sinaliza truncamento; não consulta certificado nem resolve CAPTCHA.
- `src/components/scanner/oab-discovery-panel.tsx`: painel na página `/consulta-oab` com links dos portais, copiar/baixar TXT. Os dados digitados permanecem no navegador; não são inseridos automaticamente na carteira.
- Atribuição e licença MIT em `docs/THIRD_PARTY_OAB_MAAT.md`.

### Limites indispensáveis

**DataJud público não fornece pesquisa universal por OAB/nome do advogado.** Consulta por OAB precisa de portais oficiais ou fornecedor autorizado. A ausência no DataJud/DJEN/carteira não comprova inexistência de processo. O painel desenvolvido é **descoberta assistida**, não integração com certificado. Certificados A1/A3 em PJeOffice, VIDaaS, Bird ID ou Windows exigem autenticação no portal e aplicativo autorizado; não se pode capturar PIN, cookies, sessão, nem contornar CAPTCHA.

## Inventário — maior prioridade

| Código e origem | Decisão | Reuso concreto e ressalva |
| --- | --- | --- |
| [MAAT Monitor](https://github.com/Dramorimrodrigues/maat-monitor) — MIT | **Implementado parcialmente** | Algoritmo CNJ, descoberta por OAB via colagem, heurística de radar de novidades; não copiar monitor Python/SQLite inteiro para Next.js |
| [AuditorProcessual](https://github.com/lucianumm/AuditorProcessual) — MIT | **Avaliar integração** | Matriz de fatos/provas/teses, pesquisa oficial verificada, versionamento de peças; manter validação humana |
| [Judicex](https://github.com/JustVugg/judicex) — Apache-2.0 | **Avaliar integração** | RAG com evidências, verificadores e rastreabilidade; Python como worker opcional, sem migrar CRM |
| [claude-for-legal](https://github.com/anthropics/claude-for-legal) — Apache-2.0 | **Adaptar workflows** | Roteiros de revisão, diligência, contratos, contencioso; localizar para legislação brasileira e revisão de advogado |
| [legal-br](https://github.com/manfredjr/legal-br) — MIT | **Adaptar workflows** | LGPD, direito do consumidor/digital, consultas a bases oficiais; validar conteúdo jurídico |
| [bug-frame](https://github.com/vmatheus3/bug-frame) — MIT | **Experimento controlado** | Captura de bug visual e contexto para equipe técnica; exigir login, permissão, mascarar dados de clientes e logs |
| [agente-dra-julia-advocacia](https://github.com/JeffersonMFti/agente-dra-julia-advocacia) — MIT | **Adaptar workflows** | Webhook verificado, anti-replay, triagem documentos/áudio, revisão humana antes de qualquer mensagem |
| [google-calendar-mcp](https://github.com/nspady/google-calendar-mcp) — MIT | **Referência, não embutir MCP** | Contas múltiplas, timezone e testes de OAuth; Lexis já dispõe de endpoint OAuth e eventos |
| [General-Legal/legal-templates](https://github.com/General-Legal/legal-templates) — CC0 | **Exemplos, não peças prontas** | Estrutura de minutas, revisão para Brasil, competência e requisitos de cada tribunal |
| [awesome-n8n-templates](https://github.com/enescingoz/awesome-n8n-templates) — licença a conferir | **Workflows selecionados** | Somente JSONs aprovados, em instância n8n isolada, validar credenciais e licenças por arquivo |
| [OmniCloud](https://github.com/dimartarmizi/OmniCloud) — MIT | **Fase futura** | Adaptadores de provedores de drive; não unificar tokens sem isolamento por empresa |

## Inventário — análise jurídica, bases de dados, CRMs

| Projeto | Decisão | Motivo |
| --- | --- | --- |
| [dadosjusbr/api](https://github.com/dadosjusbr/api) | Referência setorial | Dados administrativos/remuneratórios do Judiciário, **não** motor de autos |
| [jusbrasil/op-cliente](https://github.com/jusbrasil/op-cliente) | Referência apenas | Cliente Digesto, projeto arquivado e API comercial dependente de autorização |
| [okfn-brasil/open-jus](https://github.com/okfn-brasil/open-jus) | Não integrar | LGPL-3.0, arquivado, dados financeiros de Justiça e arquitetura antiga |
| [claujs/buscaprocessos-api](https://github.com/claujs/buscaprocessos-api) | Provedor opcional | Repositório de documentação de **API comercial** de intimação OAB/processos, exige chave e condições comerciais |
| [felCardoso/LexManager](https://github.com/felCardoso/LexManager) | Não copiar | CRM Flask redundante e licença a conferir |
| [neimaciel/crm-juridico](https://github.com/neimaciel/crm-juridico) | Não copiar | Protótipo CRM redundante, licença a conferir |
| [DevCaioSouza/CRM-Advocacia-Freelancer](https://github.com/DevCaioSouza/CRM-Advocacia-Freelancer) | Não copiar | CRM TypeScript redundante, licença a conferir |
| [Andersonfrfilho/ai-legal-assistant](https://github.com/Andersonfrfilho/ai-legal-assistant) | Pesquisa | Avaliar testes, licença e veracidade antes de adaptar |
| [devfullcycle/techweekia9-multi-agents-rag](https://github.com/devfullcycle/techweekia9-multi-agents-rag) | Conceito | RAG multiagentes experimental; dados isolados por escritório |
| [rogeriotravagin/escritorio-ia](https://github.com/rogeriotravagin/escritorio-ia) | Conceito | Fluxo de agentes jurídicos, licença não confirmada |
| [llSourcell/InstantLegalDotAI](https://github.com/llSourcell/InstantLegalDotAI) | Referência | Gerador genérico de documentos jurídicos, requer localização |
| [jespimentel/ia_e_justica_criminal](https://github.com/jespimentel/ia_e_justica_criminal) | Não integrar | Material de aula, não módulo operacional |
| [araguaci/lawfare-timeline](https://github.com/araguaci/lawfare-timeline) | Não integrar | Portal cronológico de notícias, não processo do cliente |
| [juridico-create/extensao_jusbrasil](https://github.com/juridico-create/extensao_jusbrasil) | Não copiar | Extensão de extração de terceiros, licença/permissão do site a conferir |
| [RamosJSouza/extensao_jusbrasil](https://github.com/RamosJSouza/extensao_jusbrasil) | Não copiar | Mesmo tipo de extensão e riscos de autenticação/termos |
| [Guilhermesena-dev/CONSULTA_API_JUSBR](https://github.com/Guilhermesena-dev/CONSULTA_API_JUSBR) | Avaliação posterior | Cliente não-oficial; requer documentação de contrato/licença da API |
| [rusakovichma/jusbrelay](https://github.com/rusakovichma/jusbrelay) | Descartado | Driver de dispositivos USB relay; não tem relação com Jusbrasil |

## Inventário — integrações, nuvem, produtividade e tecnologia

| Projeto | Decisão | Motivo |
| --- | --- | --- |
| [DevLucasLourenco/AllWhatsPy](https://github.com/DevLucasLourenco/AllWhatsPy) | Evitar produção | Selenium sobre WhatsApp Web é frágil; preferir canais autorizados e confirmação de envio |
| [ellencrist/Save-Organize-Email-Files](https://github.com/ellencrist/Save-Organize-Email-Files) | Conceito | Outlook, não Gmail; usar Gmail OAuth/API, sem baixar anexos indiscriminadamente |
| [GuilhermeVideira/Projeto-Automacao-de-Processos](https://github.com/GuilhermeVideira/Projeto-Automacao-de-Processos) | Referência | Automação genérica Python, sem vantagem clara sobre fluxos atuais |
| [henriquetourinho/batedor](https://github.com/henriquetourinho/batedor) — GPL-3.0 | Referência, não copiar | Monitor Linux separado; incompatibilidade provável com produto proprietário |
| [mateuscacabuenaPUCRS/FundamentosProcessamentoParaleloDistribuido](https://github.com/mateuscacabuenaPUCRS/FundamentosProcessamentoParaleloDistribuido) | Não integrar | Exercícios acadêmicos paralelismo, não produto |
| [hypit-ai/hypit](https://github.com/hypit-ai/hypit) | Não integrar | Conteúdo de marketing/alteração de vídeos, licença não confirmada |
| [routatic/proxy](https://github.com/routatic/proxy) — AGPL-3.0 | Não integrar | Roteador LLM sob AGPL, complexidade/licenciamento e credenciais |
| [ebouther/opencode-unlimited-proxy](https://github.com/ebouther/opencode-unlimited-proxy) | Não integrar | Proposta de rotacionar IP para superar 403/limites do provedor |
| [FishBottle7/opencode2dsh](https://github.com/FishBottle7/opencode2dsh) | Não integrar | Plugin de modelos gratuitos, não backend jurídico estável |
| [qybaihe/bla](https://github.com/qybaihe/bla) | Não integrar | Defesa adversarial por confusão de agentes, risco à confiabilidade |
| [franklinbaldo/leandro](https://github.com/franklinbaldo/leandro) — MIT | Pesquisa | Formalização Lean4 de normas jurídicas, experimental |
| [ai-to-ai/auto-gmail-creator](https://github.com/ai-to-ai/auto-gmail-creator) | Não integrar | Criação massiva de contas; sem necessidade legítima operacional |
| [ShadowHackrs/gmail-account-creator](https://github.com/ShadowHackrs/gmail-account-creator) | Não integrar | Contorno de verificações Google, risco de bloqueio/abuso |
| [kkris0/auth-memory](https://github.com/kkris0/auth-memory) — MIT | Não integrar | Extensão para lembrar conta Google em sites, não substitui OAuth |
| [adhocore/goic](https://github.com/adhocore/goic) — MIT | Não integrar | OIDC em Go não é necessário na pilha Next.js atual |
| [Jawad-Jamil/Sign-in-with-google](https://github.com/Jawad-Jamil/Sign-in-with-google) | Não integrar | Tutorial de autenticação com armazenamento local inseguro para tokens |
| [sourcecodebd/React-Firebase-oAuth-with-localStorage](https://github.com/sourcecodebd/React-Firebase-oAuth-with-localStorage) | Não integrar | Tutorial antigo/redudante, padrões de auth incompatíveis |
| [Prakashsaw/Expense-Management-System](https://github.com/Prakashsaw/Expense-Management-System) | Não integrar | Financeiro MERN genérico, duplicaria estrutura e permissões |
| [api-evangelist/asaas](https://github.com/api-evangelist/asaas) | Referência | Catálogo não oficial da API; usar documentação oficial Asaas |
| [jrolfs/google-calendar-amf](https://github.com/jrolfs/google-calendar-amf) | Não integrar | Exemplo legado AppEngine/Flex/AMF (2012) |
| [xixianloux/google-account-automanager](https://github.com/xixianloux/google-account-automanager) | Não integrar | Automação de contas não resolve integração de calendário |
| [c-herrmann206738739/gemini-advanced-setup-guide](https://github.com/c-herrmann206738739/gemini-advanced-setup-guide) | Não integrar | Guia de assinatura, não componente confiável de produção |
| [Data-Horde/gdrivac](https://github.com/Data-Horde/gdrivac) | Não integrar | Script de reparação de links Drive de 2021 |

## Outros links fornecidos

- [Organização jusbrasil](https://github.com/jusbrasil): explorar apenas clientes e SDKs com contratos de API verificáveis; GitHub não concede licença de acesso à plataforma comercial.
- [Organização Mika-Project](https://github.com/Mika-Project): sem relação prática com CRM jurídico.
- [Organização Liquid4All](https://github.com/Liquid4All): somente estudo de modelos pequenos e custo de inferência, caso surja demanda.
- [Organização asaasdev](https://github.com/asaasdev): referências oficiais/SDK; priorizar a documentação oficial de API Asaas.
- [Issue vLLM #64645](https://github.com/vllm-project/vllm/issues/64645): acompanhar como proposta/compatibilidade, não base de implantação.
- [Marketplace Google Workspace user para GitHub Org](https://github.com/marketplace/actions/google-workspace-user-to-github-org-user): automação de identidade GitHub, não agenda de clientes.
- [Marketplace Sync GitHub to Google Calendar](https://github.com/marketplace/sync-github-to-google-calendar): eventos de repositório, não compromissos processuais.
- [Tópico google-calendar-api](https://github.com/topics/google-calendar-api): índice, não dependência instalável.

## Integração por ondas

1. **Correção de integridade:** rodar testes de regressão CNJ, suite Vitest e typecheck; revisar importações antigas que não conferem DV. Revisar UI de OAB em preview e consolidar atribuição MIT. Não publicar sem avaliação de CI.
2. **Consulta processual:** usar DataJud para CNJs conhecidos; validar DJEN/portais oficiais para publicações; pesquisa OAB apenas nos portais ou por provedor contratado e autorizado; nunca misturar "0 na carteira" com "0 processos no mundo".
3. **Inteligência jurídica com provas:** comparar AuditorProcessual, Judicex e claude-for-legal em lote de casos anonimizados, com citações por parágrafo e prova/contraprova; restringir redação jurídica à aprovação de advogado.
4. **Integrações já existentes:** aprimorar status OAuth Google Calendar e monitoramento de token; no Asaas, verificar no servidor `ASAAS_API_KEY`, ambiente e autorização por empresa. Usar endpoints oficiais, webhooks verificados/idempotentes. Nenhum código do GitHub cria as credenciais ou dispensa o consentimento da conta.
5. **Atendimento/infra:** testar Bugframe em equipe interna com dados privados mascarados; importar no máximo templates n8n revisados, com limites, logs, segurança, rollback e aprovação explícita antes de enviar mensagens.

## Bloqueios e testes antes de merge

- `pnpm test` ou `pnpm exec vitest run src/lib/cnj-higiene.test.ts src/lib/oab-discovery.test.ts`
- `pnpm typecheck` e `pnpm build`
- Teste visual no navegador da página `/consulta-oab` usando caso público sem dados pessoais.
- Isolamento por empresa, RLS e privilégios do financeiro intactos.
- Nenhum acesso silencioso a certificado, PIN, CAPTCHA, sessão judicial ou conta externa.
- Revisão jurídica/manual de qualquer descoberta de processo.

**Situação:** código está nesta branch de revisão. Nenhuma integração externa foi conectada automaticamente, nenhuma configuração de produção foi alterada e nenhum deploy deve ser presumido.


## Rodada 2 — Assinafy, certificados Linux e evolução **sem duplicar abas**

| Repositório | Uso no LexisPredict | Status desta branch |
| --- | --- | --- |
| [flatpak-adv-br](https://github.com/LLawli/flatpak-adv-br), GPL-3.0 | Aplicativo **Linux** para drivers PKCS#11, assinadores e PJeOffice; integração no computador do advogado, não no backend Next.js. VIDaaS permanece não testado/indisponível nesse projeto. Não copiar GPL/instalador para o SaaS. | Link informativo **na personalização OAB existente**, sem instalar nada |
| [assinafy/typescript-sdk](https://github.com/assinafy/typescript-sdk), MIT, pacote `@assinafy/sdk` | Contrato de PDF, limite 25 MiB, multipart `file`, autenticação `X-Api-Key`, `accounts/{account}/documents`, distinção entre upload e assignment. | **Adaptado** em `/api/integracoes/assinafy` sem adicionar pacote/lockfile; fluxo de **preparo apenas**, sem notificação |
| [assinafy/mcp-server](https://github.com/assinafy/mcp-server), MIT | Host remoto com OAuth 2.1 por workspace e ferramentas de assinatura/contratos. | **Não embutir outro servidor** nem inventar conexão sem consentimento do workspace |
| [assinafy/n8n-nodes-assinafy](https://github.com/assinafy/n8n-nodes-assinafy), MIT | Node e Trigger para fluxos n8n de assinaturas e webhooks. | Reservar para instância n8n já autorizada; nenhum fluxo paralelo criado |

### Implementação real na estrutura existente

- `/consulta-oab`: o utilitário de colar números CNJ está **embutido no painel existente `AutosOabFreePanel`**, não é mais outra seção irmã nem uma nova página.
- `/documents/generator`: o editor existente recebe a opção **Assinatura eletrônica · preparar na Assinafy**. PDF gerado pela mesma ação do exportador atual, revisto e confirmado pelo operador; backend verifica autenticação, cargo, empresa permitida, tamanho e `%PDF-`, além de impedir convites automáticos. Retorna ID e status, sem afirmar que alguém assinou.
- `legal-document-generator.ts`: o mesmo editor passa a registrar **Referências das provas e fundamentos** e avisa quando uma narrativa jurídica é criada sem origem identificada. A referência digitada é **não verificada**; não cria nova análise por IA nem substitui análise profissional. Inspirado no fluxo fato→prova→fundamento do AuditorProcessual.
- `OabPersonalizationPanel`: link opcional de compatibilidade Linux do flatpak-adv-br.

### Configuração e limites (não são etapas inventadas como concluídas)

A integração Assinafy só opera com duas credenciais válidas de uma conta e workspace autorizados, em **variáveis privadas de servidor**, e escopo de empresa definido; `ASSINAFY_API_KEY`, `ASSINAFY_ACCOUNT_ID` e, opcionalmente, `ASSINAFY_ALLOWED_EMPRESA_ID` (por padrão apenas empresa principal W1). Nenhuma chave foi criada, descoberta ou inserida na Vercel nesta branch. Nenhum PDF foi enviado pela automação durante o desenvolvimento.

O envio do PDF **não cria assignment**, signatário, assinatura nem convite: para concluir a assinatura, o operador precisa acessar a conta Assinafy e definir essas opções, custos e autorização. Integração OAuth de cliente por empresa, reconciliação de estados e Webhooks com validação de assinatura exigem etapa posterior com consentimento de workspace e armazenamento isolado por tenant. O MCP remoto também exige OAuth explícito e não deve ser usado como atalho para consentimento.

Assinatura em tribunal (PJeOffice/VIDaaS/A3) **não é** a mesma coisa que assinatura eletrônica contratual na Assinafy; as integrações permanecem separadas e identificadas.

### Verificação antes do merge

`pnpm exec vitest run src/lib/cnj-higiene.test.ts src/lib/oab-discovery.test.ts src/lib/documents/assinafy-upload.test.ts src/lib/legal-document-generator.test.ts`; `pnpm run typecheck`; `pnpm run build`. Fazer teste manual na UI e com conta Assinafy de homologação/autorizada antes de prometer transação externa.

## Rodada 3 — Aplicação transversal (sem novas abas ou duplicação de telas)

O usuário reforçou que as melhorias não se limitam à OAB. Esta rodada **usa estruturas que já existem**, sem copiar CRMs inteiros nem criar novos sistemas paralelos.

### Onde funciona

| Camada atual | Melhoria transversal | Limite observável |
| --- | --- | --- |
| Ctrl+K global (component \`lexis-command-palette\`) | Busca Assinafy, PDF, evidências, OAB, PJeOffice, calendário, Asaas, CRM, relatórios; atalho para CNJ com DV válido | Abre a rota existente, não faz consulta judicial nem exibe processo sem permissão; usa filtros de plano/operador |
| Menu vertical/móvel e dock | Busca por palavras da capacidade, usando mesmo índice de \`app-route-search.ts\` | Mantém visibilidade de acordo com plano/perfil do menu |
| Processos e carteira | Atalho de CNJ detecta a rota da carteira conforme acesso (\`/cases\` ou \`/processos\`) | Não garante que exista registro; a consulta ainda depende de escopo |
| Documentos | O hub \`/documents\` destaca a mesma central de peças e preparo Assinafy; \`/documents/generator\` concentra a criação e validação | Não duplica editor, não envia convite de assinatura automaticamente |
| Integrações | O estado de Assinafy aparece no resumo existente \`/integracoes\` com link para o editor de documentos | Só indica disponível com credencial de servidor e autorização administrativa da empresa |
| IA / Superagente | Usa instrução de rastreabilidade compartilhada de \`truth-policy.ts\` | Não comprova fontes não consultadas pela ferramenta |
| Agentes para CRM, processos, relatórios, documentos e gestão | \`recommendAgentTeamForRoute\` acrescenta o mesmo critério de evidências aos checks dos playbooks | Critério de planejamento; **não reescreve** automaticamente dados ou relatórios históricos |
| Gerador de peças | \`warningsFor\` lê a validação de rastreabilidade da política central | Fonte anotada pelo operador continua **não verificada**, não afirma pesquisa oficial |

### Arquitetura

- \`src/lib/app-route-search.ts\` contém apenas metadados/aliases para **rotas já existentes** e busca CNJ formatado com validação; sem API, segredo ou banco.
- \`src/lib/truth-policy.ts\` é a política central de origem e grau de certeza; reutilizada pelas peças, prompt de agentes e playbooks multi-rota.
- \`src/app/api/integracoes/status/route.ts\` mantém consulta somente leitura do estado de provedores; não retorna tokens.
- \`src/components/system/client-chrome.tsx\` monta a paleta global sem aguardar os serviços de segundo plano; a navegação móvel preserva seu menu próprio.

### Não implementado nesta rodada

- Não houve implantação de Judicex ou AuditorProcessual como novo backend Python, nem RAG em todos os processos; reuso de política de provas é incremental.
- Não houve instalação de cliente Flatpak em máquinas dos advogados.
- Não houve conexão OAuth automática da Assinafy, nem criação de signatários, assinaturas, convites, contratos ou webhooks.
- Dados históricos de CRM, relatórios e processos não foram reprocessados.

### Critério de pronto

CI completo (TypeScript + Vitest + build); conferir menu móvel, Ctrl+K, isolamento por plano/empresa, ausência de novas abas e ações externas somente por confirmação humana. PR permanece em rascunho até validação da experiência real e, para Assinafy, acesso autorizado.
