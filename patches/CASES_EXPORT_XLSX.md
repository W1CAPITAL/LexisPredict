# Processos — botão "Extrair Planilha" → XLSX Dossiê

## 1. Imports em `src/app/cases/page.tsx`

Substitua:

```ts
import { exportCasesToCSVAction } from '@/app/actions/export-actions';
```

Por:

```ts
import { exportDossieXlsxAction, exportCasesToCSVAction } from '@/app/actions/export-dossie-xlsx';
// se preferir manter export-actions.ts, reexporte de lá as mesmas funções
import { LocalSheetPanel } from '@/components/cases/local-sheet-panel';
```

## 2. Substitua `handleExportCSV` por isto

```ts
  const handleExportCSV = async () => {
    setExporting(true);
    try {
      // 1º tenta XLSX dossiê operacional
      const res = await exportDossieXlsxAction();
      if (res.success && res.base64) {
        const link = document.createElement('a');
        link.href = `data:${res.mime || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'};base64,${res.base64}`;
        link.download = res.filename || 'LexisPredict_Dossie.xlsx';
        link.click();
        toast({
          title: 'Dossiê XLSX exportado',
          description: res.count != null ? `${res.count} processos · Capa + Dashboard + Carteira` : undefined,
        });
        return;
      }
      // fallback CSV se XLSX falhar
      const csv = await exportCasesToCSVAction();
      if (csv.success && csv.base64) {
        const link = document.createElement('a');
        link.href = `data:text/csv;base64,${csv.base64}`;
        link.download = csv.filename || 'export_processos.csv';
        link.click();
        toast({ title: 'CSV exportado (fallback)', description: (res as any).error });
      } else {
        toast({
          title: 'Falha na exportação',
          description: (res as any).error || (csv as any).error,
          variant: 'destructive',
        });
      }
    } catch (e: any) {
      toast({ title: 'Erro', description: e?.message, variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  };
```

## 3. Texto do botão (opcional)

```tsx
{exporting ? <Loader2 .../> : <FileDown .../>} Extrair XLSX Dossiê
```

## 4. Painel planilha local (opcional — não quebra Supabase)

Abaixo do header da página Processos:

```tsx
<LocalSheetPanel className="mb-4" />
```

Desligado por padrão (`enabled: false`).
