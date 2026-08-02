# Integração do pacote SAFE (diff mínimo)

## 1. Copiar arquivos novos/substituídos

```text
src/lib/novidade.ts
src/lib/merito-detect.ts
src/lib/dashboard-metrics.ts
src/lib/office-score.ts
src/lib/health-metrics.ts
src/lib/veredito-sources.ts
src/lib/audit-flags.ts
src/lib/theme.ts                    ← substitui (mais presets + contraste)
src/components/layout/sidebar.tsx   ← sem aba Notificações + scroll estável
src/components/ui/datajud-disclaimer.tsx
src/components/onboarding/guided-tour.tsx
src/app/onboarding/page.tsx
src/styles/lexis-motion.css
README.md
docs/SCANNER_STABILITY.md
```

## 2. globals.css

```css
@import "../styles/lexis-motion.css";
```

## 3. processarCaso (já quase certo)

Garantir:

```ts
const novidadeUnificada = temAndamentoDataJud || temAndamentoDjen || toBool(data.tem_novo_andamento);
// ...
tem_novo_andamento: novidadeUnificada,
tem_atualizacao_pos_retorno: temAndamentoDataJud,
djen_nova_comunicacao: temAndamentoDjen,
```

Opcional: `import { resolveTemNovoAndamento } from '@/lib/novidade'`.

## 4. Dashboard `src/app/page.tsx`

Trocar o `useMemo` de metrics por:

```ts
import { buildDashboardMetrics } from '@/lib/dashboard-metrics';
import { DataJudDisclaimer } from '@/components/ui/datajud-disclaimer';

const metrics = useMemo(() => buildDashboardMetrics(cases, t), [cases, t]);
```

Nos cards, adicionar:

```tsx
<StatCard title="Procedentes" value={metrics.countProcedente} ... />
<StatCard title="Improcedentes" value={metrics.countImprocedente} ... />
<StatCard title="Audiências" value={metrics.countAudienciaPosRetorno} ... />
```

E no topo da main (abaixo do header):

```tsx
<DataJudDisclaimer compact className="mb-4" />
```

## 5. OfficeStats

```ts
import { scoreByGroup, scoreLabel } from '@/lib/office-score';
const units = scoreByGroup(cases, 'escritorio');
// authorityPoints já inclui procedente (+8), improcedente (-6), audiência pós-retorno (-3)
```

## 6. Veredito — fallback DJEN

No `handleSearch` modo CNJ, **antes** ou **junto** do `executarVereditoAI`:

```ts
import { resolveVereditoByCnj } from '@/lib/veredito-sources';

const sources = await resolveVereditoByCnj(cnj);
// Se sources.success: passar sources.movimentos / comunicacoes para o resultado da UI
// Se DataJud vazio e DJEN ok: mostrar aviso sources.message e timeline DJEN
```

Quando CPF/nome não achar no DataJud, manter fluxos atuais e, se o usuário abrir um CNJ da lista, usar o mesmo `resolveVereditoByCnj`.

## 7. auditCaseCoreSystem (flags)

```ts
import { buildIdempotentAlertFlags, mergeEventoMerito } from '@/lib/audit-flags';
import { detectMeritoFromSources } from '@/lib/merito-detect';

const flags = buildIdempotentAlertFlags({
  datajudOk: hasSuccessDj,
  djenOk: hasSuccessDjen,
  alertaDatajud: upd.alerta,
  alertaDjen: djenSync.alerta,
  prevDatajud: target.tem_atualizacao_pos_retorno,
  prevDjen: target.djen_nova_comunicacao,
});
Object.assign(patch, flags);

const merito = detectMeritoFromSources({
  movimentos,
  comunicacoes,
  ultimoRetorno: target.ultimoRetorno,
});
if (merito.eventoTipo && merito.aposRetorno) {
  const merged = mergeEventoMerito(
    target.evento_tipo,
    target.evento_resumo,
    merito.eventoTipo,
    merito.resumo
  );
  patch.evento_tipo = merged.evento_tipo;
  patch.evento_resumo = merged.evento_resumo;
}
```

Atendimento: `Object.assign(case, patchClearNovidade())` de `@/lib/novidade`.

## 8. Settings — temas

Listar `AUTHORITY_PRESETS` e chamar `applyPresetById(id)` ou `applyGlobalTheme`.

## 9. Não fazer

- Não reativar `/notificacoes` no sidebar.
- Não “reforma v30” do scanner.
- Não limpar alerta no scan.
- Não perseguir IA própria antes da telemetria estável.
