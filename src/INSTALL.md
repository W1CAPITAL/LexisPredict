# PATCH CORS + Mérito + Chat xAI + Busca CPF

## 1. Causa do CORS (Veredito)

O browser chamava `api-publica.datajud.cnj.jus.br` direto.  
**DataJud não permite CORS** a partir do Vercel.

### Faça AGORA em `src/app/veredito/page.tsx`

1. **Delete** a linha:
```ts
import { searchDataJudByNome, searchDataJudByCpf, fetchDataJud } from '@/lib/datajud';
```

2. **Use só**:
```ts
import {
  searchProcessesByCpfAction,
  searchProcessesByNomeAction,
  enrichProcessTimelineAction,
} from '@/app/actions/search-actions';
```

3. No modo **nome**, troque `searchDataJudByNome(...)` por:
```ts
const res = await searchProcessesByNomeAction(nomeQuery.trim());
```

4. Copie o padrão de `src/app/veredito/VEREDITO_CLIENT_FIX.ts` (handlers).

5. Em `src/lib/datajud.ts`, no início de `fetchDataJud`, `searchDataJudByCpf`, `searchDataJudByNome`:
```ts
import { assertDataJudServerOnly } from './datajud-browser-guard';
assertDataJudServerOnly();
```

6. Copie `src/app/api/datajud-search/route.ts` e `src/app/actions/search-actions.ts`.

Depois do deploy: no DevTools → Network **não** deve aparecer request do **document** para `api-publica.datajud`.

---

## 2. Contadores Procedente / Improcedente (OBRIGATÓRIO)

### Painel `src/app/page.tsx`

```tsx
import { MeritCounters } from '@/components/dashboard/merit-counters';

// Dentro do return, após os StatCards principais (visível):
<MeritCounters cases={cases} className="mb-6" />
```

### Dossiê `src/app/report/page.tsx`

```tsx
import { MeritCounters } from '@/components/dashboard/merit-counters';

<MeritCounters cases={cases} title="Mérito no dossiê" className="mb-6" />
```

Sem essas duas linhas no JSX, **não aparece** — o componente sozinho no ZIP não se injeta.

Números vêm de `evento_tipo` após o scanner (`sentenca_procedente` / `sentenca_improcedente`).  
Se tudo zero: rode scanner híbrido e confira se `evento_tipo` está gravando.

---

## 3. Chat xAI

Substitua `src/app/chatbot-separado/actions.ts` pelo deste ZIP.

- Tenta vários modelos xAI  
- Se falhar → **Groq automático**  
- Mensagem de erro cita env: `XAI_API_KEY`, `XAI_MODEL`, `GROQ_API_KEY`

Na Vercel:
```
XAI_API_KEY=...
XAI_MODEL=grok-2-latest
GROQ_API_KEY=...
```

---

## 4. Busca CPF / nome / B.A.

`search-actions.ts` (server only):

- Carteira + DataJud CPF + fallback nome  
- Filtro `onlyBA`  
- Mensagem clara se 0 hits  
- `enrichProcessTimelineAction` = DataJud → DJEN  

---

## Arquivos do ZIP

| Path | Ação |
|------|------|
| `src/app/actions/search-actions.ts` | Copiar |
| `src/app/api/datajud-search/route.ts` | Copiar |
| `src/lib/datajud-browser-guard.ts` | Copiar + usar em datajud.ts |
| `src/app/veredito/VEREDITO_CLIENT_FIX.ts` | Referência para page.tsx |
| `src/components/dashboard/merit-counters.tsx` | Copiar + **usar no page e report** |
| `src/lib/dashboard-metrics.ts` etc. | Copiar |
| `src/app/chatbot-separado/actions.ts` | Substituir |
| `docs/CORS_DATAJUD.md` | Ler |

## Não incluído

SUS / cpfFinder / cadastro civil.
