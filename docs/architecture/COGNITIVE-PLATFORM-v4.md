# LexisPredict Cognitive Platform v4

A v4 amplia a plataforma v3 com pesquisa web, mídia generativa, simulação e biblioteca de aprendizagem sem colocar runtimes pesados dentro do Next.js/Vercel.

## Arquitetura

```
UI / rotas LexisPredict
        |
        v
Cognitive Orchestrator
  |     |      |       |
  |     |      |       +-- skill-library / api-discovery
  |     |      +---------- simulation-engine (inline)
  |     +----------------- media -> ComfyUI sidecar
  +----------------------- research -> Firecrawl sidecar
        |
        +-- memory-v2 / evidence / quality gate / Council X10
```

Princípio: o core não depende do sidecar. Sem Firecrawl/ComfyUI/PaddleOCR, o restante do produto continua operacional.

## AI Lab

Rota: `/ai-lab`

Superfícies:
- status dos motores;
- pesquisa web;
- geração de imagem/vídeo;
- simulação de cenários;
- mapa das capacidades registradas.

## Research / Firecrawl

Arquivos:
- `src/lib/research/firecrawl.ts`
- `src/app/api/research/route.ts`

Configuração:
```env
FIRECRAWL_API_KEY=fc-...
# opcional para self-host
FIRECRAWL_BASE_URL=https://firecrawl.seu-dominio/v2
```

Rotas:
- `GET /api/research` — status;
- `POST /api/research` com `{ action: "search", query, limit }`;
- `POST /api/research` com `{ action: "scrape", url }`.

Proteções:
- exige sessão/empresa;
- bloqueia localhost/IP privado no alvo de scrape;
- timeout;
- limite de resultados;
- normalização de resposta.

Firecrawl complementa, não substitui, DataJud/DJEN e fontes oficiais.

## ComfyUI — imagem e vídeo

Arquivos:
- `src/lib/media/comfyui.ts`
- `src/app/api/media/comfy/route.ts`

Configuração:
```env
COMFYUI_BASE_URL=https://comfy.seu-dominio
COMFYUI_TOKEN=opcional

# workflow API-format do ComfyUI, JSON em uma linha ou variável multilinha
COMFYUI_IMAGE_WORKFLOW_JSON={"...":"..."}
COMFYUI_VIDEO_WORKFLOW_JSON={"...":"..."}
```

Placeholders substituídos no servidor:
- `{{PROMPT}}`
- `{{NEGATIVE_PROMPT}}`
- `{{WIDTH}}`
- `{{HEIGHT}}`
- `{{SEED}}`
- `{{FRAMES}}`

Rotas:
- `GET /api/media/comfy` — health/presets;
- `POST /api/media/comfy` — enfileira imagem/vídeo;
- `GET /api/media/comfy?prompt_id=...` — consulta histórico.

Custom workflow enviado pelo request só é aceito para superadmin. O token do ComfyUI nunca vai para o navegador.

### Deploy recomendado

ComfyUI precisa de GPU/VRAM conforme o workflow. Não instalar checkpoints no Vercel. Use:
- máquina local acessível por túnel privado/rede segura;
- GPU server;
- serviço compatível com ComfyUI API.

O app só conhece a URL configurada.

## Scenario Simulator

Arquivos:
- `src/lib/simulation/scenario-engine.ts`
- `src/app/api/simulate/route.ts`

Modelo:
- Monte Carlo;
- distribuição triangular;
- seed reproduzível;
- até 20.000 iterações;
- P10/P50/P90;
- média;
- topRate.

Exemplo:
```json
{
  "seed": "estudo-1",
  "iterations": 5000,
  "options": [
    {
      "id": "a",
      "label": "Opção A",
      "baseScore": 10,
      "factors": [
        {"name":"impacto","min":1,"likely":3,"max":5,"weight":2}
      ]
    },
    {
      "id": "b",
      "label": "Opção B",
      "baseScore": 8,
      "factors": [
        {"name":"impacto","min":2,"likely":3,"max":4,"weight":1.5}
      ]
    }
  ]
}
```

O resultado é consequência das premissas fornecidas. Não deve ser apresentado como previsão empírica sem validação externa.

## Source Catalog

Arquivo: `src/lib/cognitive/source-catalog.ts`.

Modos:
- `core`: padrão implementado nativamente;
- `adapter`: serviço/worker opcional;
- `skill`: metodologia/processo;
- `lab`: pesquisa e benchmark;
- `non-core`: referência fora do domínio do produto.

Catálogos como awesome/public-apis são fontes de descoberta, não listas de dependências aprovadas.

## Novas fontes v4

### Firecrawl
Uso: web search/scrape. Adapter real.

### ComfyUI
Uso: imagem, vídeo, áudio/3D quando workflows forem configurados. Adapter real.

### build-your-own-x
Uso: aprendizagem por reconstrução de componentes; nunca copiar arquitetura inteira sem necessidade.

### freeCodeCamp
Uso: currículo e exercícios para skill-learning.

### mattpocock/skills
Uso: feedback loop, TDD, diagnóstico, linguagem compartilhada e módulos profundos.

### awesome
Uso: descoberta curada, sempre com validação individual.

