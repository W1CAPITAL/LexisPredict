# Auditoria de referências externas — IA Infinitum → LexisPredict

**Data:** 12/11/2026  
**Repositório:** `W1CAPITAL/LexisPredict`  
**Base da análise:** `SUPERAGENTE, IA INFINITUM(1).txt` e `PART 1(3).txt` a `PART 5(3).txt`.

## Objetivo

Reaproveitar padrões de produto e funcionalidades que melhorem a operação jurídica do LexisPredict. Os arquivos enviados são principalmente HTML e bundles JavaScript/CSS compilados de outras aplicações; não são uma base-fonte confiável para copiar e colar. A decisão é portar comportamentos e conceitos, reconstruindo-os sobre a arquitetura, os dados, as permissões e os provedores já usados pelo LexisPredict.

O LexisPredict continua sendo uma suíte operacional jurídica. Não deve virar um CRM comercial genérico nem uma cópia da plataforma de referência.

## Inventário dos seis arquivos

| Arquivo | Conteúdo identificado | Decisão |
|---|---|---|
| SUPERAGENTE, IA INFINITUM | Interface de chat, bots, habilidades, modelos, conectores, histórico, uso de tokens e transcrição | Reaproveitar padrões de navegação, estado dos conectores e experiência de agentes |
| PART 1 | SDK LiveKit compilado/minificado | Não copiar o bundle; integrar um provedor de voz apenas por dependência oficial e configuração própria |
| PART 2 | Agenda, calendários, POP/Kanban, chamadas, transcrição, configurações OAB/Publijus, importações e notificações | Adaptar workflows, filas, acompanhamento de importações e eventos |
| PART 3 | Agentes, bancos e registros dinâmicos, campos, notificações, permissões, Google Calendar, chamadas e transcrição | Adaptar modelos de agente, cadastros, permissões e eventos |
| PART 4 | Formulários POP, links públicos, uploads, extração de modelos de petições, agentes IA, WhatsApp compartilhado, filas, mídias, permissões e financeiro | Maior fonte de ideias reutilizáveis, sempre com adaptação jurídica e revisão de segurança |
| PART 5 | Marketplace de leads/contratos, créditos, carrinho e reservas comerciais | Descartar para o núcleo jurídico |

## O que o LexisPredict já possui — não duplicar

O repositório já contém módulos próprios para:

- Processos e carteira empresarial: `/processos`, `/cases` e centro de comando.
- Filas de trabalho: `/tarefas`, `/vencidos` e atividades.
- Audiências e agenda: `/audiencias`, `/agenda` e integração com Google Calendar.
- Notificações: central, contadores e sincronização.
- WhatsApp: terminal vinculado à carteira, WA.Auto, envio controlado, histórico disponível e opt-out.
- Agentes: `/crm/agentes`, catálogo determinístico/IA, fila de rechecks e pesquisador legislativo.
- Estúdio de agentes por rota: `/estudio-agentes`.
- DJEN/DataJud, OAB, scanner, Hermes e veredito.
- Documentos, modelos, geração de peças, cumprimento de sentença e ações próprias de OCR/extração documental (incluindo refinamento opt-in).
- CRM, atividades, funil e financeiro comercial.

Portanto, não criar outra agenda, outra central de notificações, outro scanner ou outro cadastro de processos para reproduzir a referência.

### Lacunas reais encontradas

1. O catálogo de agentes é fixo; ainda não é um construtor completo com versões, testes e publicação.
2. O WhatsApp do Lexis é um terminal ligado à carteira, não uma caixa de entrada de equipe com fila, atribuição e transferência de conversas.
3. O componente `AtividadesChecklist` usa apenas localStorage e não oferece checklist colaborativo entre operadores.
4. Os fluxos jurídicos são distribuídos entre filas, regras e páginas; falta uma biblioteca única de playbooks por evento processual.
5. A gestão de permissões pode evoluir de papéis amplos para permissões por ação, com verificação obrigatória no servidor.
6. Formulários externos de entrada documental ainda precisam de um fluxo próprio de segurança, consentimento, expiração e associação ao processo.
7. O Hermes já possui transcrição textual de reuniões; telefonia e transcrição de chamadas em tempo real ainda dependem de infraestrutura e credenciais próprias e não devem ser simuladas pela interface.

