# Patch — src/app/cases/page.tsx (isRecalibrating)

## Problema
`ReferenceError: isRecalibrating is not defined` no bundle de produção.
O estado era referenciado fora do escopo (ou residual de build antigo).

## Correção mínima (adicione dentro de `CasesContent`)

Logo após as outras declarações de `useState` (por volta da linha 129–150), inclua:

```tsx
  // Fix ReferenceError: isRecalibrating is not defined
  const [isRecalibrating, setIsRecalibrating] = useState(false);
```

Se houver alguma função de "recalibrar" / rescan em lote, use:

```tsx
  const handleRecalibrate = async () => {
    if (isRecalibrating) return;
    setIsRecalibrating(true);
    try {
      await loadData();
      // opcional: disparar scan leve dos casos visíveis
    } finally {
      setIsRecalibrating(false);
    }
  };
```

E no botão de atualizar/recalibrar:

```tsx
  <Button
    variant="ghost"
    size="icon"
    onClick={handleRecalibrate}
    disabled={isRecalibrating || loading}
  >
    <RefreshCcw size={18} className={cn((isRecalibrating || loading) && "animate-spin text-primary")} />
  </Button>
```

## Importante
Após o push, no Vercel use **Clear cache and redeploy**.  
Chunks antigos (`page-cf69b7b53e688d7c.js`) continuam servindo o erro até o cache ser limpo.
