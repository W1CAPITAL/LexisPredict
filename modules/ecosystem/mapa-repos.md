# Mapa dos repos citados → LexisPredict

Legenda: N = nucleo do produto · L = lateral (CRM/GTM da assessoria, sem CNJ) · F = fora · R = so referencia de UX/prompt

## GTM e prospeccao

| Repo | Classe | Uso no Lexis |
|---|---|---|
| nando0x/ProspectOS | L/F | Funil, follow-up, PDF de diagnostico e mensagem pronta valem para **cliente que ja chegou** (SAC, Reclame Aqui, indicacao). Nao varrer Maps/Instagram para achar parte de processo. |
| explorium-ai/gtm-skills | L | Market sizing e ICP de **assessorias/escritorios terceiros** que a W1 quer vender o SaaS. Nao enrich de parte processada. |
| getbeton/beton-ai | R | Ideas de playbook de outbound B2B do Lexis como produto, nao da carteira judicial. |
| anthropics/claude-for-financial-advisors | L | Tom de texto para assessoria financeira (quitacao, limpa nome, PROCON). Copiar estrutura de prompt, nao o produto. |

## Chat e prompts

| Repo | Classe | Uso no Lexis |
|---|---|---|
| ChatGPTNextWeb/NextChat, Niek/chatgpt-web, miuuyy/codex-chatgpt-web | R | Layout de thread. O chat interno do Lexis ja existe (`chat_threads`). Nao substituir Fila/Tarefas por ChatGPT web. |
| cactus-compute/needle | R | UX de “achar no meio de texto longo” — aplicar em Auditoria 3D / DJEN HTML sanitizado. |
| f/prompts.chat | R | Biblioteca de prompt. Adaptar 3-5 prompts de rascunho para cliente, tom institucional, sem nome de banco se o switch estiver off. |
| openai/openai-agents-python | L | So se um dia houver agente de **atendimento da fila** com tool oficial (buscar CNJ na carteira, nao na web fria). |

## Observabilidade de agentes

| Repo | Classe | Uso no Lexis |
|---|---|---|
| Arize-ai/openinference | N | Trace do scan e do rascunho (motor, latencia, ok/falha). Sem gravar peca inteira com PII no provedor externo. |
| AgentOps-AI/agentops | N | Mesmo fim. Um dashboard “o Claude/Grok rodou no lote X”. |
| strukto-ai/mirage, TencentCloudADP/youtu-agent | R | Arquitetura de agente. Pesado demais para o gabinete. |

## Browser e teste

| Repo | Classe | Uso no Lexis |
|---|---|---|
| lackeyjb/playwright-skill | N | Teste E2E login, modo seguranca, /tarefas, export XLSX. |
| ultrafunkamsterdam/undetected-chromedriver | F | Nao. Tribunal + stealth = risco juridico e ban. DataJud/DJEN oficiais. |
| CloakHQ/CloakBrowser | F | Idem. |

## Builders / planilha viva

| Repo | Classe | Uso no Lexis |
|---|---|---|
| illacloud/illa-builder, appsmithorg/appsmith | R | Telas internas densas. Nao segundo backend. |
| teableio/teable | L | Modelo mental da planilha operacional (aba Processos/Usuarios). O Lexis ja tem Sheets + Apps Script. |
| HeyPuter/builder | L | Puter no browser (zero token Vercel) so para rascunho opcional, como ja desenhado. |
| quests-org/quests, nexu-io/open-design | R | Onboarding / tutorial do app. |
| cloudflare/notebook-examples, cloudflare/cloudflare-os | L | Workers no Brasil se um dia o DJEN 403 por IP. Nao e prioridade enquanto o scan no app funcionar. |

## Self-improve / ranking

| Repo | Classe | Uso no Lexis |
|---|---|---|
| BerriAI/self-improving-agent, kayba-ai/recursive-improve, PrimeIntellect-ai/prime-agent | R | Loop de “flag errou → humano corrige → regra sobe”. Isso ja e a fila Encerrados a revisar. Nao treinar modelo em dado de cliente. |
| lobehub/awesome-rsi, selfimproving-agent/Awesome-Self-Improving-Agents | R | Lista. Nao clonar. |
| Leonxlnx/taste-skill | R | Gosto visual. Contraste AAA continua mandatorio. |
| xai-org/x-algorithm, twitter/the-algorithm, NextFrontierBuilds/x-algorithm | F | Ranking de feed. No Lexis o ranking e prazo + BA real + silencio. Nao portar algoritmo de rede social. |

## Segundo cerebro (zip do usuario)

Usar a skill `segundo-cerebro` que ja esta instalada. O zip anexo e o harness. Vault em `~/documentos/segundo cerebro`. Nao misturar PII da carteira no vault.
