# Typeware (LexisPredict)

Camada de **contratos tipados em runtime** (Zod) nas bordas do app (Server Actions, patches).

Não é Angular. O estado do cliente continua em **Zustand** (`use-app-store`, scanner store).

## Por que não NgRx?
NgRx é ecossistema **Angular**. LexisPredict é **Next.js + React**. Migrar para NgRx quebraria o produto. O equivalente operacional é Zustand + typeware na borda.
