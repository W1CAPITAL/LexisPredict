# Troca obrigatória no scan

Onde estava:
```ts
const digits = extractCnjRobusto(it.numero_processo, it.texto);
```

Use:
```ts
import { extractCnjSeguro, extractTelefoneSeguro, cnjEstruturaPlausivel } from "@/lib/cnj-higiene";

const digits = extractCnjSeguro(it.numero_processo, it.texto, {
  siglaTribunal: sigla || it.siglaTribunal,
});
if (!digits) { skipCnj++; continue; }
```

Telefone:
```ts
const telTeor = extractTelefoneSeguro(it.texto);
```

No log, se quiser:
```ts
// opcional: contar motivo
```
