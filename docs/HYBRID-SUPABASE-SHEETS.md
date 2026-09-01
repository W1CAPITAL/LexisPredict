# Modo híbrido — Supabase + Google Sheets

## Objetivo
- **Supabase**: login, empresa, cargos, permissões (RLS).
- **Sheets (Apps Script)**: carteira operacional (Protocolo, RETORNO M, PRÓXIMO N, andamento DataJud/DJEN).
- **Menos Postgres**: scanner não grava dezenas de updates + auditoria por CNJ.

## Env (Vercel)
```
LEXIS_HYBRID_MODE=sheets_carteira_scan
LEXIS_SHEETS_WEBHOOK_URL=https://script.google.com/macros/s/XXXX/exec
LEXIS_SHEETS_TOKEN=w1-fase1-2026
LEXIS_HYBRID_MIRROR_PG=false
LEXIS_HYBRID_SKIP_SCAN_AUDIT=true
```

| Modo | Efeito |
|------|--------|
| `off` | Tudo no Supabase (legado) |
| `sheets_carteira` | Pull/push M/N na planilha; scan ainda pode tocar PG |
| `sheets_carteira_scan` | Scan grava resultado na planilha; PG só se `MIRROR_PG=true` |

## Apps Script
Reutilize o webhook do Lexis Gabinete offline (`action=ping|list|write`).  
Colunas úteis: Protocolo, UltimoRetorno, ProximoRetorno, ultimo_movimento, DJEN_Resumo, DatajudEncerrado, Responsavel.

## Auth
Continua **Supabase Auth**. A planilha **não** autentica o web app.  
O offline pode seguir com auth na planilha; o web usa JWT Supabase e só sincroniza carteira.

## Fluxo
1. Usuário loga no Lexis (Supabase).
2. `/plano-b` → painel híbrido → Puxar carteira Sheets.
3. Scanner (supervisão) → DataJud/DJEN → **write** na planilha em lote.
4. Operador vê prazos M/N na planilha / Plano B; Postgres não explode com logs de scan.

## Offline
O OFFLINE-LEXISPREDICT já faz auth parcial por planilha.  
No híbrido web, a planilha é a **mesma** carteira; usuários/cargos oficiais ficam no Supabase.
