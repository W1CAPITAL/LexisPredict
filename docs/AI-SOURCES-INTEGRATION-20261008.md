# LexisPredict W1 — integração seletiva do ecossistema open source

## Escopo real
Uma aplicação Next.js existente, um Supabase W1. A integração instala código
apenas onde é compatível. Repositórios inteiros de Python/C/Rust e interfaces
alternativas não são automaticamente executáveis na Vercel e não devem ser
copiados de forma indiscriminada.

| Repositório | Função real | Integração W1 | Estado |
|---|---|---|---|
| [spider-rs/spider](https://github.com/spider-rs/spider) | crawler Rust / Spider Cloud | adapter REST oficial server-only: pesquisa explícita URLs públicas no chat e dossiês | **opcional**, requer SPIDER_API_KEY |
| [JustVugg/colibri](https://github.com/JustVugg/colibri) | inferência local MoE escrita em C | backend externo dedicado futuro, nunca dossiê por si só | documentado |
| [FareedKhan-dev/train-llm-from-scratch](https://github.com/FareedKhan-dev/train-llm-from-scratch) | treinamento educacional de LLM | referência para avaliações, sem treinamento on-line | documentado |
| [Jakubantalik/thinking-orbs](https://github.com/Jakubantalik/thinking-orbs) | canvas React para 9 estados de carregamento | fontes MIT preservadas em src/vendor; loading/chat/WhatsApp/dossiê | **código integrado** |
| [lobehub](https://github.com/lobehub) | ecossistema LobeChat | inspiração UX/plugins, não pacote adicional | referência |
| [BehiSecc/VibeSec-Skill](https://github.com/BehiSecc/VibeSec-Skill) | skill de segurança web | SKILL + LICENSE Apache-2.0 em skills/vibesec | **skill incluída** |
| [open-webui/open-webui](https://github.com/open-webui/open-webui) | plataforma completa de chat/LLM | avaliar padrões arquiteturais e licenças antes de copiar | referência |
| [cactus-compute/needle](https://github.com/cactus-compute/needle) | modelo compacto para dispositivos | possível parser/tool router local | referência |
| [open-jarvis/OpenJarvis](https://github.com/open-jarvis/OpenJarvis) | IA em dispositivos | runtime futuro em máquina separada, não Vercel | referência |
| [GauravSingh9356/J.A.R.V.I.S](https://github.com/GauravSingh9356/J.A.R.V.I.S) | assistente Python para desktop | exemplos de automação, sem execução de comandos arbitrários | referência |
| [public-apis/public-apis](https://github.com/public-apis/public-apis) | índice de APIs | descoberta manual de serviços | referência |
| [sindresorhus/awesome](https://github.com/sindresorhus/awesome) | índice de listas | curadoria e documentação | referência |
| [VoltAgent/awesome-claude-code-subagents](https://github.com/VoltAgent/awesome-claude-code-subagents) | catálogo de definições de agentes | papéis W1 próprios em skills/lexis-ai-suite/agents/ | adaptado |
| [thedotmack/claude-mem](https://github.com/thedotmack/claude-mem) | memória de contexto de agentes | conceitos de retenção/resumo; não instalado como daemon | referência |

## Avisos de segurança e licenças
MIT/Apache: atribuição e redistribuição do aviso de licença obrigatórias.
Licenças de projetos completos devem ser conferidas antes de qualquer uso de código,
especialmente quando existem condições adicionais por marca/uso.
Não conectar chave W2 ao projeto W1. Não executar agents de terceiros como comandos
com privilégios. O modelo gera sugestões, nunca aprova ações jurídico-financeiras sozinho.

## Instalação
- thinking-orbs e VibeSec: fazem parte do código e não requerem env.
- Spider Cloud: definir `SPIDER_API_KEY` e `LEXIS_SPIDER_ENABLED=true` APENAS no servidor Vercel (Production/Preview),
  comprar/ativar o serviço se desejar, validar orçamento; sem a chave as
  consultas opcionais são ignoradas (chat e dossiê seguem usando motores existentes).
- Não criar segundo banco.
- CI antes de produção: `pnpm run typecheck && pnpm run test && pnpm run build`.
- Obter autorização/revisar licenças se desejar hospedar runtimes locais Colibri/Needle/Jarvis.

## Referência do ZIP recebido
`predictlm-v3.8.0-djen-funcional.zip` é skill/documentação do ambiente W2;
não foi copiado para as dependências nem executado. Serviu apenas para reforçar
rastreabilidade de evidência, revisão humana e isolamento de módulos.
