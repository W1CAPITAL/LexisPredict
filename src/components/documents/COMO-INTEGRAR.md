# Partes editáveis — como integrar

## 1. Imports

```tsx
import { EditablePartesPanel } from "@/components/documents/editable-partes-panel";
import { usePartesEditaveis } from "@/hooks/use-partes-editaveis";
import { qualificarCliente, qualificarAdvogado } from "@/lib/partes-editaveis";
```

## 2. No componente da página

```tsx
const {
  banca, setBanca,
  cliente, setCliente,
  advogados, setAdvogados,
  aplicarExtracao, persist,
} = usePartesEditaveis();
```

## 3. Após extração OCR/IA

```tsx
const res = await extrairDadosDocumentosAction(texto);
aplicarExtracao(res);
```

## 4. Step de revisão (antes do PDF)

```tsx
<EditablePartesPanel
  banca={banca}
  setBanca={setBanca}
  advogados={advogados}
  setAdvogados={setAdvogados}
  cliente={cliente}
  setCliente={setCliente}
  tituloCliente="Outorgante / Cliente"
/>
```

## 5. No template / PDF

Use o valor cru:

```tsx
${cliente.estado_civil}
${cliente.nacionalidade}
${qualificarCliente(cliente)}
${qualificarAdvogado(advogados[0])}
```

**Nunca** force `"casado"` ou `"brasileiro"` como fallback.
