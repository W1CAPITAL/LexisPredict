# Mapa dos repositorios → LexisPredict

Nao clonar tudo no contexto. Usar so a ideia destilada.

## GTM / venda / prospect

| Repo | Uso no Lexis |
|------|----------------|
| nando0x/ProspectOS | Pipeline de prospect B2B, ICP, sequencia de outreach |
| explorium-ai/gtm-skills | Skills de go-to-market reutilizaveis (messaging, cadencia) |
| anthropics/claude-for-financial-advisors | Tom consultivo financeiro (adaptar para assessoria/revisional) |
| Leonxlnx/taste-skill | Criterio de "gosto" em copy — evitar generico |

## Marca d'agua / assets de marketing (uso legitimo)

| Repo | Uso no Lexis |
|------|----------------|
| D-Ogi/WatermarkRemover-AI | Limpar marca de **print de demo proprio** ou mock gerado por IA antes de LinkedIn/README |
| guillaumemeyer/watermarks-remover | Pipeline classico de remocao — batch de screenshots do Lexis |
| ArthRavaneli/removedor-marca-dagua-ia | Referencia em PT; fluxo local sem API cara |
| wiltodelta/remove-ai-watermarks | Foco em watermark de geradores de imagem (Flux/Midjourney etc.) |

**Permitido:** assets que voce criou (print do app, banner, mockup), marca de ferramenta de IA no seu material de venda.  
**Proibido nesta skill:** remover marca de documento de terceiro, PDF de processo alheio, ou conteudo com direitos de outro para republicar.  
**Tokens:** rodar **local / script** (OpenCV, modelo leve). Nao mandar imagem inteira para LLM fronteira so para apagar logo.  
**No fluxo GTM:** Playwright tira print → (opcional) remover watermark de IA → humanizer no texto → post.

## Video / Reels / demos (ver tambem modules/video-gen/)

| Repo | Uso no Lexis |
|------|----------------|
| lcy362/agnes-video-generator | Principal: image-to-video, multi-cena, TTS, legendas — gratuito |
| SurgeBowRetreat/invideo-ai-nexus | Alternativa desktop (script-to-video, photo-to-video) |
| ffmpeg (skill Grok) | Slideshow, Ken Burns, concat, crop 9:16/16:9 — zero token |

**Fluxo padrao de video GTM:** prints proprios → humanizer (roteiro) → Agnes ou ffmpeg → CapCut (polimento opcional) → LinkedIn/Reels.

## Agente / observabilidade / self-improve

| Repo | Uso no Lexis |
|------|----------------|
| openai/openai-agents-python | Padrao de agent + tools (tool = action Lexis) |
| AgentOps-AI/agentops | Log de traces do agente (custo por run) |
| Arize-ai/openinference | Instrumentacao open telemetry de LLM |
| BerriAI/self-improving-agent | Loop de melhoria com feedback |
| kayba-ai/recursive-improve | Melhoria recursiva de prompts com limite |
| PrimeIntellect-ai/prime-agent | Ideias de agente autonomo com budget |
| lobehub/awesome-rsi + Awesome-Self-Improving-Agents | Catalogo — so checklist, nao codigo inteiro |
| TencentCloudADP/youtu-agent | Orquestracao multi-tool |
| strukto-ai/mirage | Prototipo de agente — referencia de UX |

## Browser / automacao UI

| Repo | Uso no Lexis |
|------|----------------|
| lackeyjb/playwright-skill | Skill Playwright — smoke test, login, print demo |
| ultrafunkamsterdam/undetected-chromedriver | So se precisar driblar bloqueio em teste legítimo |
| CloakHQ/CloakBrowser | Isolamento de sessao browser |

## UI builders / dados (plano B, admin interno)

| Repo | Uso no Lexis |
|------|----------------|
| illacloud/illa-builder, appsmithorg/appsmith | Admin interno low-code (nao substituir o app) |
| teableio/teable | Planilha-DB hibrida — ideia para Plano B |
| HeyPuter/builder, quests-org/quests, nexu-io/open-design | Prototipo visual rapido |
| getbeton/beton-ai | Ideias de UI AI-assisted |

## Chat / shell LLM (extensao "app LLM")

| Repo | Uso no Lexis |
|------|----------------|
| ChatGPTNextWeb/NextChat, Niek/chatgpt-web, miuuyy/codex-chatgpt-web | Shell de chat embutivel — painel Agente no Lexis |
| f/prompts.chat | Biblioteca de prompts versionados |
| cactus-compute/needle | Busca em docs — knowledge do Lexis |

## Algoritmo / feed (inspiracao, nao copiar)

| Repo | Uso no Lexis |
|------|----------------|
| xai-org/x-algorithm, twitter/the-algorithm | Entender ranking de feed — aplicar em "por que post performa" |
| cloudflare/cloudflare-os, notebook-examples | Edge/workers — jobs leves sem Vercel cron caro |

## Ja no Lexis

| Path | Uso |
|------|-----|
| skills/segundo-cerebro | Memoria local, recall/capture, humanizer, ship |
| skills/lexis-gtm-agent (esta) | GTM + router de tokens + venda |

## Prioridade de adocao (ordem)

1. Router intent → 0 token / SLM / LLM (esta skill)
2. Playwright smoke + demo screenshots
3. Watermark local so em asset proprio (pos-print / pos-IA)
4. Painel Agente (shell tipo NextChat) so para intents de texto
5. AgentOps/OpenInference para medir tokens reais
6. Self-improve semanal com vault
7. Builders (Appsmith/Teable) so se precisar admin interno rapido
