# Scanner & Telemetria — contrato de estabilidade

## Antes de qualquer mudança no scanner

```bash
git checkout -b backup/scanner-$(date +%Y%m%d)
git tag backup-scanner-$(date +%Y%m%d)
```

## Núcleo congelado

Arquivos sensíveis (diff mínimo apenas):

- `src/app/actions/case-actions.ts` → `auditCaseCoreSystem`
- `src/lib/datajud-sync.ts` / `djen-sync.ts`
- `src/lib/novidade.ts` / `audit-flags.ts` (este pacote)
- Worker `src/app/api/datajud-worker/route.ts`

## Checklist de aceite (obrigatório)

1. **Rescan sem atendimento** não zera `tem_atualizacao_pos_retorno` / `djen_nova_comunicacao` se o evento pós-retorno continua válido.
2. **Atendimento** (e só ele + clear explícito) zera as três flags: `tem_atualizacao_pos_retorno`, `tem_novo_andamento`, `djen_nova_comunicacao`.
3. **Return** de `scanSingleCaseAction` inclui `movimentos` e `comunicacoes` (modal 3D).
4. **evento_tipo / evento_resumo** não viram `rotina`/null só porque “sem alteração nesta passagem”.
5. Lote local: `done` sobe, `lastLogs` enche, mode `datajud|djen|both` respeitado.
6. Worker usa **Service Role** + `empresa_id` + Bearer — não `getUserContext` de browser.
7. Typecheck / build OK nos arquivos tocados.

## Regra de produto

- **Lote local** = verdade operacional do dia.
- **Nuvem** = apoio (Hobby cron ≤ 1x/dia).
- **Logs** sempre visíveis na sessão local (`addLog`).

## Novidade (definição única)

```ts
import { resolveTemNovoAndamento } from '@/lib/novidade';
// true se DataJud OU DJEN ainda não atendidos
```

Dashboard, Tarefas, Dossiê e cards devem usar `resolveTemNovoAndamento` ou `isNovidadeAberta`.

## Política de mudança

Proibido “reforma v23 do app inteiro”.  
Permitido: patch cirúrgico + este checklist + tag de backup.
