# Processos Command Center — integração e proveniência

## Objetivo

A rota `/processos` usa o mock 4K do Command Center como referência visual, mas mantém os dados e regras reais do LexisPredict.

Princípios:

- densidade analítica sem esconder ações;
- DataJud e DJEN continuam sendo fontes oficiais de metadados/publicações públicas;
- carteira, atendimento, responsável e próximo retorno continuam vindo do banco da empresa;
- nenhuma informação de crawler é tratada como oficial sem validação;
- KPIs de carteira inteira devem ser distinguidos de métricas calculadas apenas sobre a amostra carregada;
- isolamento por `empresa_id` e regras de dono/atendimento permanecem no backend existente.

## Repositórios avaliados

### meneguinha/judEX

Útil:
- filtros por tribunal, grau, classe, assunto, município e período;
- campos DataJud como órgão julgador, sistema, quantidade/último movimento;
- exportação CSV compatível com Excel, Power BI e Tableau;
- preocupação com rate limit.

Aplicado:
- filtro analítico multi-eixo;
- tabela densa com metadados judiciais;
- exportação CSV reutilizada como ponte de BI.

Não copiado:
- Streamlit/Python, pois LexisPredict já é Next.js/Vercel;
- lógica que duplicaria o cliente DataJud existente.

### sobeitnow0/extensao-djen-advogado

Útil:
- radar de urgência por palavras críticas;
- leitura focada de publicação;
- prazo/tarefa por comunicação;
- integração de agenda/mensageria como fluxo operacional.

Aplicado:
- Radar DJEN no painel lateral para penhora/bloqueio, liminar/tutela, audiência, intimação/prazo, sentença e trânsito/baixa;
- publicação DJEN acessível no processo selecionado;
- alerta de comunicação ainda não tratada;
- próximo retorno/atendimento como ação principal.

Não copiado:
- armazenamento local da extensão; LexisPredict usa isolamento por empresa e trilha de auditoria;
- gamificação.

### DeHor-Labs/mcp-juridico-brasil

Útil:
- separação clara entre busca, movimentações, resumo, monitoramento e prazo;
- conceito de snapshot/monitoramento;
- cobertura ampla DataJud;
- calendário/prazo como subsistema independente.

Aplicado:
- tabs separadas para Visão, Movimentos, Documentos/Fonte e IA;
- timeline com DataJud + DJEN + atendimento;
- frescor da consulta visível;
- silêncio processual e risco operacional calculados separadamente.

Não copiado:
- servidor MCP Python; o LexisPredict já possui APIs/actions TypeScript e scanner Vercel.

### PietroTamanini/API-consulta-OAB

Útil:
- validação de advogado via CNA/OAB;
- ideia de cache para evitar consultas repetidas.

Aplicado:
- painel de Partes mostra OAB quando presente e oferece consulta oficial CNA.

Não copiado:
- Playwright/reCAPTCHA/MySQL local;
- tentativa de contornar mecanismos anti-bot.

### RafaFreitasDev/processos-pje

Útil:
- busca de processos por OAB como estratégia de descoberta;
- PJe como origem/sistema processual importante.

Aplicado:
- filtro por sistema processual (PJe/Projudi/eProc etc. quando DataJud fornece o campo);
- sistema aparece na aba Documentos/Fonte.

Não copiado:
- automação Chrome/Python dependente de máquina local.

### jespimentel/crawler_sg

Útil:
- detecção de mudança por comparação/snapshot;
- descoberta por parte/OAB no TJSP 2º grau.

Aplicado conceitualmente:
- destaque de novidade após último retorno e mudança no tribunal já existente no LexisPredict;
- busca empresarial continua cobrindo cliente/CNJ/advogado.

Não copiado:
- scraping por tags HTML do eSAJ, reconhecidamente frágil pelo próprio projeto.

### Autom8AI/Open-Higgsfield-AI

Útil para UX:
- studio escuro de alta densidade;
- controles adaptativos;
- histórico/estado visível;
- responsividade;
- separação de controles primários e contexto.

Aplicado:
- estética dark glass/command-center;
- toolbar compacta;
- filtros em duas camadas;
- tabela + inspector lateral;
- tabs contextuais;
- charts sem tirar espaço da operação.

Não copiado:
- providers de imagem/vídeo ou MuAPI; não são necessários à página de processos.

## Layout final

### KPIs
- Processos
- Ativos
- Sem andamento
- Vencidos
- Silêncio +45 dias
- Risco alto / novidades

