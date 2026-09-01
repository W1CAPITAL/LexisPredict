"use client";

import { EditablePartesPanel } from "@/components/documents/editable-partes-panel";
import { usePartesEditaveis } from "@/hooks/use-partes-editaveis";

/**
 * Revogacao de poderes — redesigned for clarity.
 * Two modes:
 *   1. Revogacao + Substabelecimento (default)
 *   2. Apenas Revogacao (sem substabelecimento)
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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
  Play,
  Pause,
  Square,
  FileText,
  ArrowRight,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";

const UFS = [
  "TODOS",
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
  "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

const DELAY_MS = 400;

function downloadBase64Pdf(base64: string, filename: string) {
  const a = document.createElement("a");
  a.href = `data:application/pdf;base64,${base64}`;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function sleep(ms: number, signal: { cancelled: boolean }) {
  return new Promise<void>((resolve) => {
    const t = setTimeout(() => resolve(), ms);
    const iv = setInterval(() => {
      if (signal.cancelled) {
        clearTimeout(t);
        clearInterval(iv);
        resolve();
      }
    }, 200);
    setTimeout(() => clearInterval(iv), ms + 50);
  });
}

type QueueStatus = "idle" | "running" | "paused" | "done";
type ModoRevogacao = "revogacao-substabelecimento" | "apenas-revogacao";

export default function RevogacaoPoderesPage() {
  const partes = usePartesEditaveis();

  const { toast } = useToast();
  const [banca, setBanca] = useState<any[]>([]);
  const [leavingId, setLeavingId] = useState("");
  const [enteringId, setEnteringId] = useState("");
  const [uf, setUf] = useState("TODOS");
  const [items, setItems] = useState<RevogacaoCaseItem[]>([]);
  const [loadingScan, setLoadingScan] = useState(false);
  const [loadingBanca, setLoadingBanca] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [onlyElegiveis, setOnlyElegiveis] = useState(true);
  const [useClaudeElegibilidade, setUseClaudeElegibilidade] = useState(false);
  const [requireCpf, setRequireCpf] = useState(false);
  const [autoFillCpf, setAutoFillCpf] = useState(true);
  const [cpfByProtocolo, setCpfByProtocolo] = useState<Record<string, string>>({});
  const [emailByProtocolo, setEmailByProtocolo] = useState<Record<string, string>>({});
  const [estadoCivilByProtocolo, setEstadoCivilByProtocolo] = useState<Record<string, string>>({});
  const [enderecoByProtocolo, setEnderecoByProtocolo] = useState<Record<string, string>>({});
  const [bancoByProtocolo, setBancoByProtocolo] = useState<Record<string, string>>({});
  const [acaoByProtocolo, setAcaoByProtocolo] = useState<Record<string, string>>({});
  const [incluirBancoNoPdf, setIncluirBancoNoPdf] = useState(false);
  const [incluirAcaoNoPdf, setIncluirAcaoNoPdf] = useState(false);
  const [advNome, setAdvNome] = useState("");
  const [logs, setLogs] = useState<string[]>([]);

  // Modo principal: revogacao + substabelecimento OU apenas revogacao
  const [modoRevogacao, setModoRevogacao] = useState<ModoRevogacao>("apenas-revogacao");

  const [qStatus, setQStatus] = useState<QueueStatus>("idle");
  const [qIndex, setQIndex] = useState(0);
  const statusRef = useRef<QueueStatus>("idle");
  const indexRef = useRef(0);
  const itemsRef = useRef<RevogacaoCaseItem[]>([]);
  const cancelRef = useRef({ cancelled: false });

  const somenteRevogacao = modoRevogacao === "apenas-revogacao";

  useEffect(() => { statusRef.current = qStatus; }, [qStatus]);
  useEffect(() => { indexRef.current = qIndex; }, [qIndex]);
  useEffect(() => { itemsRef.current = items; }, [items]);

  const addLog = (line: string) => {
    setLogs((prev) => [line, ...prev].slice(0, 80));
  };

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
    cancelRef.current.cancelled = true;
    setQStatus("idle");
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
      setQIndex(0);
      const cpfMap: Record<string, string> = {};
      const emailMap: Record<string, string> = {};
      const civilMap: Record<string, string> = {};
      const endMap: Record<string, string> = {};
      const bancoMap: Record<string, string> = {};
      const acaoMap: Record<string, string> = {};
      for (const it of res.items) {
        if (it.cpf) cpfMap[it.protocolo] = String(it.cpf);
        if (it.email) emailMap[it.protocolo] = String(it.email);
        if (it.estado_civil) civilMap[it.protocolo] = String(it.estado_civil);
        if (it.endereco) endMap[it.protocolo] = String(it.endereco);
        if (it.parte_passiva) bancoMap[it.protocolo] = String(it.parte_passiva);
        if (it.classe_acao) acaoMap[it.protocolo] = String(it.classe_acao);
      }
      setCpfByProtocolo(cpfMap);
      setEmailByProtocolo(emailMap);
      setEstadoCivilByProtocolo(civilMap);
      setEnderecoByProtocolo(endMap);
      setBancoByProtocolo(bancoMap);
      setAcaoByProtocolo(acaoMap);
      const comCpf = (res as any).comCpfCarteira ?? Object.keys(cpfMap).length;
      addLog(`Carteira: ${res.total} processos · ${res.elegiveis} elegiveis · ${comCpf} com CPF cadastrado`);
      toast({
        title: "Fila montada",
        description: `${res.elegiveis} elegiveis de ${res.total} · ${comCpf} CPF da carteira`,
      });
    } finally {
      setLoadingScan(false);
    }
  }, [leavingId, uf, toast]);

  const processOne = async (it: RevogacaoCaseItem) => {
    addLog(`→ ${it.cliente} · ${it.protocolo}`);
    const r = await reforcoTribunalRevogacaoAction(it.protocolo, {
      useClaude: useClaudeElegibilidade,
    });
    if (!r.success) {
      addLog(`  falha DJEN: ${(r as any).error || "?"}`);
      return it;
    }
    const anyR = r as any;
    if (autoFillCpf) {
      const cpfDj = anyR.cpfDetectado as string | null;
      if (cpfDj) {
        setCpfByProtocolo((prev) => {
          if (prev[it.protocolo]?.replace(/\D/g, "").length === 11) return prev;
          addLog(`  CPF: ${cpfDj}`);
          return { ...prev, [it.protocolo]: cpfDj };
        });
      }
      if (anyR.emailDetectado) {
        setEmailByProtocolo((prev) => {
          if (prev[it.protocolo]) return prev;
          return { ...prev, [it.protocolo]: String(anyR.emailDetectado) };
        });
      }
      if (anyR.estadoCivilDetectado) {
        setEstadoCivilByProtocolo((prev) => {
          if (prev[it.protocolo]) return prev;
          return { ...prev, [it.protocolo]: String(anyR.estadoCivilDetectado) };
        });
      }
      if (anyR.enderecoDetectado) {
        setEnderecoByProtocolo((prev) => {
          if (prev[it.protocolo]) return prev;
          return { ...prev, [it.protocolo]: String(anyR.enderecoDetectado) };
        });
      }
      if (anyR.bancoDetectado) {
        setBancoByProtocolo((prev) => {
          if (prev[it.protocolo]) return prev;
          addLog(`  Banco: ${anyR.bancoDetectado}`);
          return { ...prev, [it.protocolo]: String(anyR.bancoDetectado) };
        });
      }
      if (anyR.acaoDetectada) {
        setAcaoByProtocolo((prev) => {
          if (prev[it.protocolo]) return prev;
          return { ...prev, [it.protocolo]: String(anyR.acaoDetectada) };
        });
      }
    }
    if (useClaudeElegibilidade && anyR.analiseClaude) {
      addLog(`  [IA elegibilidade] ${String(anyR.analiseClaude).slice(0, 160)}`);
    }
    addLog(
      `  ${r.elegivel ? "ELEGIVEL" : "FORA"} · ${r.motivo}` +
        (r.ultimoAdvogadoDetectado ? ` · adv ${r.ultimoAdvogadoDetectado}` : "") +
        (anyR.djenChecked ? " · DJEN" : " · sem DJEN")
    );
    return {
      ...it,
      elegivel: r.elegivel,
      motivo: r.motivo,
      encerrado: r.encerrado,
      cumprimento: r.cumprimento,
      ultimoAdvogadoDetectado: r.ultimoAdvogadoDetectado || it.ultimoAdvogadoDetectado,
      advogadosDjen: anyR.advogadosDjen || [],
      viabilidade: anyR.viabilidade || null,
      viavelSubstabelecer: anyR.viavelSubstabelecer ?? r.elegivel,
      djenChecked: true,
      analiseClaude: anyR.analiseClaude || null,
      engineClaude: anyR.engineClaude || null,
      cpf: anyR.cpfDetectado || it.cpf,
      email: anyR.emailDetectado || it.email,
      estado_civil: anyR.estadoCivilDetectado || it.estado_civil,
      endereco: anyR.enderecoDetectado || it.endereco,
      parte_passiva: anyR.bancoDetectado || it.parte_passiva,
      classe_acao: anyR.acaoDetectada || it.classe_acao,
    } as RevogacaoCaseItem;
  };

  const runQueue = async (from: number) => {
    cancelRef.current.cancelled = false;
    setQStatus("running");
    statusRef.current = "running";
    const list = itemsRef.current;
    let i = from;
    while (i < list.length) {
      if (cancelRef.current.cancelled) {
        setQStatus("paused");
        statusRef.current = "paused";
        return;
      }
      setQIndex(i);
      indexRef.current = i;
      const updated = await processOne(list[i]);
      setItems((prev) => {
        const next = [...prev];
        next[i] = updated;
        return next;
      });
      i += 1;
      if (i < list.length) await sleep(DELAY_MS, cancelRef.current);
    }
    setQStatus("done");
    statusRef.current = "done";
    addLog("Fila 1 a 1 concluida");
    toast({ title: "Fila concluida" });
  };

  const startQueue = () => {
    if (!items.length) {
      toast({ title: "Escaneie a carteira antes" });
      return;
    }
    runQueue(0);
  };
  const pauseQueue = () => {
    cancelRef.current.cancelled = true;
    setQStatus("paused");
  };
  const resumeQueue = () => runQueue(indexRef.current);
  const stopQueue = () => {
    cancelRef.current.cancelled = true;
    setQStatus("idle");
  };

  const downloadOne = async (it: RevogacaoCaseItem) => {
    if (!leavingId) {
      toast({ title: "Selecione o advogado a revogar", variant: "destructive" });
      return;
    }
    if (!somenteRevogacao && (!enteringId || leavingId === enteringId)) {
      toast({
        title: "Selecione dois advogados diferentes na banca",
        variant: "destructive",
      });
      return;
    }
    const cpf = cpfByProtocolo[it.protocolo] || "";
    if (requireCpf && !cpf.replace(/\D/g, "").match(/^\d{11}$/)) {
      toast({
        title: "CPF obrigatorio",
        description: "Preencha o CPF do cliente ou ative autofill apos o reforco DJEN.",
        variant: "destructive",
      });
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
        advogadoNovoId: somenteRevogacao ? undefined : enteringId,
        ultimoAdvogadoDetectado: it.ultimoAdvogadoDetectado,
        advogadosDjen: (it as any).advogadosDjen || [],
        viabilidade: (it as any).viabilidade || null,
        observacaoScanner: it.motivo,
        comarca: it.uf || "Sao Paulo",
        clienteCpf: cpf || it.cpf || null,
        clienteEmail: emailByProtocolo[it.protocolo] || it.email || null,
        clienteEstadoCivil: estadoCivilByProtocolo[it.protocolo] || it.estado_civil || null,
        clienteEndereco: enderecoByProtocolo[it.protocolo] || it.endereco || null,
        clienteNacionalidade: it.nacionalidade || "BRASILEIRA",
        partePassiva: bancoByProtocolo[it.protocolo] || it.parte_passiva || null,
        partePassivaCnpj: it.parte_passiva_cnpj || null,
        classeAcao: acaoByProtocolo[it.protocolo] || it.classe_acao || null,
        incluirPartePassivaNoPdf: incluirBancoNoPdf,
        incluirAcaoNoPdf: incluirAcaoNoPdf,
        somenteRevogacao,
      });
      if (!res.success || !(res as any).base64) {
        toast({
          title: "PDF",
          description: (res as any).error || "Falha",
          variant: "destructive",
        });
        return;
      }
      const b64 = (res as any).base64 as string;
      if (!b64.startsWith("JVBERi0")) {
        toast({
          title: "PDF invalido",
          description: "Servidor nao devolveu PDF real",
          variant: "destructive",
        });
        return;
      }
      downloadBase64Pdf(b64, (res as any).filename || "revogacao.pdf");
      toast({
        title: "PDF baixado",
        description: `${it.protocolo} · ${(((res as any).bytes || 0) / 1024).toFixed(1)} KB`,
      });
    } finally {
      setDownloading(null);
    }
  };

  const visible = onlyElegiveis ? items.filter((i) => i.elegivel) : items;
  const current = items[qIndex] || null;

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />

          <div className="max-w-5xl mx-auto w-full mt-4 mb-6 px-4">
            <div className="bg-white border-2 border-black rounded-none shadow-[6px_6px_0px_#000] p-4">
              <p className="text-[10px] font-black uppercase tracking-widest mb-2">Partes 100% editáveis</p>
              <p className="text-[10px] text-muted-foreground mb-3">Selecione dados da banca ou preencha manualmente — tudo permanece editável (casado/casada/casado(a)).</p>
              <EditablePartesPanel
                banca={partes.banca}
                setBanca={partes.setBanca}
                advogados={partes.advogados}
                setAdvogados={partes.setAdvogados}
                cliente={partes.cliente}
                setCliente={partes.setCliente}
                tituloCliente="Outorgante / Cliente"
              />
            </div>
          </div>

      <main className="flex-1 flex flex-col overflow-hidden glass-panel">
        {/* ═══════ HEADER ═══════ */}
        <header className="shrink-0 border-b p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 border-2 border-primary flex items-center justify-center">
              <Scale className="text-primary" size={20} />
            </div>
            <div>
              <h1 className="text-sm font-black uppercase tracking-widest">
                Revogacao de Poderes
              </h1>
              <p className="text-[10px] text-muted-foreground font-bold uppercase">
                {somenteRevogacao
                  ? "Apenas revogacao · Fila 1 a 1 · CPF/e-mail da carteira"
                  : "Revogacao + Substabelecimento · Fila 1 a 1 · CPF/e-mail da carteira"}
              </p>
            </div>
          </div>
        </header>

        {/* ═══════ MODO DE OPERACAO ═══════ */}
        <div className="shrink-0 px-4 py-3 border-b bg-card/40">
          <Label className="text-[9px] font-black uppercase mb-2 block">
            Modo de operacao
          </Label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setModoRevogacao("revogacao-substabelecimento")}
              className={cn(
                "flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left",
                modoRevogacao === "revogacao-substabelecimento"
                  ? "border-primary bg-primary/5 shadow-md"
                  : "border-border/40 hover:border-border/80"
              )}
            >
              <div
                className={cn(
                  "h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
                  modoRevogacao === "revogacao-substabelecimento"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                )}
              >
                {modoRevogacao === "revogacao-substabelecimento" ? (
                  <Check size={16} />
                ) : (
                  <ArrowRight size={16} />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-black uppercase">
                  Revogacao + Substabelecimento
                </p>
                <p className="text-[9px] text-muted-foreground font-bold">
                  Revoga advogado E transfere poderes para novo patrono
                </p>
              </div>
            </button>
            <button
              onClick={() => setModoRevogacao("apenas-revogacao")}
              className={cn(
                "flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left",
                modoRevogacao === "apenas-revogacao"
                  ? "border-emerald-500 bg-emerald-500/5 shadow-md"
                  : "border-border/40 hover:border-border/80"
              )}
            >
              <div
                className={cn(
                  "h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
                  modoRevogacao === "apenas-revogacao"
                    ? "bg-emerald-600 text-white"
                    : "bg-muted"
                )}
              >
                {modoRevogacao === "apenas-revogacao" ? (
                  <Check size={16} />
                ) : (
                  <FileText size={16} />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-black uppercase">
                  Apenas Revogacao
                </p>
                <p className="text-[9px] text-muted-foreground font-bold">
                  Revoga advogado sem indicar substituto
                </p>
              </div>
            </button>
          </div>
        </div>

        {/* ═══════ FORMULARIO PRINCIPAL ═══════ */}
        <div className="shrink-0 p-4 border-b bg-card/40">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            <div>
              <Label className="text-[9px] font-black uppercase">Advogado a revogar</Label>
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

            {!somenteRevogacao && (
              <div>
                <Label className="text-[9px] font-black uppercase">
                  Novo patrono (substituto)
                </Label>
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
            )}

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
                metal={false}
                onClick={runScan}
                disabled={loadingScan}
                className="h-11 rounded-xl font-black uppercase text-[10px]"
              >
                {loadingScan ? (
                  <Loader2 className="animate-spin mr-2" size={14} />
                ) : (
                  <Search className="mr-2" size={14} />
                )}
                Montar fila
              </Button>
              {qStatus === "idle" || qStatus === "done" ? (
                <Button
                  metal={false}
                  onClick={startQueue}
                  disabled={!items.length}
                  className="h-11 rounded-xl font-black uppercase text-[10px] bg-emerald-600"
                >
                  <Play className="mr-2" size={14} /> Fila 1 a 1
                </Button>
              ) : null}
              {qStatus === "running" ? (
                <Button metal={false} onClick={pauseQueue} variant="outline" className="h-11 rounded-xl font-black uppercase text-[10px]">
                  <Pause className="mr-2" size={14} /> Pausar
                </Button>
              ) : null}
              {qStatus === "paused" ? (
                <>
                  <Button metal={false} onClick={resumeQueue} className="h-11 rounded-xl font-black uppercase text-[10px] bg-emerald-600">
                    <Play className="mr-2" size={14} /> Continuar
                  </Button>
                  <Button metal={false} onClick={stopQueue} variant="outline" className="h-11 rounded-xl font-black uppercase text-[10px]">
                    <Square className="mr-2" size={14} /> Parar
                  </Button>
                </>
              ) : null}
            </div>
          </div>
        </div>

        {/* ═══════ BARRA DE STATUS + OPCOES ═══════ */}
        <div className="shrink-0 px-4 py-2 flex flex-wrap items-center gap-3 border-b text-[11px]">
          <Badge variant="outline" className="font-black uppercase">
            {items.length} na fila
          </Badge>
          <Badge className="bg-emerald-600 font-black uppercase">
            {items.filter((i) => i.elegivel).length} elegiveis
          </Badge>
          {qStatus === "running" || qStatus === "paused" ? (
            <Badge variant="secondary">
              Item {Math.min(qIndex + 1, items.length)}/{items.length}
              {current ? ` · ${current.cliente.slice(0, 24)}` : ""}
            </Badge>
          ) : null}
          {advNome ? (
            <span className="text-muted-foreground">
              Advogado: <strong>{advNome}</strong>
            </span>
          ) : null}

          <div className="ml-auto flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={onlyElegiveis} onChange={(e) => setOnlyElegiveis(e.target.checked)} />
              <span className="font-bold uppercase text-[9px]">So elegiveis</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={useClaudeElegibilidade}
                onChange={(e) => setUseClaudeElegibilidade(e.target.checked)}
              />
              <span className="font-bold uppercase text-[9px]">Claude so elegibilidade</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={requireCpf} onChange={(e) => setRequireCpf(e.target.checked)} />
              <span className="font-bold uppercase text-[9px]">Exigir CPF</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={autoFillCpf} onChange={(e) => setAutoFillCpf(e.target.checked)} />
              <span className="font-bold uppercase text-[9px]">Autofill CPF</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={incluirBancoNoPdf} onChange={(e) => setIncluirBancoNoPdf(e.target.checked)} />
              <span className="font-bold uppercase text-[9px]">Banco no PDF</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={incluirAcaoNoPdf} onChange={(e) => setIncluirAcaoNoPdf(e.target.checked)} />
              <span className="font-bold uppercase text-[9px]">Acao no PDF</span>
            </label>
            <Button metal={false} size="sm" variant="ghost" className="rounded-xl" onClick={runScan}>
              <RefreshCcw size={12} />
            </Button>
          </div>
        </div>

        {/* ═══════ CONTEUDO PRINCIPAL ═══════ */}
        <div className="flex-1 overflow-auto p-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-2">
            {!items.length && !loadingScan ? (
              <div className="text-center py-16 text-muted-foreground text-sm">
                <div className="flex justify-center mb-4">
                  {somenteRevogacao ? (
                    <FileText size={48} className="text-emerald-500/40" />
                  ) : (
                    <Scale size={48} className="text-primary/40" />
                  )}
                </div>
                <p className="font-bold mb-2">
                  {somenteRevogacao
                    ? "Modo: Apenas Revogacao"
                    : "Modo: Revogacao + Substabelecimento"}
                </p>
                <p className="text-xs">
                  Monte a fila (carteira do advogado) e rode a <strong>Fila 1 a 1</strong> para
                  consultar DJEN/DataJud.
                </p>
                <p className="text-xs mt-1">
                  {somenteRevogacao
                    ? "O PDF contera apenas a revogacao de poderes, sem indicar substituto."
                    : "Selecione dois advogados diferentes: um para revogar e outro para substabelecer."}
                </p>
              </div>
            ) : null}
            {visible.map((it) => (
              <div
                key={it.protocolo + it.id}
                className={cn(
                  "rounded-xl border p-4 flex flex-col gap-2 bg-card/80",
                  it.elegivel ? "border-emerald-500/40" : "border-border/40 opacity-80",
                  current?.protocolo === it.protocolo && qStatus === "running"
                    ? "ring-2 ring-primary"
                    : ""
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-black text-sm uppercase truncate">{it.cliente}</p>
                    <p className="font-mono text-xs text-muted-foreground">{it.protocolo}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {it.advogadoCarteira}
                      {it.uf ? ` · UF ${it.uf}` : ""}
                      {it.djenChecked ? " · tribunal OK" : ""}
                    </p>
                    <p className="text-[10px] mt-0.5">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[8px] uppercase font-black mr-1",
                          it.elegivel
                            ? "border-emerald-600 text-emerald-700"
                            : "border-red-500 text-red-600"
                        )}
                      >
                        {it.elegivel ? "Elegivel" : "Fora"}
                      </Badge>
                      {it.motivo}
                      {(it as any).viabilidade ? ` · ${(it as any).viabilidade}` : ""}
                    </p>
                  </div>
                  <Button
                    metal={false}
                    className="h-10 rounded-xl font-black uppercase text-[10px] bg-emerald-600 hover:bg-emerald-700"
                    disabled={!it.elegivel || downloading === it.protocolo}
                    onClick={() => downloadOne(it)}
                  >
                    {downloading === it.protocolo ? (
                      <Loader2 className="animate-spin mr-2" size={14} />
                    ) : (
                      <Download className="mr-2" size={14} />
                    )}
                    {somenteRevogacao ? "Revogacao" : "Revogacao + Subst."}
                  </Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-border/30">
                  <div className="flex items-center gap-2">
                    <Label className="text-[9px] font-black uppercase shrink-0 w-16">CPF</Label>
                    <Input
                      className="h-9 rounded-lg font-mono text-xs"
                      placeholder="000.000.000-00"
                      value={cpfByProtocolo[it.protocolo] || it.cpf || ""}
                      onChange={(e) =>
                        setCpfByProtocolo((prev) => ({
                          ...prev,
                          [it.protocolo]: e.target.value,
                        }))
                      }
                    />
                    {(cpfByProtocolo[it.protocolo] || it.cpf) ? (
                      <Badge variant="secondary" className="text-[8px]">carteira</Badge>
                    ) : requireCpf ? (
                      <Badge variant="destructive" className="text-[8px]">obrigatorio</Badge>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-[9px] font-black uppercase shrink-0 w-16">E-mail</Label>
                    <Input
                      className="h-9 rounded-lg text-xs"
                      value={emailByProtocolo[it.protocolo] || it.email || ""}
                      onChange={(e) =>
                        setEmailByProtocolo((prev) => ({ ...prev, [it.protocolo]: e.target.value }))
                      }
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-[9px] font-black uppercase shrink-0 w-16">Est. civil</Label>
                    <Input
                      className="h-9 rounded-lg text-xs uppercase"
                      value={estadoCivilByProtocolo[it.protocolo] || it.estado_civil || ""}
                      onChange={(e) =>
                        setEstadoCivilByProtocolo((prev) => ({
                          ...prev,
                          [it.protocolo]: e.target.value.toUpperCase(),
                        }))
                      }
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-[9px] font-black uppercase shrink-0 w-16">Endereco</Label>
                    <Input
                      className="h-9 rounded-lg text-xs"
                      value={enderecoByProtocolo[it.protocolo] || it.endereco || ""}
                      onChange={(e) =>
                        setEnderecoByProtocolo((prev) => ({ ...prev, [it.protocolo]: e.target.value }))
                      }
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-[9px] font-black uppercase shrink-0 w-16">Banco</Label>
                    <Input
                      className="h-9 rounded-lg text-xs uppercase"
                      placeholder="Parte passiva"
                      value={bancoByProtocolo[it.protocolo] || it.parte_passiva || ""}
                      onChange={(e) =>
                        setBancoByProtocolo((prev) => ({
                          ...prev,
                          [it.protocolo]: e.target.value.toUpperCase(),
                        }))
                      }
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-[9px] font-black uppercase shrink-0 w-16">Acao</Label>
                    <Input
                      className="h-9 rounded-lg text-xs uppercase"
                      value={acaoByProtocolo[it.protocolo] || it.classe_acao || ""}
                      onChange={(e) =>
                        setAcaoByProtocolo((prev) => ({
                          ...prev,
                          [it.protocolo]: e.target.value.toUpperCase(),
                        }))
                      }
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="rounded-xl border bg-card/60 p-3 h-fit max-h-[70vh] overflow-auto">
            <p className="text-[10px] font-black uppercase mb-2">Log da fila</p>
            <div className="space-y-1 font-mono text-[10px] text-muted-foreground">
              {logs.length === 0 ? <p>—</p> : null}
              {logs.map((l, i) => (
                <p key={i} className="border-b border-border/30 pb-1">
                  {l}
                </p>
              ))}
            </div>
          </div>
        </div>
      
        <div className="max-w-4xl mx-auto w-full px-4 py-4">
</div>

      </main>
    </div>
  );
}
