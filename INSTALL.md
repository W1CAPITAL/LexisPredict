# LexisPredict — pacote de correções UI / Tutorial / README

## Conteúdo deste ZIP

```text
README.md                          → substituir o README da raiz do projeto
INSTALL.md                         → este arquivo
src/components/layout/sidebar.tsx  → scroll estável + ícones + Alertas
src/components/onboarding/guided-tour.tsx  → guia atualizado ao produto
src/app/onboarding/page.tsx        → página de vídeo alinhada
src/styles/lexis-motion.css        → animações suaves + overflow
```

## Como aplicar

Na raiz do repositório LexisPredict:

1. Faça backup dos arquivos que serão substituídos.
2. Copie preservando pastas:

```bash
cp README.md /caminho/do/LexisPredict/README.md
cp src/components/layout/sidebar.tsx /caminho/do/LexisPredict/src/components/layout/sidebar.tsx
cp src/components/onboarding/guided-tour.tsx /caminho/do/LexisPredict/src/components/onboarding/guided-tour.tsx
cp src/app/onboarding/page.tsx /caminho/do/LexisPredict/src/app/onboarding/page.tsx
cp src/styles/lexis-motion.css /caminho/do/LexisPredict/src/styles/lexis-motion.css
```

3. Em `src/app/globals.css`, adicione **uma linha** (perto do topo, após os `@tailwind`):

```css
@import "../styles/lexis-motion.css";
```

4. Se a rota `/notificacoes` não existir no seu deploy, ou remova o item “Alertas de Mérito” do `sidebar.tsx`, ou mantenha a página de notificações já existente no app.

5. `npm run build` e valide: rolar a sidebar, Guia do Sistema, /onboarding.

## O que foi corrigido

| Problema | Correção |
|----------|----------|
| Sidebar volta ao topo ao rolar / navegar | Conteúdo do menu **não é mais um componente aninhado** que remontava a cada render; scroll preservado + `overscroll-contain` |
| Tutorial desatualizado | Passos do guia falam de DataJud∪DJEN, fila unificada, alertas de mérito, dossiê Top 10, flags só no atendimento |
| README genérico | README com fluxo, módulos, limites honestos, onboarding |
| Cards “secos” | `lexis-card-motion` + hover suave; `prefers-reduced-motion` respeitado |
| Estouro de layout | `min-w-0`, `overflow-hidden` / `truncate` no menu e no guia |

## O que este pacote NÃO altera

- Scanner DataJud / worker / case-actions  
- Schema Supabase / RLS  
- Lógica de flags, scripts, IA  
- Auth multi-tenant  

Apenas UI, tutorial, README e camada de motion.
