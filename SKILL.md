---
name: lexis-unified
description: >
  Skill unificada do LexisPredict para memoria, agentes, pesquisa web, automacao,
  OCR/documentos, relatorios, geracao de imagem/video, simulacao, engenharia,
  autoaprimoramento e Council X10.
metadata:
  type: workflow
  version: "4.1"
  unifies:
    - segundo-cerebro
    - lexis-autoimprove
    - lexis-gtm-agent
    - lexis-video-gen
    - lexis-research
    - lexis-simulation
    - lexis-self-improve-v2
    - lexis-ecosystem
    - lexis-cognitive-platform-v4
    - lexis-plugin-platform
    - lexis-world-sandbox
---

# Lexis Unified Skill v4

Um ponto de entrada para o produto inteiro. O LexisPredict continua sendo um produto juridico/operacional; repositorios externos viram capacidades, adapters, skills ou laboratorio.

## Loop obrigatorio

1. **Recall**: recuperar contexto relevante antes de uma tarefa grande.
2. **Classificar intent**: regra local antes de modelo.
3. **Evidencia primeiro**: fatos e dados observados antes de inferencia.
4. **Menor passo verificavel**: preferir mudancas pequenas e reversiveis.
5. **Executar**: regra local → adapter → SLM/LLM somente se necessario.
6. **Verificar**: teste, typecheck, build, endpoint, diff ou resultado funcional.
7. **Quality gate**: nao marcar sucesso com saida vazia, contraditoria ou sem evidencia exigida.
8. **Capture**: registrar apenas decisoes duraveis, sem segredo/token/PII desnecessaria.

## Modos

| Modo | Quando | Motor/modulo |
|---|---|---|
| recall | memoria, contexto, continuidade | segundo-cerebro + memory-v2 |
| ship | bug, CRUD, build, save, reload | engenharia + testes |
| research | web, fonte, jurisprudencia, site | Firecrawl + research + evidence |
| monitor | mudanca em fonte/site | change-watch + Firecrawl opcional |
| document | OCR, PDF, extracao | PaddleOCR sidecar → Tesseract |
| media | imagem, video, upscale | ComfyUI sidecar + video-gen |
| simulate | cenarios, trade-offs, incerteza | scenario-engine local |
| council | arquitetura/decisao de alto impacto | Council X10 + terceiro lado |
| learn | curso, skill, "como construir" | skill-library |
| api | procurar integracao/API | api-discovery |
| plugins | plugin, connector, toolkit | plugin-platform |
| world | mundo, sandbox, voxel, bioma, criatividade | world-sandbox |
| agents | equipe de agentes, multiagente | agent-studio |
| improve | autoaprimoramento | sinais → patch pequeno → eval |
| gtm | copy, demo, campanha | gtm-agent + media |

## Hierarquia de custo

```
1. Regra/codigo deterministico    -> 0 token
2. Memoria/indice/router          -> 0 token
3. Simulador/diff/OCR local       -> 0 token
4. Sidecar self-host              -> custo de infra local
5. SLM/few-shot                   -> baixo
6. LLM forte / servico pago       -> ultimo recurso
```

## Engenharia: disciplina de feedback

Inspirado em `mattpocock/skills`, Superpowers e ECC:

- alinhar dominio e nomes antes de ampliar codigo;
- TDD quando a mudanca tem regra verificavel;
- diagnosticar bug por evidencia antes de editar;
- passos pequenos; o feedback e o limite de velocidade;
- aprofundar modulos com interfaces simples em vez de criar "bola de lama";
- nao declarar concluido sem gate observavel.

Para mudanca ampla: escrever criterio de pronto, arquivos tocados, riscos e como reverter.

## Cognitive Platform v4

Nucleo: `src/lib/cognitive/`.

Capacidades principais:
- memory-v2;
- Council X10;
- evidence ledger;
- quality gate;
- Firecrawl;
- browser agent;
- change-watch;
- OCR/document understanding;
- model cascade;
- ComfyUI media;
- image enhance;
- scenario simulator;
- skill-library;
- API discovery;
- observability.

Introspeccao/planejamento: `/api/ai/capabilities`.
Interfaces: `/ai-lab`, `/plugins` e `/world-lab`.

## Pesquisa web

