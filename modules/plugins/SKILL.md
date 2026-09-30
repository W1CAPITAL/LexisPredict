# Plugin Platform — LexisPredict v4.1

Plugins no LexisPredict são capacidades declaradas, não código remoto arbitrário.

## Manifesto obrigatório

Cada plugin declara:
- id e versão;
- categoria e runtime;
- permissões mínimas;
- repositórios de referência;
- chaves de configuração;
- ações allowlisted.

Registry: `src/lib/plugins/registry.ts`.
Executor: `src/lib/plugins/runtime.ts`.
API: `/api/plugins`.
UI: `/plugins`.

## Regras

1. Nenhum `eval`, import dinâmico de URL ou JavaScript remoto.
2. Sidecar precisa de adapter tipado.
3. Segredos ficam no servidor.
4. Execução deriva `empresa_id` da sessão.
5. Plugin opcional indisponível não quebra o core.
6. Ações não registradas são recusadas.
7. Permissões servem como contrato/documentação e devem orientar gates futuros.

## Plugins atuais

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

## Screen Context

Screenpipe é opt-in.

Config:
- `SCREENPIPE_BASE_URL`
- `SCREENPIPE_API_KEY` opcional/conforme configuração local

O LexisPredict consulta apenas quando explicitamente acionado. Não inicia captura e não presume que localhost do servidor seja a máquina do usuário.

## Como adicionar plugin

1. criar adapter pequeno;
2. criar manifesto;
3. expor ações estritas;
4. adicionar teste;
5. adicionar UI somente depois do executor funcionar;
6. documentar fallback;
7. rodar typecheck/testes.
