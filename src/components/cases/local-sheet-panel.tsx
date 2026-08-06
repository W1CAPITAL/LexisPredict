"use client";

/**
 * Painel OPCIONAL — planilha local (sem Supabase).
 * Não altera o fluxo padrão; só aparece se o usuário ativar.
 */

import React, { useRef, useState } from "react";
import {
  FileSpreadsheet,
  Upload,
  Trash2,
  Plus,
  Download,
  Loader2,
  Table2,
  RefreshCcw,
  CloudOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  useLocalSheetStore,
  localRowsAsCases,
} from "@/lib/local-sheet-store";
import { isZipBuffer, matrixToCsv, xlsxBufferToMatrix } from "@/lib/spreadsheet-io";
import { buildDossieXlsxBase64 } from "@/lib/xlsx-dossie-builder";
import { downloadBase64File } from "@/lib/download-export";
import { validateSheetMatrix } from "@/lib/xlsx-schema";

async function fileToMatrix(file: File): Promise<string[][]> {
  const buf = new Uint8Array(await file.arrayBuffer());
  const name = file.name.toLowerCase();
  if (name.endsWith('.xlsx') || name.endsWith('.xlsm') || isZipBuffer(buf)) {
    return xlsxBufferToMatrix(Buffer.from(buf));
  }
  let text = new TextDecoder('utf-8').decode(buf);
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const delim =
    (lines[0]?.match(/;/g) || []).length > (lines[0]?.match(/,/g) || []).length ? ';' : ',';
  return lines.map((line) => {
    const cols: string[] = [];
    let cur = '';
    let q = false;
    for (const ch of line) {
      if (ch === '"') {
        q = !q;
        continue;
      }
      if (ch === delim && !q) {
        cols.push(cur);
        cur = '';
        continue;
      }
      cur += ch;
    }
    cols.push(cur);
    return cols;
  });
}

const EDIT_KEYS = [
  'protocolo',
  'cliente',
  'telefone',
  'tribunal',
  'status',
  'escritorio',
  'advogado',
  'ultimo_retorno',
  'evento_resumo',
] as const;

export function LocalSheetPanel({ className }: { className?: string }) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const {
    enabled,
    setEnabled,
    rows,
    sourceName,
    loadedAt,
    setFromMatrix,
    updateCell,
    addRow,
    removeRow,
    clear,
    toMatrix,
  } = useLocalSheetStore();

  const loadFile = async (file: File) => {
    setBusy(true);
    try {
      const matrix = await fileToMatrix(file);
      const schema = validateSheetMatrix(matrix);
      if (!schema.ok) {
        toast({ title: 'Planilha inválida', description: schema.message, variant: 'destructive' });
        return;
      }
      const res = setFromMatrix(matrix, file.name);
      toast({
        title: res.ok ? 'Modo local ativo' : 'Falha',
        description: res.message,
        variant: res.ok ? 'default' : 'destructive',
      });
    } catch (e: any) {
      toast({ title: 'Erro ao ler arquivo', description: e?.message, variant: 'destructive' });
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const exportLocalDossie = async () => {
    setBusy(true);
    try {
      const cases = localRowsAsCases(rows);
      const result = await buildDossieXlsxBase64(cases);
      downloadBase64File(
        result.base64,
        result.filename.replace('Dossie', 'Local'),
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      toast({ title: 'XLSX local gerado', description: `${result.count} linhas` });
    } catch (e: any) {
      toast({ title: 'Falha export', description: e?.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const exportCsv = () => {
    const csv = matrixToCsv(toMatrix());
    const b64 = btoa(unescape(encodeURIComponent(csv)));
    downloadBase64File(b64, `lexis_local_${Date.now()}.csv`, 'text/csv;charset=utf-8');
  };

  return (
    <div
      className={cn(
        'rounded-2xl border border-dashed border-border/80 bg-card/40 p-4 space-y-3',
        className
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <CloudOff size={16} className="text-muted-foreground shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-wide">Modo planilha local</p>
            <p className="text-[10px] text-muted-foreground">
              Opcional · não usa Supabase · edição no navegador (localStorage)
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Switch id="local-sheet" checked={enabled} onCheckedChange={setEnabled} />
          <Label htmlFor="local-sheet" className="text-[10px] font-bold uppercase cursor-pointer">
            {enabled ? 'Ativo' : 'Off'}
          </Label>
        </div>
      </div>

      {enabled && (
        <>
          <div className="flex flex-wrap gap-2">
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.xlsx,.txt"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) loadFile(f);
              }}
            />
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="rounded-xl text-[10px] font-bold uppercase gap-1.5"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              Carregar / atualizar arquivo
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="rounded-xl text-[10px] font-bold uppercase gap-1.5"
              onClick={addRow}
            >
              <Plus size={14} /> Linha
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="rounded-xl text-[10px] font-bold uppercase gap-1.5"
              disabled={!rows.length || busy}
              onClick={exportLocalDossie}
            >
              <FileSpreadsheet size={14} /> XLSX dossiê local
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="rounded-xl text-[10px] font-bold uppercase gap-1.5"
              disabled={!rows.length}
              onClick={exportCsv}
            >
              <Download size={14} /> CSV
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="rounded-xl text-[10px] font-bold uppercase text-destructive gap-1.5"
              onClick={() => {
                clear();
                toast({ title: 'Planilha local limpa' });
              }}
            >
              <Trash2 size={14} /> Limpar
            </Button>
          </div>

          {(sourceName || loadedAt) && (
            <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground">
              {sourceName && (
                <Badge variant="outline" className="text-[9px]">
                  <Table2 size={10} className="mr-1" /> {sourceName}
                </Badge>
              )}
              {loadedAt && (
                <span className="flex items-center gap-1">
                  <RefreshCcw size={10} />
                  {new Date(loadedAt).toLocaleString('pt-BR')} · {rows.length} linhas
                </span>
              )}
            </div>
          )}

          <ScrollArea className="h-[280px] rounded-xl border border-border/50">
            <div className="min-w-[900px] p-2">
              <div className="grid grid-cols-[repeat(9,minmax(90px,1fr))_40px] gap-1 mb-1">
                {EDIT_KEYS.map((k) => (
                  <div
                    key={k}
                    className="text-[8px] font-black uppercase tracking-wider text-muted-foreground px-1"
                  >
                    {k.replace(/_/g, ' ')}
                  </div>
                ))}
                <div />
              </div>
              {rows.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-8">
                  Carregue um CSV/XLSX para editar aqui. Nada é gravado no Supabase neste modo.
                </p>
              )}
              {rows.map((r) => (
                <div
                  key={r.id}
                  className="grid grid-cols-[repeat(9,minmax(90px,1fr))_40px] gap-1 mb-1"
                >
                  {EDIT_KEYS.map((k) => (
                    <Input
                      key={k}
                      value={String((r as any)[k] ?? '')}
                      onChange={(e) => updateCell(r.id, k, e.target.value)}
                      className="h-8 text-[10px] rounded-lg px-1.5"
                    />
                  ))}
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive"
                    onClick={() => removeRow(r.id)}
                  >
                    <Trash2 size={12} />
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>

          <p className="text-[9px] text-muted-foreground leading-relaxed">
            Para “atualizar quando a planilha mudar”: use de novo <strong>Carregar / atualizar arquivo</strong>{' '}
            após salvar o CSV/XLSX. Integração automática com Google Sheets ao vivo exigiria API Google
            (não inclusa, para não quebrar o app). O modo produção (Supabase) permanece intacto.
          </p>
        </>
      )}
    </div>
  );
}
