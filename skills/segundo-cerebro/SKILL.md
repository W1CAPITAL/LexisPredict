---
name: segundo-cerebro
description: Segundo cerebro local-first for Grok. Use when starting any new task, when the user mentions notes, vault, segundo cerebro, skill unificada, harness, memory, or asks to remember a decision. Before acting, search and read related notes in the vault, then write durable outcomes back. Distills automate-flows, impeccable, 21st, humanizer, agency-agents, book-to-skill, ruflo, ECC, harness-skills, deepseek-harness, and higgsfield into one operating loop.
metadata:
  type: workflow
  version: "1.0"
  vault: ~/documentos/segundo cerebro
---

# Segundo Cerebro

Harness unico. Vault em `~/documentos/segundo cerebro` (fallback `/home/workdir/documentos/segundo cerebro` se home padrao nao existir).

## Gate obrigatorio (antes de qualquer tarefa nova)

1. Resolver o caminho do vault (`scripts/vault_path.sh`).
2. Rodar `python3 scripts/recall.py --query "<tarefa>" --limit 8`.
3. Ler as notas listadas (titulo + corpo). Se nao houver nota, criar `inbox/YYYY-MM-DD-<slug>.md` com o briefing.
4. So depois planejar e executar.
5. Ao terminar, gravar o que e duravel com `python3 scripts/capture.py` — decisao, convencao, fato do projeto, proximo passo. Nao gravar segredo, senha, token, PII sensivel.

Nunca comecar codigo, PDF, patch ou pesquisa longa sem o passo 2.

## Loop

- Objetivo em uma frase.
- Plano curto (3-7 passos) com criterio de pronto.
- Executar o menor passo que reduz incerteza.
- Evidencia no vault (`runs/YYYY-MM-DD-<slug>.md`).
- Se a tarefa for grande, decompor. No maximo 2 modos por turno.

## Modos (so o necessario)

| Modo | Quando | Fonte destilada |
|---|---|---|
| recall | sempre no inicio | vault |
| flow | automacao, pipeline, cron | automate-flows |
| design | UI, PDF, dashboard, contraste AAA | impeccable + 21st |
| humanize | texto que precisa soar humano, pt-BR direto | humanizer |
| agency | papel (ops, juridico, qa, pm) | agency-agents |
| book | transformar livro/doc longo em skill ou nota | book-to-skill |
| swarm | multi-agente so se o usuario pedir | ruflo |
| eval | medir qualidade da saida | ECC |
| media | video/imagem generativa | higgsfield |
| ship | checklist de entrega | harness-skills + deepseek-harness |

Detalhes em `references/fontes.md` e `references/vault-schema.md`.

## Regras de escrita no vault

- Uma nota = uma ideia. Frontmatter YAML curto (`id`, `title`, `tags`, `date`, `status`).
- Tags em kebab-case. Ligar notas com `related`.
- Preferir fatos e decisoes. Sem ensaio.
- Nome de arquivo `YYYY-MM-DD-slug.md`.
- Pastas fixas — `inbox/`, `notes/`, `decisions/`, `projects/`, `runs/`, `people/`, `prompts/`.

## Design (quando o modo design ligar)

- Contraste AAA. Sem texto claro em fundo claro.
- Densidade executiva, nao decoracao.
- Componentes reutilizaveis em vez de one-off.
- Texto de UI em pt-BR, curto, sem jargao de marketing.

## Humanizar (quando o modo humanize ligar)

- Frases curtas. Sujeito + verbo + objeto.
- Cortar floreio, cliche e ritmo de LLM.
- Manter o idioma e o alfabeto do usuario.

## O que esta skill NAO e

- Nao substitui docx/pdf/pptx/xlsx/ffmpeg. Encaminha para essas skills depois do recall.
- Nao clona os 11 repositorios inteiros dentro do contexto. Usa o destilado.
- Nao inventa memoria. Se a nota nao existe, diz que nao existe e cria inbox.
