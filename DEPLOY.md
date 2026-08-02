# LexisPredict — Pacote de correção (deploy único)

## O que este ZIP corrige
1. Telemetria que congelava (`pending`/`audited` errados) → agora: `scanned1h`, `stale/pending`, `neverScanned`, `ba`
2. Fila do worker monopolizada → cooldown 90 min + prioridade BA
3. `datajud_last_ok` / `djen_last_ok` gravados no scan
4. `alert_events` só quando a novidade **nasce** (não a cada rescan)
5. Mapeamento completo ao ler casos (`tem_novo_andamento`, `djen_count`, etc.)

## Arquivos incluídos (caminhos relativos à raiz do repo)
```
src/lib/server-db.ts
src/lib/scan-metrics.ts
src/lib/djen.ts
src/app/actions/case-actions.ts
src/app/api/datajud-worker/route.ts
src/app/api/datajud-status/route.ts
src/app/api/datajud-trigger/route.ts
src/app/api/djen-proxy/route.ts
src/app/api/scan-health/route.ts   (se existir)
src/app/api/queue/enqueue-scan/route.ts (se existir)
sql/01_observabilidade.sql
```

## Passos no GitHub (browser)
1. Abra https://github.com/daviconcentrix-debug/LexisPredict
2. **APAGUE** o arquivo duplicado se existir: `src/app/case-actions.ts` (NÃO o de `src/app/actions/`)
3. Para cada arquivo do ZIP, vá no caminho correspondente → Edit (lápis) ou Upload file na pasta
4. Cole o conteúdo / faça upload mantendo o **mesmo path**
5. Commit na branch `main`
6. Vercel fará o deploy automático

## Supabase (1x)
1. SQL Editor → cole `sql/01_observabilidade.sql` → Run

## Validação (15 min após deploy)
- Worker continua 200 no Vercel
- `/api/datajud-status` deve mostrar `scanned1h` > 0 enquanto o omni roda
- `pending` = ativos com scan > 24h (ou nunca), não “0 eterno”

## NÃO use
- Firebase “Add files via upload” misturando pastas
- Substituir a pasta `actions` inteira sem cuidado
