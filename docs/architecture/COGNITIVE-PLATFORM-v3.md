# LexisPredict Cognitive Platform v3 — mapa de referências

Objetivo: aproveitar padrões úteis das referências externas sem transformar o LexisPredict em um monólito de dependências incompatíveis.

## Regra de adoção

- **CORE**: padrão reimplementado de forma nativa no LexisPredict, sem copiar código externo.
- **ADAPTER**: integração opcional por HTTP/worker/sidecar.
- **SKILL**: metodologia incorporada às skills e gates de qualidade.
- **LAB**: referência para P&D; não entra no fluxo jurídico de produção.
- **NÃO-CORE**: domínio incompatível; documentado para evitar integração artificial.

Licenças permissivas ainda exigem preservação das obrigações aplicáveis. GPL/AGPL/LGPL ou licença ausente/incerta não deve ser copiada para o core sem revisão específica.

## Memória, cérebro e agentes

| Repositório | Uso no LexisPredict | Modo |
|---|---|---|
| ItsWambarYT/ai-brain | memória persistente, contexto recuperável e personalização por histórico | CORE |
| tinyhumansai/openhuman | separação harness/runtime e eficiência do loop de agente; Rust/GPL fica fora do bundle | SKILL/ADAPTER |
| SamurAIGPT/llm-wiki-agent | knowledge base auto-organizada, evidência e links entre notas | CORE/SKILL |
| mycelium-hq/ai-brain-starter | memória, accountability, journaling e grafo de conhecimento | CORE/SKILL |
| msamsami/clonellm | estudo de personalização a partir de dados do próprio usuário | LAB |
| muhammad-fiaz/Charisma | memória/persona local; AGPL impede adoção direta no core | LAB |
| thedotmack/claude-mem | captura, compressão e reinjeção de contexto relevante | CORE |
| obra/superpowers | planejamento, execução, revisão e evidência antes de declarar sucesso | SKILL |
| affaan-m/ECC | performance do harness, skills, memória, segurança e research-first | CORE/SKILL |
| pacifio/atlas | rastreabilidade de mudanças produzidas por agentes | CORE/SKILL |
| earendil-works/pi | loop de agente e abstração de providers | CORE/SKILL |
| alphaXiv/OpenResearch | pesquisa paralela, experimentos reproduzíveis e evidência ligada ao trabalho | CORE/SKILL |
| nikmcfly/MiroFish-Offline | simulação multiagente offline; AGPL/Ollama não entra como dependência | LAB |
| mindcraft-bots/mindcraft | decomposição ação-observação de agentes em ambiente persistente | LAB |
| xcontcom/neuroparticles | sistemas emergentes/evolutivos para experimentos de agentes | LAB |

## Web, pesquisa, automação e produto

| Repositório | Uso no LexisPredict | Modo |
|---|---|---|
| D4Vinci/Scrapling | padrões de scraping resiliente e extração adaptativa | ADAPTER/SKILL |
| ChromeDevTools/chrome-devtools-mcp | navegador observável, inspeção e verificação de resultado | ADAPTER |
| dgtlmoon/changedetection.io | snapshot/diff/alerta para fontes monitoradas | CORE |
| tj/watch | padrão de file/watch com debounce para jobs locais | CORE |
| nocobase/nocobase | referência de metadados, workflow e UI configurável; não copiar plugins/licença sem revisão | LAB |
| vastsa/PI-Desktop | local-first + host separado + plugins instaláveis | SKILL/LAB |
| zernio-dev/zernio-claude-plugin | padrão de integração por plugin/MCP e ações de conteúdo | SKILL |
| every-app/open-seo | auditoria SEO para landing/comercial, separada do app jurídico | LAB |
| JCodesMore/ai-website-cloner-template | benchmark visual/regressão para reconstrução de interfaces próprias | LAB |
| darkzOGx/youtube-automation-agent | pipeline de conteúdo com etapas observáveis e aprovação | LAB/SKILL |

## OCR, documentos, relatórios e mídia

| Repositório | Uso no LexisPredict | Modo |
|---|---|---|
| PaddlePaddle/PaddleOCR | OCR/document understanding self-host; adapter `OCR_PADDLE_URL` | ADAPTER |
| hugohe3/ppt-master | narrativa de relatório → slides nativos, tabelas e gráficos | SKILL/ADAPTER |
| debpalash/VoiceStudio | voz/transcrição local opcional; AGPL em processo separado | ADAPTER |
| upscayl/upscayl | upscale de imagens em worker separado; AGPL fora do bundle | ADAPTER |
| ssloy/tinyrenderer | princípios de pipeline de renderização e geometria | LAB |
| TachibanaYoshino/AnimeGANv3 | estilização visual opcional, fora do núcleo jurídico | LAB |
| dtoyoda10/anime-gen | geração visual como módulo isolado | LAB |
| Chaosamongclippers/ENB-for-NVE | referência de pós-processamento visual/presets | LAB |
| soserrieye0/ENBSeries-GTA5-FiveM | referência visual; licença incerta, não copiar | LAB |

## Pesquisa técnica / domínios não diretamente aplicáveis

| Repositório | Uso | Modo |
|---|---|---|
| MG1937/ASC | decompilação Android para pesquisa autorizada de apps próprios; não faz parte do fluxo Lexis web | LAB |
| playbox-dev/trackstudio | rastreamento multi-câmera; apenas inspiração para pipelines de eventos em tempo real | LAB |
| ruvnet/RuView | sensoriamento Wi-Fi; domínio externo ao produto jurídico | NÃO-CORE |
| fasferraz/eNB | emulador S1AP/S1-U de telecom; domínio externo ao produto jurídico | NÃO-CORE |

## Componentes implementados nesta versão

- `src/lib/cognitive/registry.ts`: registry de capacidades e runtime.
- `src/lib/cognitive/orchestrator.ts`: roteamento determinístico de intenção.
- `src/lib/cognitive/memory.ts`: busca lexical, recência, deduplicação e compactação.
- `src/lib/cognitive/evidence.ts`: ledger de evidência e conflito.
- `src/lib/cognitive/change-watch.ts`: snapshot/fingerprint/diff.
- `src/lib/cognitive/agent-loop.ts`: lifecycle planejado → execução → verificação → conclusão/falha.
- `src/lib/cognitive/quality.ts`: quality gate.
- `src/app/api/ai/capabilities/route.ts`: introspecção/planejamento.
- `src/lib/ocr/internal-paddle.ts`: PaddleOCR self-host opcional.
- `src/ai/flows/chat-ai-flow.ts`: memória seletiva + intent + reparo quando o quality gate falhar.
- `SKILL.md` e `council/SKILL.md`: Cognitive Platform v3, Council X10, terceira perspectiva e Deep-100.

## Próximas integrações seguras

1. Persistir ledger de evidência por `empresa_id` e entidade, sem misturar tenants.
2. Ligar `change-watch` a fontes oficiais já autorizadas (DJEN/DataJud) antes de sites arbitrários.
3. Adicionar worker de browser somente para fluxos com confirmação e escopo explícito.
4. Adicionar telemetria de agente por evento, sem prompt completo nem PII por padrão.
5. Habilitar sidecars (PaddleOCR/voz/upscale) apenas quando URL/worker estiver configurado.