## Classificação funcional

### Incorporar

- Playbooks jurídicos por evento: publicação, audiência, sentença, cumprimento, busca e apreensão, retorno e encerramento.
- Etapas com responsável sugerido, prioridade, evidência exigida e revisão humana.
- Checklists persistentes e compartilhados, com histórico de conclusão.
- Caixa de entrada WhatsApp com filas, atribuição, transferência, notas internas e vínculo com processo.
- Catálogo de agentes com instruções, limites, teste, versão e histórico de execução.
- Formulários de entrada e anexos com validação e trilha de auditoria.
- Permissões por ação, especialmente edição de tarefas de terceiros, arquivos e conversas.
- Estado de conectores, último sucesso, última falha e teste de conexão.
- Acompanhamento de importações e transcrições com estados explícitos: pendente, processando, concluído, falhou e revisão necessária.

### Adaptar, sem copiar literalmente

- POP/Kanban: transformar em fluxos jurídicos, sem substituir o cadastro canônico de processos.
- Bancos dinâmicos: usar apenas para cadastros auxiliares e campos extensíveis; não criar uma segunda fonte da verdade para processos.
- Agentes de atendimento: limitar a leitura da carteira e a produção de rascunhos; nenhuma mensagem externa automática sem autorização.
- Extração de modelos: extrair estrutura e campos de documentos, mas exigir revisão antes de salvar ou protocolar.
- Calendário e lembretes: integrar à agenda atual, preservando origem, fuso horário, link oficial e estado de confirmação.
- Financeiro: aproveitar apenas o que melhora o controle jurídico de custas, honorários, sucumbência e cumprimento; não importar um ERP genérico.

### Descartar

- Marketplace de compra/venda de leads e contratos.
- Carteira de créditos comerciais, carrinho e reservas de leads.
- Funcionalidades de cursos, recrutamento e seleção que não atendam ao fluxo jurídico.
- Dependências e bundles compilados de terceiros copiados diretamente.
- Endpoints, tokens, hosts e credenciais da plataforma de origem.
- Qualquer recurso que exiba estado fictício de conexão, importação, chamada ou automação.

## Lote 1 — entregue nesta branch: agente de fluxo jurídico

Foi acrescentado ao catálogo de `/crm/agentes` o agente **Fluxo jurídico do processo**.

Comportamento:

1. Exige CNJ completo de 20 dígitos.
2. Localiza o processo somente na carteira da empresa autenticada.
3. Não consulta outra empresa nem faz pesquisa externa.
4. Lê os sinais disponíveis no cadastro e organiza um roteiro para:
   - busca e apreensão;
   - nova comunicação DJEN;
   - audiência;
   - sentença procedente, parcial ou improcedente;
   - cumprimento de sentença;
   - retorno operacional vencido ou do dia;
   - movimentação recente;
   - encerramento ou baixa.
5. Exibe prioridade, responsável sugerido, evidência e alertas.
6. Diferencia retorno operacional de prazo processual.
7. Não calcula prazo, não cria tarefa, não altera processo e não envia mensagem.

Testes adicionados para os cenários de DJEN, audiência, sentença, cumprimento, baixa, busca e apreensão com baixa confiança, retorno operacional e saída somente de leitura.

## Próximos lotes recomendados

### Lote 2 — Fluxos jurídicos colaborativos

- Biblioteca de modelos por tipo de processo e evento.
- Checklists por processo compartilhados entre usuários da empresa.
- Responsável, prazo operacional, estado, evidência e observação.
- Histórico de quem concluiu, reabriu ou alterou cada etapa.
- Geração de tarefas sem duplicar tarefas abertas equivalentes.
- Nenhum checklist pode marcar prazo processual como confirmado sem fonte oficial.

