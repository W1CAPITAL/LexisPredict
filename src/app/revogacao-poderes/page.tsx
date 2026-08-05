/**
 * Revogação de poderes + substabelecimento
 * 1) Escolhe advogado a revogar (banca) + UF
 * 2) Scanner lista só processos desse advogado na carteira do usuário
 * 3) Filtra elegíveis (não encerrado / não cumprimento)
 * 4) Opcional: reforço DJEN/DataJud
 * 5) Escolhe advogado novo (banca) → baixar PDF por processo
 */
"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  listBancaForRevogacaoAction,
  scanCarteiraRevogacaoAction,
  reforcoTribunalRevogacaoAction,
  generateRevogacaoPdfAction,
  type RevogacaoCaseItem,
} from "@/app/actions/revogacao-actions";
import {
  Scale,
  Loader2,
  Download,
  RefreshCcw,
  Search,
  Shield,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";

const UFS = [
  "TODOS",
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
  "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

function downloadBase64Pdf(base64: string, filename: string) {
  const a = document.createElement("a");
  a.href = `data:application/pdf;base64,${base64}`;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export default function RevogacaoPoderesPage() {
  const { toast } = useToast();
  const [banca, setBanca] = useState<any[]>([]);
  const [leavingId, setLeavingId] = useState("");
  const [enteringId, setEnteringId] = useState("");
  const [uf, setUf] = useState("TODOS");
  const [items, setItems] = useState<RevogacaoCaseItem[]>([]);
  const [loadingScan, setLoadingScan] = useState(false);
  const [loadingBanca, setLoadingBanca] = useState(true);
  const [reinforcing, setReinforcing] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [onlyElegiveis, setOnlyElegiveis] = useState(true);
  const [advNome, setAdvNome] = useState("");

  useEffect(() => {
    (async () => {
      setLoadingBanca(true);
      const res = await listBancaForRevogacaoAction();
      if (res.success) {
        const list = (res.banca || []).filter((a: any) => a.ativo !== false);
        setBanca(list);
        if (list[0]) setLeavingId(String(list[0].id));
        if (list[1]) setEnteringId(String(list[1].id));
        else if (list[0]) setEnteringId(String(list[0].id));
      } else {
        toast({ title: "Banca", description: res.error, variant: "destructive" });
      }
      setLoadingBanca(false);
    })();
  }, [toast]);

  const runScan = useCallback(async () => {
    if (!leavingId) {
      toast({ title: "Selecione o advogado a revogar", variant: "destructive" });
      return;
    }
    setLoadingScan(true);
    try {
      const res = await scanCarteiraRevogacaoAction({
        advogadoRevogarId: leavingId,
        uf: uf === "TODOS" ? null : uf,
      });
      if (!res.success) {
        toast({ title: "Scanner", description: res.error, variant: "destructive" });
        setItems([]);
        return;
      }
      setItems(res.items);
      setAdvNome(res.advogadoNome || "");
      toast({
        title: "Scanner concluído",
        description: `${res.elegiveis} elegíveis de ${res.total} processo(s) do advogado`,
      });
    } finally {
      setLoadingScan(false);
    }
  }, [leavingId, uf, toast]);

  const runReforco = async () => {
    const alvo = items.filter((i) => (onlyElegiveis ? i.elegivel : true)).slice(0, 40);
    if (!alvo.length) {
      toast({ title: "Nada para reforçar" });
      return;
    }
    setReinforcing(true);
    const next = [...items];
    for (const it of alvo) {
      try {
        const r = await reforcoTribunalRevogacaoAction(it.protocolo);
        if (r.success) {
          const idx = next.findIndex((x) => x.protocolo === it.protocolo);
          if (idx >= 0) {
            next[idx] = {
              ...next[idx],
              elegivel: r.elegivel,
              motivo: r.motivo,
              encerrado: r.encerrado,
              cumprimento: r.cumprimento,
              ultimoAdvogadoDetectado:
                r.ultimoAdvogadoDetectado || next[idx].ultimoAdvogadoDetectado,
              djenChecked: true,
            };
          }
        }
      } catch {
        /* */
      }
      // leve pausa anti rate-limit
      await new Promise((r) => setTimeout(r, 400));
    }
    setItems(next);
    setReinforcing(false);
    toast({ title: "Reforço tribunal concluído", description: `${alvo.length} processo(s)` });
  };

  const downloadOne = async (it: RevogacaoCaseItem) => {
    if (!leavingId || !enteringId) {
      toast({ title: "Selecione os dois advogados da banca", variant: "destructive" });
      return;
    }
    if (leavingId === enteringId) {
      toast({ title: "Advogados devem ser diferentes", variant: "destructive" });
      return;
    }
    setDownloading(it.protocolo);
    try {
      const res = await generateRevogacaoPdfAction({
        protocolo: it.protocolo,
        cliente: it.cliente,
        tribunal: it.tribunal,
        uf: it.uf,
        advogadoRevogarId: leavingId,
        advogadoNovoId: enteringId,
        ultimoAdvogadoDetectado: it.ultimoAdvogadoDetectado,
        observacaoScanner: it.motivo,
        comarca: it.uf || "São Paulo",
      });
      if (!res.success || !(res as any).base64) {
        toast({
          title: "PDF",
          description: (res as any).error || "Falha",
          variant: "destructive",
        });
        return;
      }
      downloadBase64Pdf((res as any).base64, (res as any).filename || "revogacao.pdf");
      toast({ title: "PDF baixado", description: it.protocolo });
    } finally {
      setDownloading(null);
    }
  };

  const downloadAllElegiveis = async () => {
    const list = items.filter((i) => i.elegivel);
    for (const it of list) {
      await downloadOne(it);
      await new Promise((r) => setTimeout(r, 500));
    }
  };

  const visible = useMemo(
    () => (onlyElegiveis ? items.filter((i) => i.elegivel) : items),
    [items, onlyElegiveis]
  );

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden glass-panel">
        <header className="shrink-0 border-b p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 border-2 border-primary flex items-center justify-center">
              <Scale className="text-primary" size={20} />
            </div>
            <div>
              <h1 className="text-sm font-black uppercase tracking-widest">
                Revogação + Substabelecimento
              </h1>
              <p className="text-[10px] text-muted-foreground font-bold uppercase">
                Carteira do usuário · banca · filtro UF · scanner · PDF
              </p>
            </div>
          </div>
        </header>

        <div className="shrink-0 p-4 border-b grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 bg-card/40">
          <div>
            <Label className="text-[9px] font-black uppercase">Advogado a revogar (banca)</Label>
            <Select value={leavingId} onValueChange={setLeavingId} disabled={loadingBanca}>
              <SelectTrigger className="h-11 rounded-xl mt-1">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {banca.map((a) => (
                  <SelectItem key={a.id} value={String(a.id)}>
                    {a.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[9px] font-black uppercase">Novo patrono / substabelecido</Label>
            <Select value={enteringId} onValueChange={setEnteringId} disabled={loadingBanca}>
              <SelectTrigger className="h-11 rounded-xl mt-1">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {banca.map((a) => (
                  <SelectItem key={a.id} value={String(a.id)}>
                    {a.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[9px] font-black uppercase">Filtro UF</Label>
            <Select value={uf} onValueChange={setUf}>
              <SelectTrigger className="h-11 rounded-xl mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {UFS.map((u) => (
                  <SelectItem key={u} value={u}>
                    {u}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <Button
              onClick={runScan}
              disabled={loadingScan}
              className="h-11 rounded-xl font-black uppercase text-[10px]"
            >
              {loadingScan ? (
                <Loader2 className="animate-spin mr-2" size={14} />
              ) : (
                <Search className="mr-2" size={14} />
              )}
              Escanear carteira
            </Button>
            <Button
              variant="outline"
              onClick={runReforco}
              disabled={reinforcing || !items.length}
              className="h-11 rounded-xl font-black uppercase text-[10px]"
            >
              {reinforcing ? (
                <Loader2 className="animate-spin mr-2" size={14} />
              ) : (
                <Shield className="mr-2" size={14} />
              )}
              Reforço DJEN/DataJud
            </Button>
          </div>
        </div>

        <div className="shrink-0 px-4 py-2 flex flex-wrap items-center gap-3 border-b text-[11px]">
          <Badge variant="outline" className="font-black uppercase">
            {items.length} encontrados
          </Badge>
          <Badge className="bg-emerald-600 font-black uppercase">
            {items.filter((i) => i.elegivel).length} elegíveis
          </Badge>
          {advNome ? (
            <span className="text-muted-foreground">
              Advogado filtrado: <strong>{advNome}</strong>
            </span>
          ) : null}
          <label className="flex items-center gap-2 ml-auto cursor-pointer">
            <input
              type="checkbox"
              checked={onlyElegiveis}
              onChange={(e) => setOnlyElegiveis(e.target.checked)}
            />
            <span className="font-bold uppercase text-[9px]">Só elegíveis</span>
          </label>
          <Button
            size="sm"
            variant="secondary"
            className="rounded-xl font-black uppercase text-[9px]"
            disabled={!items.some((i) => i.elegivel) || !!downloading}
            onClick={downloadAllElegiveis}
          >
            <Download size={12} className="mr-1" /> Baixar todos elegíveis
          </Button>
          <Button size="sm" variant="ghost" className="rounded-xl" onClick={runScan}>
            <RefreshCcw size={12} />
          </Button>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-2">
          {!items.length && !loadingScan ? (
            <div className="text-center py-20 text-muted-foreground text-sm max-w-lg mx-auto">
              <FileText className="mx-auto mb-3 opacity-40" size={36} />
              <p className="font-bold">
                Selecione o advogado a revogar, a UF (opcional) e clique em{" "}
                <span className="text-foreground">Escanear carteira</span>.
              </p>
              <p className="text-xs mt-2">
                O scanner usa só os processos do usuário em que o campo advogado bate com a banca.
                Encerrados e cumprimento de sentença saem da lista de elegíveis. O PDF usa nome, OAB,
                endereço e contato da banca.
              </p>
            </div>
          ) : null}

          {visible.map((it) => (
            <div
              key={it.protocolo + it.id}
              className={cn(
                "rounded-xl border p-4 flex flex-wrap items-center justify-between gap-3 bg-card/80",
                it.elegivel ? "border-emerald-500/40" : "border-border/40 opacity-80"
              )}
            >
              <div className="min-w-0">
                <p className="font-black text-sm uppercase truncate">{it.cliente}</p>
                <p className="font-mono text-xs text-muted-foreground">{it.protocolo}</p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Carteira: {it.advogadoCarteira}
                  {it.uf ? ` · UF ${it.uf}` : ""}
                  {it.tribunal ? ` · ${it.tribunal}` : ""}
                  {it.djenChecked ? " · tribunal OK" : ""}
                </p>
                <p className="text-[10px] mt-0.5">
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[8px] uppercase font-black mr-1",
                      it.elegivel ? "border-emerald-600 text-emerald-700" : "border-red-500 text-red-600"
                    )}
                  >
                    {it.elegivel ? "Elegível" : "Fora"}
                  </Badge>
                  {it.motivo}
                  {it.ultimoAdvogadoDetectado
                    ? ` · Ref. adv.: ${it.ultimoAdvogadoDetectado}`
                    : ""}
                </p>
              </div>
              <Button
                className="h-10 rounded-xl font-black uppercase text-[10px] bg-emerald-600 hover:bg-emerald-700"
                disabled={!it.elegivel || downloading === it.protocolo}
                onClick={() => downloadOne(it)}
              >
                {downloading === it.protocolo ? (
                  <Loader2 className="animate-spin mr-2" size={14} />
                ) : (
                  <Download className="mr-2" size={14} />
                )}
                Baixar PDF
              </Button>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
