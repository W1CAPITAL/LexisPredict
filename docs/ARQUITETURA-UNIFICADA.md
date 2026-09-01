# Lexis Unified — Local-first + Sheets (Supabase opcional)

## Objetivo
Não depender obrigatoriamente do Supabase. Operar offline com banco local e sincronizar com Google Sheets via Apps Script.

## Camadas
```
UI / EXE
  → DataProvider (local | sheets | supabase)
      → IndexedDB (primário offline)
      → Apps Script API (auth + push/pull)
      → Google Sheets (espelho editável)
```

## O que este delta entrega
- `src/lib/data-provider/*` — interface + Local + Sheets + stub Supabase
- `apps-script/LEXIS-UNIFIED-API.gs` — ping, auth, list, write
- `/setup-planilha` — conectar webhook, login, pull/push
- Badge de modo (opcional na sidebar)
- Supabase **não removido** — `NEXT_PUBLIC_DATA_PROVIDER=supabase` é o default seguro

## O que ainda é roadmap (não neste zip)
- Migrar todas as pages (/cases, /processos) para `getDataProvider()` em vez de server-db
- EXE offline unificado com o mesmo core
- Leadcheck/CRM/GREY como rotas de módulo no mesmo app
- Resolução avançada de conflitos campo a campo

## Próximos PRs sugeridos
1. `cases/page.tsx` — se kind!==supabase, listar via `getDataProvider().processes.list()`
2. Incorporar scanner Leadcheck como `/leads`
3. Electron/EXE apontando para o mesmo bundle