`Processos`, `Ativos` e `Vencidos` podem usar contagens da carteira inteira vindas do backend. Métricas derivadas da lista carregada exibem essa limitação no próprio card.

### Filtros
- tribunal
- classe
- assunto
- município
- grau
- sistema
- situação
- risco
- período de ajuizamento
- B.A. real
- silêncio >=45d
- busca livre CNJ/cliente/advogado/tribunal/assunto

### Tabela
- CNJ
- cliente
- tribunal
- classe
- assunto
- órgão julgador
- município
- ajuizamento
- última atualização
- último movimento
- dias sem andamento
- situação
- risco
- responsável
- próximo retorno

### Inspector lateral

Tabs:
1. **Visão** — resumo operacional, alertas, próximos passos;
2. **Movimentos** — timeline DataJud/DJEN/atendimento;
3. **Partes** — cliente, parte passiva, advogado, escritório e OAB;
4. **Docs** — dossiê PDF, DJEN, consulta externa, origem e frescor;
5. **IA** — parecer persistido quando existir, ou análise operacional transparente + atalhos para Veredito/Relatório.

## Guardrails

- Não inferir que ausência de movimento no cache significa ausência no tribunal.
- Não chamar cálculo determinístico de "IA" quando nenhum modelo foi executado.
- Não expor CPF completo no inspector.
- Não persistir scraper frágil como fonte primária.
- Não misturar dono (`created_by`) com atendente (`atendido_por`).
- Não remover `empresa_id` das consultas.
- DataJud não fornece documentos/petições completos; a UI não deve sugerir o contrário.


## Evolução v2 — Command Center de análise extrema

Implementado na rota `/processos`:

- **Presets rápidos de análise:** Todos, Urgentes, Prazos/retornos, Radar DJEN, Novidades, Silêncio +45d e B.A.;
- **Cobertura das fontes:** DataJud, DJEN, frescor combinado e disponibilidade de snapshot/hash;
- **Frescor por processo:** cada linha mostra se a fonte está atualizada, recente, envelhecida ou não consultada;
- **Snapshot monitorável:** processos com `datajud_hash` ficam identificados para comparação de mudança;
- **OAB dentro do inspector:** consulta CNA pela server action existente, com cache curto de sucessos para reduzir chamadas repetidas e fallback para o portal oficial;
- **Aba Prazos:** separa explicitamente retorno operacional de prazo judicial, evitando converter publicação em prazo fatal sem evidência;
- **Radar operacional:** urgência, status do retorno, silêncio, termos críticos DJEN e frescor da fonte aparecem juntos;
- **Inspector de seis abas:** Visão, Movimentos, Prazos, Partes, Docs e IA;
- **Exportação analítica:** CSV da visão filtrada continua compatível com Excel/Power BI/Tableau;
- **Escopo comercial corrigido:** Administrador permanece no próprio escopo; visão consolidada da empresa é Supervisor/Superadmin.

### Reuso seguro dos novos repositórios avaliados

#### sobeitnow0/extensao-djen-advogado
Reuso:
- conceito de radar por palavras sensíveis;
- organização de prazo/tarefa por publicação;
- foco em leitura operacional de intimação.

Não reuso:
- storage da extensão e gamificação.

#### jespimentel/crawler_sg
Reuso:
- conceito de comparação/snapshot para perceber mudança;
- descoberta por parte/OAB como referência de busca.

Não reuso:
- scraping eSAJ por seletor HTML como fonte primária, pois é frágil e quebra quando o portal muda.

#### PietroTamanini/API-consulta-OAB
Reuso:
- validação por CNA/OAB;
- cache de sucesso para reduzir chamadas repetidas.

Não reuso:
- Playwright/reCAPTCHA/MySQL local ou qualquer tentativa de contornar mecanismo anti-bot.

#### RafaFreitasDev/processos-pje
Reuso:
- PJe como dimensão analítica/sistema processual;
- ideia de descoberta por OAB.

Não reuso:
- Chrome/Python local ou automação dependente da máquina do usuário.

#### DeHor-Labs/mcp-juridico-brasil
Reuso:
- separação entre busca, movimentos, monitoramento/snapshot e prazo;
- cobertura DataJud como fonte primária;
- distinção entre monitoramento e cálculo de prazo.

Não reuso:
- servidor MCP Python dentro do app web; a arquitetura do LexisPredict continua Next.js/TypeScript.

### Regra de proveniência