Fluxo:
1. definir pergunta;
2. verificar memoria/local;
3. Firecrawl search/scrape quando configurado;
4. registrar fonte + trecho/evidencia;
5. separar fato, inferencia e lacuna;
6. quality gate.

Nunca usar scraping para contornar autenticacao, paywall ou autorizacao. URLs privadas/localhost nao entram no adapter publico.

## Media

ComfyUI e sidecar, nunca dependencia do bundle Vercel.

Env:
- `COMFYUI_BASE_URL`
- `COMFYUI_TOKEN` opcional
- `COMFYUI_IMAGE_WORKFLOW_JSON`
- `COMFYUI_VIDEO_WORKFLOW_JSON`

Placeholders aceitos nos workflows:
`{{PROMPT}}`, `{{NEGATIVE_PROMPT}}`, `{{WIDTH}}`, `{{HEIGHT}}`, `{{SEED}}`, `{{FRAMES}}`.

Geracao e monitoramento ficam no AI Lab. Upscale e outros workers continuam opcionais.

## Simulacao

`scenario-engine` executa Monte Carlo local com seed reproduzivel.

Use para comparar cenarios sob premissas declaradas. Resultado de simulacao nao e previsao real nem garantia. Para decisao de alto impacto, passar a interpretacao pelo Council e listar premissas que mais influenciam o resultado.

## Aprendizagem e descoberta

Fontes como `build-your-own-x`, `freeCodeCamp`, `awesome`, `public-apis` e `mattpocock/skills` sao catalogos de aprendizagem/descoberta.

Regras:
- nao instalar dependencias automaticamente porque aparecem em uma lista;
- validar manutencao, licenca, seguranca, termos e encaixe arquitetural;
- preferir aprender o padrao e reimplementar uma interface pequena;
- APIs externas precisam de contrato, timeout, limite e fallback.

## Council X10 + terceiro lado

Lentes:
1. operacao/carteira
2. juridico/produto
3. evidencia/fontes
4. dados/RLS/LGPD
5. seguranca/abuso
6. custo/token/infra
7. offline/resiliencia
8. UX/acessibilidade
9. QA/testes/reversibilidade
10. negocio/GTM

Depois da tese e antitese, abrir o terceiro lado:
- qual premissa os dois lados compartilham?
- existe opcao C menor/reversivel?
- o que acontece sem API/modelo?
- o que a evidencia nao permite concluir?

## Deep-100

Somente em decisoes de alto impacto. Gerar ate 100 perguntas agrupadas por evidencia, usuario, dados, seguranca, custo, operacao, UX, reversibilidade, testes e longo prazo. Deduplicar antes de responder.

## Politica de repositorios externos

- TypeScript leve + licenca adequada: pode inspirar modulo interno apos revisao.
- Python/Rust/C++ pesado: sidecar/worker.
- GPL/AGPL/LGPL/licenca incerta: nao copiar para o core sem revisao.
- Repositorios fora do dominio juridico ficam em Lab/NON-CORE.
- Nenhuma integracao pode ignorar `empresa_id`, RLS, papeis, consentimento ou auditoria.

Mapa: `docs/architecture/COGNITIVE-PLATFORM-v4.md`.

## Checklist

```
[ ] Recall/contexto suficiente?
[ ] Intent correto?
[ ] Regra local antes de LLM?
[ ] Fonte/evidencia quando necessario?
[ ] Menor mudanca verificavel?
[ ] Teste/typecheck/build/resultado?
[ ] Sidecar opcional sem quebrar core?
[ ] Capture duravel?
```


## Plugin Platform v4.1

Plugins possuem manifesto, permissões, runtime, configuração e ações allowlisted.
Não carregar código remoto arbitrário. Sidecars são integrados por adapters tipados.
Screenpipe é opt-in e só consulta contexto quando explicitamente acionado.

## World Sandbox v4.1

O mundo procedural usa chunks e seed para permitir exploração de coordenadas sem pré-alocar um mapa finito.
Biomas, recursos, agentes, inventário e edições criativas são reproduzíveis.
Edições do World Lab ficam locais ao navegador e não entram nas tabelas jurídicas.

## Agent Studio

O agente diretor monta times mínimos conforme o objetivo: researcher, builder, critic, simulator, creative, QA, security e operator.
Cada papel recebe ferramentas limitadas e passa por gates de evidência/QA.