### public-apis
Uso: descoberta de APIs. Antes de integrar: documentação atual, auth, termos, quota, privacidade, timeout e fallback.

## Relação com referências anteriores

Mantidas:
- ai-brain / claude-mem / llm-wiki-agent -> memória;
- OpenHuman / pi / Atlas -> agentes/harness;
- Superpowers / ECC -> engenharia/evals;
- OpenResearch -> pesquisa;
- Scrapling / Chrome DevTools MCP -> sidecars web/browser;
- changedetection / watch -> diff/monitor;
- PaddleOCR -> OCR sidecar;
- ppt-master -> relatórios/apresentações;
- VoiceStudio/Upscayl -> workers de mídia;
- MiroFish/neuroparticles -> laboratório de simulação;
- AnimeGAN/tinyrenderer/ENB -> laboratório visual;
- RuView/eNB telecom -> non-core.

## Segurança multi-tenant

Adapters não recebem `empresa_id` de outra empresa por parâmetro livre. As rotas autenticam a sessão atual. Qualquer persistência futura deve gravar `empresa_id` derivado da sessão e manter RLS.

## Testes

Cobertura adicionada:
- URL guard Firecrawl;
- bindings de workflow ComfyUI;
- reprodutibilidade do simulador;
- roteamento de intents v4.

Gates obrigatórios do PR:
- `pnpm install --frozen-lockfile`
- `pnpm run typecheck`
- `pnpm test`


## Plugin Platform v4.1

Arquivos:
- `src/lib/plugins/types.ts`
- `src/lib/plugins/registry.ts`
- `src/lib/plugins/runtime.ts`
- `src/app/api/plugins/route.ts`
- `src/app/plugins/page.tsx`

Contrato:
- manifesto;
- categoria/runtime;
- permissões;
- configuração;
- source repos;
- ações allowlisted.

Não existe carregamento de JavaScript remoto nem `eval`. Plugins pesados são adapters/sidecars.

Plugins internos:
- Memory Core
- Firecrawl Research
- ComfyUI Media
- Scenario Simulator
- World Sandbox
- Agent Studio
- Screen Context
- Paddle OCR
- Change Watch
- Developer Lab

### API de plugins

`GET /api/plugins` lista status e configuração.

`POST /api/plugins`:
```json
{
  "pluginId": "world-sandbox",
  "action": "chunk",
  "input": { "seed": "demo", "chunkX": 0, "chunkZ": 0 }
}
```

A API exige sessão e deriva empresa do contexto autenticado.

## Agent Studio

Arquivo: `src/lib/agents/studio.ts`.

Papéis:
- Director
- Researcher
- Builder
- Critic
- Simulator
- Creative
- QA
- Security
- Operator

O time é selecionado pelo objetivo, inspirado em estruturas especializadas de Game Studios/SuperAGI/AgentGPT, mas sem criar dezenas de processos ou providers obrigatórios.

Fluxo:
goal → selecionar papéis → limitar ferramentas → executar → verificar → sintetizar.

## World Sandbox

Arquivos:
- `src/lib/simulation/world-engine.ts`
- `src/app/world-lab/page.tsx`

Princípios aproveitados de Craft e clones voxel:
- chunks;
- geração procedural;
- seed determinística;
- biomas;
- recursos;
- edição/terraforming;
- inventário;
- agentes;
- construção.

A geração é sob demanda. Um chunk em coordenada distante não exige armazenar os chunks intermediários.

### Creative mode

O World Lab permite:
- marcar estruturas;
- criar floresta;
- criar água;
- colocar ferro;
- limpar recursos/marcações.

Edições são persistidas no navegador por seed. Elas são enviadas ao motor para geração e episódios, mas não entram no Supabase jurídico.

### Agentes

Objetivos atuais:
- explore
- gather
- build

Estado observado:
- posição
- energia
- inventário
- estruturas
- distância

DouZero contribui como referência de episódios/self-play e grandes espaços de ação. Não há treinamento GPU do DouZero dentro do LexisPredict.

## Screen Context (Screenpipe)

Adapter: `src/lib/context/screenpipe.ts`.

Config:
```env
SCREENPIPE_BASE_URL=http://endereco-explicitamente-configurado:3030
SCREENPIPE_API_KEY=opcional
```

Ação: `screen-context/search`.

O adapter consulta `/search`, de acordo com a interface local documentada pelo Screenpipe.

Privacidade:
- opt-in;
- nenhuma captura é iniciada pelo LexisPredict;
- sem configuração, o plugin fica desativado;
- dados de tela não são misturados automaticamente com processos jurídicos;
- em deploy na nuvem, localhost seria o servidor da nuvem, não o PC do usuário; usar apenas endpoint explicitamente acessível/configurado.

## Descoberta de tecnologia

`EvanLi/Github-Ranking`, `awesome`, `public-apis`, `build-your-own-x` e `freeCodeCamp` são fontes de descoberta/aprendizagem.

Popularidade não equivale a aprovação. Antes de adotar:
1. necessidade real;
2. manutenção recente;
3. licença;
4. superfície de segurança;
5. tamanho/runtime;
6. termos/privacidade;
7. teste isolado;
8. fallback.