A tela nunca deve apresentar como equivalentes:
- **DataJud/DJEN:** fontes públicas oficiais;
- **banco da empresa:** operação, atendimento, dono e próximo retorno;
- **snapshot/hash:** evidência de mudança entre consultas;
- **crawler externo:** apoio eventual de descoberta, nunca fonte oficial;
- **IA:** análise/triagem, nunca substituto da fonte processual.



## Evolução v3 — aparência do mock + operação realmente acionável

A referência visual 4K passou a ser tratada como contrato de produto, não apenas inspiração:

- **topo:** ações DataJud/DJEN/CSV/BI/Relatório;
- **faixa de KPIs:** carteira, ativos, vencidos, silêncio, risco e cobertura;
- **presets rápidos:** urgentes, retornos, DJEN, novidades, silêncio, fontes incompletas e B.A.;
- **tabela central:** metadados processuais + operação + risco + frescor;
- **inspector sticky:** visão, movimentos, prazos, partes/OAB, documentos/fontes e IA;
- **rodapé analítico:** distribuição por tribunal, situação e evolução DataJud/DJEN.

### Inteligência operacional determinística

Novo módulo: `src/lib/processos-command-intelligence.ts`.

Ele não inventa parecer jurídico. Ele calcula, a partir do que já existe no processo:

- matriz de fontes;
- lacunas de DataJud/DJEN/sistema/OAB/snapshot/operação;
- cobertura operacional ponderada;
- ações recomendadas;
- avisos de fonte envelhecida;
- prioridade de revisão por novidade pós-retorno, DJEN crítico, silêncio ou retorno vencido.

A tela também reaproveita `gerarTarefasJuridicas()`, portanto o próximo passo mostrado no inspector é compatível com a fila real de Tarefas do LexisPredict.

### Reuso dos repositórios adicionais

#### sobeitnow0/extensao-djen-advogado

Aplicado:
- radar de termos críticos;
- separação entre publicação e tarefa;
- fluxo “ler publicação → decidir ação → registrar retorno/agenda”.

Não aplicado:
- gamificação;
- storage local isolado;
- cálculo automático de prazo fatal a partir de texto sem evidência suficiente.

#### jespimentel/crawler_sg

Aplicado conceitualmente:
- snapshot/hash para detectar mudança;
- filtro de fontes incompletas;
- descoberta por parte/OAB como dimensão de análise.

Não aplicado:
- scraping eSAJ por HTML, por ser frágil e não oficial.

#### PietroTamanini/API-consulta-OAB

Aplicado:
- validação CNA/OAB dentro da aba Partes;
- cache de sucesso já existente para reduzir consultas repetidas;
- fallback explícito para consulta oficial quando cloud/anti-bot impede leitura automática.

Não aplicado:
- Playwright/reCAPTCHA/MySQL local.

#### RafaFreitasDev/processos-pje

Aplicado:
- PJe como dimensão “Sistema processual”;
- sistema processual entra na matriz de fontes e filtros.

Não aplicado:
- automação Chrome/Python dependente de máquina.

#### DeHor-Labs/mcp-juridico-brasil

Aplicado:
- separação entre busca, movimentos, monitoramento/snapshot e prazo;
- conceito de cobertura de fonte por processo;
- DataJud como fonte pública primária;
- monitoramento e prazo são conceitos distintos.

Não aplicado:
- servidor MCP Python dentro do produto web.

### Matriz de proveniência

Cada processo expõe explicitamente:

| Fonte | Categoria | Uso |
|---|---|---|
| DataJud CNJ | oficial | metadados/movimentos públicos |
| DJEN | oficial | comunicações/publicações |
| Sistema processual | oficial/metadado | PJe, eProc, Projudi etc. quando informado |
| CNA/OAB | oficial | validação do representante |
| Snapshot/hash | evidência técnica | detectar diferença entre consultas |
| Carteira/atendimento | operacional | dono, atendimento, próximo retorno |

A cobertura exibida não é “chance jurídica” nem “confiabilidade do mérito”; é somente cobertura operacional das fontes esperadas.

### Guardrail de uso

Uma lacuna de fonte gera uma ação de validação, não uma conclusão.

Exemplo:
- correto: “DJEN não foi consultado nesta visão; revisar fonte”;
- incorreto: “não houve publicação DJEN”.

Da mesma forma:
- “45 dias sem movimento conhecido” não equivale a “45 dias sem movimento no tribunal” sem atualização da fonte.