### Lote 3 — WhatsApp da equipe

- Filas: não atribuídos, meus atendimentos, equipe e aguardando retorno.
- Atribuir, transferir e devolver atendimento.
- Notas internas separadas das mensagens enviadas ao cliente.
- Associação por telefone validado a cliente e processo.
- Estado de atendimento, não lido, aguardando resposta e encerrado.
- Histórico de ações e operador responsável.
- Respeitar opt-out, limites de envio e janelas de atendimento.
- Preservar a política atual de privacidade: não começar a arquivar conteúdo integral das conversas sem decisão explícita de retenção e proteção. Preferir metadados operacionais e leitura pelo provedor conectado.

### Lote 4 — Estúdio real de agentes

- Modelos jurídicos prontos e editáveis.
- Instruções, ferramentas autorizadas, fontes permitidas e limites por agente.
- Versões e histórico de alterações.
- Teste isolado antes de publicar.
- Aprovação humana para publicação e para ações externas.
- Logs de execução, falhas, latência, modelo e consumo.
- Limite de custo e fallback de modelo por agente.
- Desativação imediata e reversão de versão.

### Lote 5 — Formulários e documentos

- Formulários de entrada por tipo de atendimento.
- Campos obrigatórios e validação.
- Link público com token aleatório, expiração, revogação e uso limitado.
- Upload com validação de tipo, tamanho e integridade.
- Associação ao cliente/processo somente após conferência.
- Evoluir o OCR/extração já existente com progresso visível, estado, erro, evidência e revisão humana; não duplicar o motor atual.
- Política de retenção e acesso por empresa.

### Lote 6 — Permissões granulares e auditoria

- Catálogo de permissões por ação.
- Separar ver, criar, editar, excluir, exportar, atribuir e administrar.
- Permissões específicas para tarefas de terceiros, arquivos e conversas.
- Verificação no servidor em cada ação sensível.
- Auditoria com ator, empresa, objeto, ação, data e resultado.
- RLS e testes de isolamento entre empresas.

### Lote 7 — Telefonia e transcrição

- Provedor de telefonia configurável, sem host fixo da referência.
- Chamadas com estado real e registro de origem/destino.
- Consentimento e aviso de gravação quando aplicável.
- Transcrição com estado de processamento e revisão.
- Associação da transcrição ao atendimento/processo.
- Retenção configurável e acesso restrito.
- Só implementar depois de confirmar provedor, credenciais e custos.

### Lote 8 — Integrações e indicadores

- Painel único de saúde das integrações.
- Última consulta, última sincronização, erro e próxima tentativa.
- Importação com progresso real, paginação e retomada idempotente.
- Indicadores configuráveis por equipe e tipo de processo.
- Exportação auditável, com escopo e filtros explícitos.

## Regras obrigatórias de segurança e qualidade

- Toda leitura e escrita deve respeitar `empresa_id` e identidade autenticada.
- Não expor service role, tokens, cookies ou segredos no navegador.
- Não armazenar tokens em localStorage.
- Não reaproveitar credenciais ou endpoints da aplicação de referência.
- Não usar dados de uma empresa para completar cadastro de outra.
- Não transformar OCR, IA, resumo ou flag em prova de ato judicial.
- Não calcular prazo processual sem fonte, marco inicial e regra de contagem validados.
- Não enviar WhatsApp/e-mail, protocolar peça ou executar ação externa sem autorização explícita.
- Toda nova lógica deve ter teste unitário; mudanças de banco exigem migração, RLS e teste de isolamento.
- Executar typecheck, testes, lint e build antes de integrar à branch principal.

## Estado da entrega

- Branch: `feat/infinitum-reference-batch-20261112`
- Lote 1: implementação e testes adicionados.
- Lotes 2 a 8: especificados e priorizados; não devem ser tratados como implementados.
- Nenhuma alteração foi aplicada diretamente à branch `main` nesta entrega.
