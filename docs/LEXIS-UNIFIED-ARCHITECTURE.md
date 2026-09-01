# LexisPredict Unified — Local-first + Google Sheets

## Objetivo
Um único produto (LexisPredict) que **não depende de pagar Supabase**.

```
Lexis (Web / EXE / PWA)
        │
   LocalProvider (IndexedDB / SQLite)
        │
   SyncEngine + outbox
        │
   SheetsProvider → Apps Script Web App
        │
   Google Sheets (espelho editável)
```

Supabase vira **provider opcional** no futuro (`SupabaseProvider`), não obrigatório.

## O que já existe para reaproveitar
| Repo | Peça |
|------|------|
| OFFLINE-LEXISPREDICT | `LEXIS-SYNC-AppsScript.gs`, `LEXIS-DB-AppsScript.gs`, outbox 2 vias |
| Leadcheck / LEADCHECKIN | CRM leads, consent, CSV |
| SyncCRM | mentalidade planilha ↔ CRM |
| GREY | Brain/IA self-host opcional |
| SITE | landing apenas |

## Fases
1. **Core local** — `LocalProvider` + outbox (este pacote)
2. **API Sheets** — `LEXIS-UNIFIED-API.gs` (login + push/pull)
3. **UI sync** — badge pendentes / conflitos / “Sincronizar agora”
4. **Migrar processos/tarefas** para escrever via `upsertLocal` em vez de só Supabase
5. **Leadcheck módulo** dentro do Lexis
6. **Supabase adapter** opcional para quem ainda tiver cota

## Limites honestos do Sheets
- Ótimo: milhares a dezenas de milhares de linhas, CRM, usuários, config
- Ruim: milhões de linhas, analytics pesado, milhares de usuários simultâneos
- Por isso o **banco primário é local**; Sheets é espelho + admin humano

## Segurança
- Nunca: front → lê aba USUARIOS direto
- Sempre: front → Apps Script → Sheet
- Token no script; hash de senha; planilha de usuários sem compartilhar com operadores
