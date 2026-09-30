# Repositórios → uso no LexisPredict

Legenda: **N** núcleo · **A** agente/IA · **UX** referência de interface · **GTM** comercial do SaaS · **R** pesquisa · **F** fora do produto.

| Repo | Classe | Como usar no LexisPredict |
|---|---:|---|
| parakeet-nest/parakeet | A | Padrão leve para apps GenAI locais/Ollama; útil em laboratório local, não no core Vercel. |
| Dshamir/slm-forge | A/R | Pipeline experimental de SLM: corpus sintético/anonimizado → avaliação → publicação; sempre com gate humano. |
| microsoft/generative-ai-for-beginners | R | Material de referência para padrões de RAG, agentes, avaliação e prompting. |
| nando0x/ProspectOS | GTM | Reaproveitar pipeline/follow-up para **vender o LexisPredict a empresas** ou inbound próprio. Não prospectar partes por CNJ. |
| explorium-ai/gtm-skills | GTM | ICP, pesquisa de mercado, account planning e GTM B2B do LexisPredict. |
| getbeton/beton-ai | GTM/R | Referência de revenue intelligence e pipeline comercial do SaaS. |
| lackeyjb/playwright-skill | N | E2E obrigatório: login, signup, cargos, tenant, carteira, tarefas, export e dark mode. |
| miuuyy/codex-chatgpt-web | R | Referência de adaptadores/model routing; não usar automação para contornar limites de serviços. |
| Niek/chatgpt-web | UX/R | Referência de UX de chat. Código GPL deve ficar fora do produto comercial salvo análise de licença. |
| ChatGPTNextWeb/NextChat | UX/R | Referência para thread, streaming e model switch; não substituir o fluxo operacional. |
| f/prompts.chat | A/R | Catálogo/inspiração para biblioteca de prompts versionados e avaliados. |
| cactus-compute/needle | A | Extração/embeddings em dispositivo e experimentos locais compactos; útil para offline/edge. |
| openai/openai-agents-python | A | Modelo de tools/handoffs/guardrails para agentes pequenos e auditáveis. |
| Arize-ai/openinference | N | OpenTelemetry de IA: trace, latência, erro, motor, custo; PII mascarada. |
| strukto-ai/mirage | R | Referência de ambiente/sandbox para agentes; não precisa virar dependência do core. |
| TencentCloudADP/youtu-agent | A/R | Referência de framework de agente com modelos open-source. |
| AgentOps-AI/agentops | N | Observabilidade/benchmark de agentes e fluxos de IA. |
| Leonxlnx/taste-skill | UX | Checklist de qualidade visual, hierarquia, tipografia e contraste. |
| xai-org/x-algorithm | F/R | Não portar ranking de feed. Só estudar engenharia/avaliação em nível conceitual. |
| twitter/the-algorithm | F/R | Mesmo caso; AGPL exige cautela. Não usar para priorização jurídica. |
| NextFrontierBuilds/x-algorithm | F/R | Estratégias de feed/viralidade não entram no ranking jurídico; no máximo marketing do SaaS. |
| anthropics/claude-for-financial-advisors | A/GTM | Estrutura de workflows e tom para assessoria financeira; adaptar sem copiar dados/conectores proprietários. |
| cloudflare/cloudflare-os | A/R | Referência de workspace/agents/Workers; possível edge layer para tarefas não sensíveis. |
| ultrafunkamsterdam/undetected-chromedriver | F | Não integrar para furar WAF/CAPTCHA/rate-limit/geo. |
| CloakHQ/CloakBrowser | F | Não integrar para stealth contra tribunais/terceiros. |
| illacloud/illa-builder | UX | Referência de dashboards internos densos; não criar segundo backend. |
| appsmithorg/appsmith | UX | Referência de admin panels, tabelas e CRUD; manter Supabase como núcleo. |
| teableio/teable | UX/R | Referência de UX tipo planilha para operações em massa. |
| HeyPuter/builder | UX/R | Referência de geração de apps/UX; aproveitar padrões, não substituir o produto. |
| quests-org/quests | UX/R | Onboarding guiado e construção de fluxos. |
| nexu-io/open-design | UX | Prototipação visual e revisão de layout; exportar mockups, não virar runtime do Lexis. |
| cloudflare/notebook-examples | R | Laboratório de APIs/Workers, benchmarks e testes de edge. |
| BerriAI/self-improving-agent | N | Padrão principal: agente propõe diff → humano aprova → PR draft. |
| kayba-ai/recursive-improve | R/A | Referência de ciclos iterativos, com limites e avaliação externa. |
| PrimeIntellect-ai/prime-agent | A/R | Referência de coding agent/long-running tasks em sandbox. |
| lobehub/awesome-rsi | R | Mapa de pesquisa de recursive self-improvement. |
| selfimproving-agent/Awesome-Self-Improving-Agents | R | Bibliografia/referências de self-improving agents. |

## Regra para os repos duplicados/sem licença clara

- `Leonxlnx/taste-skill` apareceu duas vezes: tratar como uma única fonte.
- Repositório sem licença clara: usar apenas ideias, documentação e arquitetura; não copiar código.
