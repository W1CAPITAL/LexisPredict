# Autoaprimoramento Lexis (inspirado em Ornith) — app inteiro

Ornith propõe: **detectar falha → gerar tarefa → scaffold → validar → incorporar**.
No Lexis **não** rodamos RL em pesos de modelo. Rodamos o mesmo **loop operacional**
sobre o produto (save, KPI, DJEN, cadastro, escopo).

## Loop

```
1. SINAL          logs de produção (HTML no DJEN, save falhou, KPI divergente)
2. TAREFA         issue estruturada (módulo + repro steps + métrica de sucesso)
3. SCAFFOLD       patch mínimo (1 action / 1 lib) — sem “lote de 40 arquivos”
4. ROLLOUT        typecheck + teste smoke + 1 caso real
5. GATE           só mergeia se métrica subiu (ex.: confianca extrato ≥ 80 no PDF amostra)
6. MEMÓRIA        docs/failures/YYYY-MM-DD-tema.md para não repetir regressão
```

## Onde plugar no repo

| Sinal | Módulo | Métrica |
|-------|--------|---------|
| DJEN HTML | `djen-client` / gerador | % respostas JSON |
| Save quebrado | `case-save-actions` | % saves Postgres OK |
| KPI errado | `kpi-*-actions` | parity dashboard vs SQL |
| Extrato PDF incompleto | `extrato-distribuicao-parse` | confianca ≥ 80 no gold set |
| Escopo vazou carteira | `server-db` / RLS | 0 processos alheios para operador |

## Script existente

`npm run autoimprove` → `scripts/selfimprove/cycle.mjs`

Estender o cycle para:
1. Ler `docs/failures/*.md` e logs Vercel (se houver)
2. Priorizar P0: save > KPI > DJEN > features novas
3. Nunca abrir hybrid Sheets como fix de save

## Gold set cadastro (obrigatório)

Arquivo `docs/gold/extrato-silwany.txt` = texto do PDF amostra.
Teste: `parseExtratoDistribuicao` deve retornar:

- protocolo `5001032-25.2026.8.01.0006`
- autor SILWANY…
- réu BANCO DO BRASIL
- valor 82890.98
- OAB SP370898
- TJAC
