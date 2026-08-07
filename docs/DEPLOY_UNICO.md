# Deploy único — LexisPredict (fix CSS + árvore)

## O que este ZIP corrige
- `Module not found: ../styles/glass-liquid.css`
- Garante pasta `styles/` na raiz + imports apontando para CSS existente

## Passo a passo (GitHub → Vercel)

1. Baixe e extraia este ZIP **na raiz** do repositório (mesma pasta do `package.json`).
2. Confira se existem:
   - `styles/glass-liquid.css`
   - `styles/leather-notes.css`
   - `styles/metal-tokens.css`
   - `app/globals.css` (imports `../src/styles/...`)
   - `src/app/globals.css` (imports `../styles/...`)
3. No terminal (opcional, local):
   ```bash
   git add styles app/globals.css src/app/globals.css docs/DEPLOY_UNICO.md
   git commit -m "fix: styles CSS na raiz + imports do globals"
   git push origin main
   ```
4. Na Vercel: aguarde o deploy automático (ou "Redeploy").
5. Se ainda falhar, faça **Clear cache and redeploy**.

## Manter ou apagar `app/`, `lib/`, `components/` da RAIZ?

| Pasta | Status | Recomendação |
|-------|--------|--------------|
| **`src/`** (`src/app`, `src/components`, `src/lib`, `src/styles`) | **Fonte da verdade** (mais páginas e módulos) | **MANTER sempre** |
| **`app/`** (raiz) | Duplicata parcial — Next pode compilar e quebrar imports | **APAGAR** depois do build estável com só `src/` |
| **`components/`** (raiz) | Duplicata; `@/*` aponta para `src/*` | **APAGAR** |
| **`lib/`** (raiz) | Duplicata; metal-preferences etc. já em `src/lib` | **APAGAR** |
| **`styles/`** (raiz) | Criada por este fix para `app/globals.css` | Manter **enquanto** existir `app/` na raiz; se apagar `app/`, pode apagar `styles/` da raiz também |

### Ordem segura para limpar a raiz (opcional, depois do build verde)

1. Confirme que o site sobe só com código em `src/`.
2. Delete na ordem:
   - `app/` (raiz)
   - `components/` (raiz)
   - `lib/` (raiz)
   - `styles/` (raiz) — só se `app/` já foi removido
3. Commit: `chore: remove árvore duplicada da raiz; canônico em src/`

**Não apague agora** se ainda estiver no meio de deploys quebrados — primeiro aplique este ZIP e estabilize o build.
