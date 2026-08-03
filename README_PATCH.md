# LexisPredict Elite — patch planilha / build / sync

## Correção crítica de build (Vercel)

```
Error: Only async functions are allowed to be exported in a "use server" file.
export { exportDossieXlsxAction, ... } from './export-dossie-xlsx';
```

**Causa:** em `'use server'` o Next 15 **não permite** reexport `export { } from`.

**Correção:** substituir `src/app/actions/export-actions.ts` pelo arquivo deste ZIP  
(todas as funções são `export async function` no mesmo arquivo).

Remova ou não use um `export-actions.ts` que só reexporta.

---

## Extrair Planilha → XLSX dossiê

1. Substitua `export-actions.ts`
2. Em `cases/page.tsx` importe de `@/app/actions/export-actions`:
   - `exportDossieXlsxAction`
   - `exportCasesToCSVAction`
3. Use o handler em `patches/CASES_EXPORT_HANDLER.ts`

Abas do XLSX: **Capa · Dashboard · Processos · Por_Status · Por_Escritorio**

---

## SheetJS (opcional)

```bash
npm i xlsx
```

`src/lib/sheetjs-bridge.ts` usa SheetJS se existir; senão fallback JSZip (`spreadsheet-io`).

---

## WebSocket / sync em tempo real

Não é socket custom: **Supabase Realtime** (WebSocket gerenciado).

```ts
import { useProcessosRealtime } from '@/hooks/use-processos-realtime';

useProcessosRealtime({
  empresaId,
  enabled: preferences.realtime === true, // opcional
  onChange: () => loadData(), // seu fetchRepoCases
});
```

No Supabase: Database → Replication → publique a tabela `processos`.

Desligado por padrão se `enabled: false` → zero impacto.

---

## Desempenho (sem quebrar)

| Prática | Status |
|---------|--------|
| `useMemo` em métricas do dashboard | manter |
| DataJud só em server actions | manter |
| Realtime com debounce 1,2s | hook incluso |
| Export limit 5000 linhas | export-actions |
| Evitar reexport em `"use server"` | corrigido |
| Partículas / anim off se `reducedMotion` | preferências UI |

Não aumente concorrência do scanner DataJud no Hobby.

---

## Modo planilha local

`LocalSheetPanel` + `local-sheet-store` — off por padrão, só localStorage.

---

## Arquivos deste patch

```
src/app/actions/export-actions.ts    ← OBRIGATÓRIO (build)
src/lib/xlsx-dossie-builder.ts
src/lib/xlsx-schema.ts
src/lib/spreadsheet-io.ts
src/lib/sheetjs-bridge.ts
src/lib/download-export.ts
src/lib/local-sheet-store.ts
src/hooks/use-processos-realtime.ts
src/components/cases/local-sheet-panel.tsx
patches/CASES_EXPORT_HANDLER.ts
README_PATCH.md
```

```bash
unzip -o LexisPredict_FINAL_BUILD_FIX.zip
npm i xlsx   # opcional
# aplicar handler no cases/page.tsx
```
