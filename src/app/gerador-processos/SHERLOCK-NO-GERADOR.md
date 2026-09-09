# Encaixar no gerador-processos/page.tsx

1. Import:
```tsx
import { SherlockPanel } from "@/components/sherlock-panel";
```

2. No topo do formulário (depois dos filtros), uma área:
```tsx
<SherlockPanel compact />
```

3. Em cada card de processo, botão que pré-preenche nome — ou use o painel com:
```tsx
<SherlockPanel defaultNome={p.nome_completo} compact />
```

Não é obrigatório ter API. Se SHERLOCK_ENABLED=false ou URL inválida no Vercel, o painel mostra “off / opcional”.
