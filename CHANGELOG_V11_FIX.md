# LexisPredict v11.1 — Correções Críticas (Deploy Único)

## Problemas corrigidos

### 1. ReferenceError: isRecalibrating is not defined
- **Causa:** variável declarada dentro de `CaseRow`, usada em `CasesContent`.
- **Correção:** estado movido para `CasesContent`.

### 2. Falsos alertas "ALERTA: BUSCA E APREENSÃO"
- **Causa:** `indicio_busca_apreensao` era gravado com OR do valor antigo (`ba.indicio || target.indicio...`), então um falso-positivo antigo nunca era limpo. DJEN classificava "BA" por mera menção em jurisprudência.
- **Correção:**
  - `case-actions.ts`: confia 100% na análise atual de `analisarBuscaApreensao` (permite limpar).
  - `djen.ts`: `classifyEventFromText` só marca BA com mandado/liminar explícito de apreensão de veículo.
  - `summarizeDjenKeywords` agora devolve **frase descritiva** (ex.: "Sentença parcialmente procedente") em vez de tags crípticas "BA | SENTENÇA | TRÂNSITO/BAIXA".

### 3. Segurança
- Chaves de API hardcoded removidas de `document-flow.ts` e `src/ai/flows/document-flow.ts`.
- Usar variáveis de ambiente: `XAI_API_KEY`, `GROQ_API_KEY`, `AIRFORCE_API_KEY`.

### 4. Já presentes no pacote
- Scanner retoma de onde parou (`use-datajud-scan-store.ts` + localStorage).
- Motor BA anti-falso-positivo por classe processual (`busca-apreensao.ts`).
- Telemetria de saúde por tribunal.

## Após o deploy
1. Rode um rescan (manual ou cloud) nos processos que ainda aparecem como BA indevidamente — o flag será limpo automaticamente quando a análise atual disser `indicio: false`.
2. Ou, no CRM "Gerir Caso", remova manualmente a etiqueta BA dos casos já conhecidos como revisional.
3. Configure as env vars de IA se usar extração documental.

## Arquivos alterados nesta correção
- `src/app/cases/page.tsx`
- `src/app/actions/case-actions.ts`
- `src/lib/djen.ts`
- `document-flow.ts`
- `src/ai/flows/document-flow.ts`
