"use client";

/**
 * Ética operacional — anti-modelo predatório
 * Funil diagnóstico → extrajudicial → judicial com gates + scripts seguros + auditoria de frases.
 */

import React, { useMemo, useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  ShieldCheck,
  AlertTriangle,
  Copy,
  Check,
  Ban,
  FileText,
  Scale,
  BookOpen,
} from "lucide-react";
import { auditarTextoEtica, DOCUMENTOS_GRATUITOS } from "@/lib/etica-frases-proibidas";
import {
  FASE_LABELS,
  type FaseEtica,
  type EstadoFluxoEtico,
  emptyEstadoFluxo,
  gatesParaJudicial,
  podeAvancarJudicial,
  avancarFaseSegura,
  normalizeEstadoFluxo,
} from "@/lib/fluxo-etico-fases";
import { SCRIPTS_ETICOS, preencherScript } from "@/lib/scripts-eticos-oficiais";
import {
  ITENS_CIENCIA_RISCOS,
  emptyTermoCiencia,
  termoCienciaCompleto,
  type TermoCienciaState,
} from "@/lib/termo-ciencia-riscos";
import { saveEticaCasoAction } from "@/app/actions/etica-fluxo-actions";
import { gerarRelatorioTransparencia } from "@/lib/relatorio-transparencia";
import { calcularDiagnostico, emptyDiagnostico, type DiagnosticoContrato } from "@/lib/diagnostico-contrato-etica";
import {
  emptyProtocoloExtra,
  protocoloExtraDocumentado,
  resumoProtocoloExtra,
  type ProtocoloExtrajudicial,
} from "@/lib/protocolo-extrajudicial";
import { criarTicketOuvidoria, responderTicket, ticketAtrasado, type TicketOuvidoria } from "@/lib/ouvidoria-interna";
import { emptyNps, registrarNps, type NpsDiagnostico } from "@/lib/nps-pos-diagnostico";
import { gerarCartaDesistencia } from "@/lib/carta-desistencia";
import {
  emptySubstabelecimento,
  substabelecimentoValido,
  textoResumoSubstabelecimento,
  type RegistroSubstabelecimento,
} from "@/lib/substabelecimento-transparente";

export default function EticaOperacionalPage() {
  const { toast } = useToast();
  const [protocolo, setProtocolo] = useState("");
  const [nomeCliente, setNomeCliente] = useState("");
  const [empresa, setEmpresa] = useState("Assessoria");
  const [fluxo, setFluxo] = useState<EstadoFluxoEtico>(emptyEstadoFluxo());
  const [termo, setTermo] = useState<TermoCienciaState>(emptyTermoCiencia());
  const [rascunho, setRascunho] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [taxaContrato, setTaxaContrato] = useState("");
  const [taxaBacen, setTaxaBacen] = useState("");
  const [diagnostico, setDiagnostico] = useState<DiagnosticoContrato>(emptyDiagnostico());
  const [protoExtra, setProtoExtra] = useState<ProtocoloExtrajudicial>(emptyProtocoloExtra());
  const [houveMov, setHouveMov] = useState(false);
  const [resumoMov, setResumoMov] = useState("");
  const [tickets, setTickets] = useState<TicketOuvidoria[]>([]);
  const [ouvAssunto, setOuvAssunto] = useState("");
  const [ouvDesc, setOuvDesc] = useState("");
  const [npsNota, setNpsNota] = useState(8);
  const [npsEntC, setNpsEntC] = useState(false);
  const [npsEntR, setNpsEntR] = useState(false);
  const [nps, setNps] = useState<NpsDiagnostico>(emptyNps());
  const [sub, setSub] = useState<RegistroSubstabelecimento>(emptySubstabelecimento());
  const [cartaTxt, setCartaTxt] = useState("");

  const auditoria = useMemo(() => auditarTextoEtica(rascunho), [rascunho]);
  const gates = useMemo(() => gatesParaJudicial(fluxo), [fluxo]);
  const judicialOk = podeAvancarJudicial(fluxo);

  const toggleGateFlag = (key: keyof EstadoFluxoEtico) => {
    setFluxo((f) => {
      const cur = f[key];
      if (typeof cur === "boolean") return { ...f, [key]: !cur, updatedAt: new Date().toISOString() };
      return f;
    });
  };

  const setFase = (fase: FaseEtica) => {
    const r = avancarFaseSegura(fluxo, fase);
    if (!r.ok) {
      toast({ title: "Gate ético", description: r.erro, variant: "destructive" });
      return;
    }
    setFluxo(r.estado);
  };

  const toggleTermo = (id: string) => {
    setTermo((t) => ({
      ...t,
      itens: { ...t.itens, [id]: !t.itens[id] },
    }));
  };

  const persistir = async () => {
    if (!protocolo.trim()) {
      toast({ title: "Informe o CNJ/protocolo", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const fluxoSync = {
        ...fluxo,
        termoCienciaRiscosAssinado: termoCienciaCompleto(termo),
      };
      const r = await saveEticaCasoAction({
        protocolo: protocolo.trim(),
        fluxo: fluxoSync,
        termo,
        diagnostico: diagnostico.parecer ? diagnostico : undefined,
        protocoloExtra: protoExtra,
        ouvidoria: tickets,
        nps: nps.coletadoEm ? nps : undefined,
        substabelecimento: sub.advogado.nome ? sub : undefined,
        cartaDesistenciaTexto: cartaTxt || undefined,
      });
      if (!r.success) {
        toast({ title: "Não gravou no Supabase", description: r.error, variant: "destructive" });
        return;
      }
      setFluxo(normalizeEstadoFluxo(fluxoSync));
      toast({ title: "Ética salva", description: "dados.etica no processo" });
    } finally {
      setBusy(false);
    }
  };

  const copiarScript = async (id: string) => {
    const s = SCRIPTS_ETICOS.find((x) => x.id === id);
    if (!s) return;
    const txt = preencherScript(s, {
      nome: nomeCliente || "cliente",
      empresa,
      protocolo: protocolo || "",
      fase: FASE_LABELS[fluxo.fase],
    });
    const audit = auditarTextoEtica(txt);
    if (!audit.ok) {
      toast({
        title: "Script bloqueado por compliance",
        description: audit.bloqueios[0]?.motivo,
        variant: "destructive",
      });
      return;
    }
    await navigator.clipboard.writeText(txt);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
    toast({ title: "Script ético copiado" });
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0">
        <header className="border-b border-border/60 px-4 py-3 flex items-center gap-2">
          <ShieldCheck className="text-emerald-600" size={20} />
          <div>
            <h1 className="text-sm font-black uppercase tracking-wide">Ética operacional</h1>
            <p className="text-[11px] text-muted-foreground">
              Anti-modelo predatório · CDC · gates extrajudicial→judicial · scripts seguros
            </p>
          </div>
        </header>

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-0 min-h-0">
          {/* Coluna esquerda: fluxo + termo */}
          <section className="lg:col-span-5 border-r border-border/50 flex flex-col min-h-0">
            <div className="p-3 space-y-2 border-b border-border/40">
              <label className="text-[10px] font-black uppercase text-muted-foreground">Protocolo / CNJ</label>
              <Input
                value={protocolo}
                onChange={(e) => setProtocolo(e.target.value)}
                placeholder="0000000-00.0000.0.00.0000"
                className="h-9 font-mono text-sm"
              />
              <div className="grid grid-cols-2 gap-2">
                <Input
                  value={nomeCliente}
                  onChange={(e) => setNomeCliente(e.target.value)}
                  placeholder="Nome do cliente"
                  className="h-9 text-sm"
                />
                <Input
                  value={empresa}
                  onChange={(e) => setEmpresa(e.target.value)}
                  placeholder="Nome da empresa"
                  className="h-9 text-sm"
                />
              </div>
              <Button type="button" size="sm" className="w-full" disabled={busy} onClick={() => void persistir()}>
                Salvar no Supabase (dados.etica)
              </Button>
            </div>

            <ScrollArea className="flex-1">
              <div className="p-3 space-y-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1">
                    <Scale size={12} /> Fase atual
                  </p>
                  <p className="text-sm font-bold mb-2">{FASE_LABELS[fluxo.fase]}</p>
                  <div className="flex flex-wrap gap-1">
                    {(Object.keys(FASE_LABELS) as FaseEtica[]).map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setFase(f)}
                        className={cn(
                          "text-[9px] font-black uppercase px-2 py-1 rounded-lg border",
                          fluxo.fase === f
                            ? "border-emerald-600 bg-emerald-500/15 text-emerald-900"
                            : "border-border/50 hover:bg-muted/40"
                        )}
                      >
                        {FASE_LABELS[f].split("·")[0].trim()}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-border/60 p-3 space-y-2">
                  <p className="text-[10px] font-black uppercase text-muted-foreground">Marcos do funil</p>
                  {(
                    [
                      ["diagnosticoEntregue", "Diagnóstico entregue"],
                      ["extrajudicialDocumentado", "Extrajudicial documentado"],
                      ["termoCienciaRiscosAssinado", "Termo de riscos"],
                      ["consentimentoJudicialAssinado", "Consentimento judicial"],
                      ["contratoHonorariosAdvogadoEntregue", "Contrato hon. advogado"],
                      ["nuncaCobrouDocGratuito", "Não cobrou doc. gratuito"],
                    ] as const
                  ).map(([k, lab]) => (
                    <label key={k} className="flex items-center gap-2 text-[12px] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!fluxo[k]}
                        onChange={() => toggleGateFlag(k)}
                      />
                      <span>{lab}</span>
                    </label>
                  ))}
                </div>

                <div className="rounded-xl border border-violet-600/30 bg-violet-500/5 p-3 space-y-2">
                  <p className="text-[10px] font-black uppercase text-violet-900 flex items-center gap-1">
                    <ShieldCheck size={12} /> Gates para judicial
                    {judicialOk ? (
                      <Badge className="ml-2 bg-emerald-600 text-[8px]">OK</Badge>
                    ) : (
                      <Badge className="ml-2 bg-amber-600 text-[8px]">INCOMPLETO</Badge>
                    )}
                  </p>
                  {gates.map((g) => (
                    <div key={g.id} className="flex items-start gap-2 text-[11px]">
                      <span className={g.ok ? "text-emerald-700 font-black" : "text-amber-700 font-black"}>
                        {g.ok ? "●" : "○"}
                      </span>
                      <span>{g.label}</span>
                    </div>
                  ))}
                  <Button
                    type="button"
                    size="sm"
                    variant={judicialOk ? "default" : "outline"}
                    className="w-full text-[11px]"
                    disabled={!judicialOk}
                    onClick={() => setFase("judicial")}
                  >
                    Avançar para judicial (só se gates OK)
                  </Button>
                </div>

                <div className="rounded-xl border border-border/60 p-3 space-y-2">
                  <p className="text-[10px] font-black uppercase text-muted-foreground flex items-center gap-1">
                    <FileText size={12} /> Termo de ciência de riscos
                  </p>
                  {ITENS_CIENCIA_RISCOS.map((i) => (
                    <label key={i.id} className="flex items-start gap-2 text-[11px] cursor-pointer">
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={termo.itens[i.id] === true}
                        onChange={() => toggleTermo(i.id)}
                      />
                      <span>{i.texto}</span>
                    </label>
                  ))}
                  {termoCienciaCompleto(termo) && (
                    <p className="text-[10px] text-emerald-700 font-semibold">Termo completo — pode marcar no funil.</p>
                  )}
                </div>

                <div className="rounded-xl border border-blue-600/30 bg-blue-500/5 p-3 space-y-2">
                  <p className="text-[10px] font-black uppercase text-blue-900">Diagnóstico taxa × BACEN</p>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-[10px] space-y-0.5">
                      <span className="text-muted-foreground">Taxa contrato % a.a.</span>
                      <Input className="h-8 text-[11px]" value={taxaContrato} onChange={(e) => setTaxaContrato(e.target.value)} />
                    </label>
                    <label className="text-[10px] space-y-0.5">
                      <span className="text-muted-foreground">Média BACEN % a.a.</span>
                      <Input className="h-8 text-[11px]" value={taxaBacen} onChange={(e) => setTaxaBacen(e.target.value)} />
                    </label>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="w-full text-[10px]"
                    onClick={() => {
                      const d = calcularDiagnostico({
                        taxaContratoAa: parseFloat(taxaContrato.replace(",", ".")) || null,
                        taxaMediaBacenAa: parseFloat(taxaBacen.replace(",", ".")) || null,
                      });
                      setDiagnostico(d);
                      setFluxo((f) => ({ ...f, diagnosticoEntregue: true }));
                      toast({ title: "Diagnóstico gerado", description: `Indício: ${d.indicioAbusividade}` });
                    }}
                  >
                    Gerar parecer (sem garantia de êxito)
                  </Button>
                  {diagnostico.parecer && (
                    <p className="text-[10px] leading-snug text-foreground/90">{diagnostico.parecer}</p>
                  )}
                </div>

                <div className="rounded-xl border border-amber-600/30 bg-amber-500/5 p-3 space-y-2">
                  <p className="text-[10px] font-black uppercase text-amber-900">Protocolo extrajudicial</p>
                  <label className="text-[10px] space-y-0.5 block">
                    <span className="text-muted-foreground">Data envio</span>
                    <Input
                      type="date"
                      className="h-8 text-[11px]"
                      value={protoExtra.dataEnvio || ""}
                      onChange={(e) => setProtoExtra((p) => ({ ...p, dataEnvio: e.target.value }))}
                    />
                  </label>
                  <label className="text-[10px] space-y-0.5 block">
                    <span className="text-muted-foreground">Nº protocolo</span>
                    <Input
                      className="h-8 text-[11px]"
                      value={protoExtra.numeroProtocolo || ""}
                      onChange={(e) => setProtoExtra((p) => ({ ...p, numeroProtocolo: e.target.value }))}
                    />
                  </label>
                  <label className="flex items-center gap-2 text-[11px] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={protoExtra.bancoRespondeu === true}
                      onChange={(e) =>
                        setProtoExtra((p) => ({
                          ...p,
                          bancoRespondeu: e.target.checked,
                          canal: p.canal || "email",
                        }))
                      }
                    />
                    Banco respondeu
                  </label>
                  <p className="text-[10px] text-muted-foreground">{resumoProtocoloExtra(protoExtra)}</p>
                  {protocoloExtraDocumentado(protoExtra) && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="w-full text-[10px]"
                      onClick={() =>
                        setFluxo((f) => ({ ...f, extrajudicialDocumentado: true }))
                      }
                    >
                      Marcar extrajudicial documentado
                    </Button>
                  )}
                </div>

                <div className="rounded-xl border border-emerald-600/30 bg-emerald-500/5 p-3 space-y-2">
                  <p className="text-[10px] font-black uppercase text-emerald-900">Relatório de transparência</p>
                  <label className="flex items-center gap-2 text-[11px] cursor-pointer">
                    <input type="checkbox" checked={houveMov} onChange={(e) => setHouveMov(e.target.checked)} />
                    Houve movimentação no período
                  </label>
                  {houveMov && (
                    <Input
                      className="h-8 text-[11px]"
                      placeholder="Resumo objetivo da movimentação"
                      value={resumoMov}
                      onChange={(e) => setResumoMov(e.target.value)}
                    />
                  )}
                  <Button
                    type="button"
                    size="sm"
                    className="w-full text-[10px]"
                    onClick={async () => {
                      const r = gerarRelatorioTransparencia({
                        nomeCliente,
                        empresa,
                        protocolo,
                        houveMovimentacao: houveMov,
                        resumoMovimentacao: resumoMov,
                        fase: fluxo.fase,
                      });
                      if (!r.complianceOk) {
                        toast({
                          title: "Relatório bloqueado",
                          description: r.bloqueios[0],
                          variant: "destructive",
                        });
                        return;
                      }
                      try {
                        await navigator.clipboard.writeText(r.texto);
                        toast({ title: "Relatório copiado", description: "Linguagem ética OK" });
                      } catch {
                        toast({ title: "Falha ao copiar", variant: "destructive" });
                      }
                    }}
                  >
                    Gerar e copiar relatório (ético)
                  </Button>
                </div>

                
                <div className="rounded-xl border border-rose-600/30 bg-rose-500/5 p-3 space-y-2">
                  <p className="text-[10px] font-black uppercase text-rose-900">Ouvidoria interna (5 dias úteis)</p>
                  <Input className="h-8 text-[11px]" placeholder="Assunto" value={ouvAssunto} onChange={(e) => setOuvAssunto(e.target.value)} />
                  <Input className="h-8 text-[11px]" placeholder="Descrição" value={ouvDesc} onChange={(e) => setOuvDesc(e.target.value)} />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="w-full text-[10px]"
                    onClick={() => {
                      if (!ouvAssunto.trim()) {
                        toast({ title: "Informe o assunto", variant: "destructive" });
                        return;
                      }
                      const tk = criarTicketOuvidoria({ assunto: ouvAssunto, descricao: ouvDesc });
                      setTickets((arr) => [tk, ...arr]);
                      setOuvAssunto("");
                      setOuvDesc("");
                      toast({ title: "Ticket aberto", description: `Prazo ${new Date(tk.prazoRespostaEm).toLocaleDateString("pt-BR")}` });
                    }}
                  >
                    Abrir ticket
                  </Button>
                  {tickets.slice(0, 5).map((tk) => (
                    <div key={tk.id} className="text-[10px] border border-border/40 rounded-lg p-2 space-y-1">
                      <p className="font-semibold">
                        {tk.assunto}{" "}
                        {ticketAtrasado(tk) ? (
                          <span className="text-red-700">ATRASADO</span>
                        ) : (
                          <span className="text-muted-foreground">{tk.status}</span>
                        )}
                      </p>
                      {tk.status !== "respondido" && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-6 text-[9px]"
                          onClick={() => {
                            const resp = window.prompt("Resposta da ouvidoria:");
                            if (!resp) return;
                            setTickets((arr) => arr.map((x) => (x.id === tk.id ? responderTicket(x, resp) : x)));
                          }}
                        >
                          Responder
                        </Button>
                      )}
                    </div>
                  ))}
                </div>

                <div className="rounded-xl border border-indigo-600/30 bg-indigo-500/5 p-3 space-y-2">
                  <p className="text-[10px] font-black uppercase text-indigo-900">NPS pós-diagnóstico</p>
                  <label className="text-[10px] block">Nota 0–10: {npsNota}
                    <input type="range" min={0} max={10} value={npsNota} onChange={(e) => setNpsNota(Number(e.target.value))} className="w-full" />
                  </label>
                  <label className="flex items-center gap-2 text-[11px] cursor-pointer">
                    <input type="checkbox" checked={npsEntC} onChange={(e) => setNpsEntC(e.target.checked)} />
                    Entendeu o contrato
                  </label>
                  <label className="flex items-center gap-2 text-[11px] cursor-pointer">
                    <input type="checkbox" checked={npsEntR} onChange={(e) => setNpsEntR(e.target.checked)} />
                    Entendeu custos e riscos
                  </label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="w-full text-[10px]"
                    onClick={() => {
                      const r = registrarNps({
                        nota: npsNota,
                        entendeuContrato: npsEntC,
                        entendeuCustosRiscos: npsEntR,
                      });
                      setNps(r);
                      toast({ title: "NPS registrado", description: `Nota ${r.nota}` });
                    }}
                  >
                    Registrar NPS
                  </Button>
                  {nps.coletadoEm && (
                    <p className="text-[10px] text-muted-foreground">
                      Último: nota {nps.nota} · contrato {nps.entendeuContrato ? "sim" : "não"} · riscos {nps.entendeuCustosRiscos ? "sim" : "não"}
                    </p>
                  )}
                </div>

                <div className="rounded-xl border border-slate-600/30 bg-slate-500/5 p-3 space-y-2">
                  <p className="text-[10px] font-black uppercase">Substabelecimento / advogado</p>
                  <Input className="h-8 text-[11px]" placeholder="Nome do advogado" value={sub.advogado.nome} onChange={(e) => setSub((s) => ({ ...s, advogado: { ...s.advogado, nome: e.target.value } }))} />
                  <Input className="h-8 text-[11px]" placeholder="OAB (ex. OAB/SP 123456)" value={sub.advogado.oab} onChange={(e) => setSub((s) => ({ ...s, advogado: { ...s.advogado, oab: e.target.value } }))} />
                  <Input className="h-8 text-[11px]" placeholder="Resumo honorários do advogado" value={sub.honorariosResumo} onChange={(e) => setSub((s) => ({ ...s, honorariosResumo: e.target.value }))} />
                  <label className="flex items-center gap-2 text-[11px] cursor-pointer">
                    <input type="checkbox" checked={sub.contratoHonorariosEntregue} onChange={(e) => setSub((s) => ({ ...s, contratoHonorariosEntregue: e.target.checked }))} />
                    Contrato de honorários entregue ao cliente
                  </label>
                  <label className="flex items-center gap-2 text-[11px] cursor-pointer">
                    <input type="checkbox" checked={sub.comReserva} onChange={(e) => setSub((s) => ({ ...s, comReserva: e.target.checked }))} />
                    Com reserva de poderes
                  </label>
                  <p className="text-[10px] text-muted-foreground">{textoResumoSubstabelecimento(sub)}</p>
                  {substabelecimentoValido(sub) && (
                    <Button type="button" size="sm" variant="outline" className="w-full text-[10px]" onClick={() => setFluxo((f) => ({ ...f, contratoHonorariosAdvogadoEntregue: true }))}>
                      Validar gate honorários advogado
                    </Button>
                  )}
                </div>

                <div className="rounded-xl border border-border/60 p-3 space-y-2">
                  <p className="text-[10px] font-black uppercase text-muted-foreground">Carta de desistência</p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="w-full text-[10px]"
                    onClick={() => {
                      const txt = gerarCartaDesistencia({
                        nomeCliente: nomeCliente || "cliente",
                        protocolo: protocolo || null,
                        empresa,
                      });
                      setCartaTxt(txt);
                      toast({ title: "Carta gerada", description: "Revise e entregue ao cliente" });
                    }}
                  >
                    Gerar carta
                  </Button>
                  {cartaTxt && (
                    <textarea className="w-full min-h-[120px] text-[10px] rounded-lg border border-border/50 p-2 font-mono" value={cartaTxt} onChange={(e) => setCartaTxt(e.target.value)} />
                  )}
                </div>

<div className="rounded-xl border border-border/60 p-3 space-y-1">
                  <p className="text-[10px] font-black uppercase text-muted-foreground flex items-center gap-1">
                    <Ban size={12} /> Docs que NUNCA cobramos
                  </p>
                  {DOCUMENTOS_GRATUITOS.map((d) => (
                    <p key={d.id} className="text-[11px]">
                      <span className="font-semibold">{d.label}</span>
                      <span className="text-muted-foreground"> — {d.como}</span>
                    </p>
                  ))}
                </div>
              </div>
            </ScrollArea>
          </section>

          {/* Coluna direita: scripts + auditor */}
          <section className="lg:col-span-7 flex flex-col min-h-0">
            <div className="p-3 border-b border-border/40">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1 mb-2">
                <BookOpen size={12} /> Scripts oficiais éticos
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {SCRIPTS_ETICOS.map((s) => (
                  <div
                    key={s.id}
                    className="rounded-lg border border-border/50 bg-card p-2.5 space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-[11px] font-black uppercase truncate">{s.titulo}</p>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 text-[9px] shrink-0"
                        onClick={() => void copiarScript(s.id)}
                      >
                        {copiedId === s.id ? <Check size={12} /> : <Copy size={12} />}
                        <span className="ml-1">Copiar</span>
                      </Button>
                    </div>
                    <p className="text-[10px] text-muted-foreground line-clamp-3">
                      {preencherScript(s, {
                        nome: nomeCliente || "cliente",
                        empresa,
                        protocolo,
                      })}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex-1 flex flex-col min-h-0 p-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1">
                <AlertTriangle size={12} /> Auditor de rascunho (antes do WhatsApp)
              </p>
              <textarea
                className="flex-1 min-h-[160px] w-full rounded-xl border border-border/60 bg-background p-3 text-sm resize-none"
                placeholder="Cole aqui a mensagem que pretende enviar ao cliente…"
                value={rascunho}
                onChange={(e) => setRascunho(e.target.value)}
              />
              <div className="mt-2 space-y-1">
                {auditoria.ok && rascunho.trim() && (
                  <p className="text-[11px] text-emerald-700 font-semibold">Sem frases de bloqueio detectadas.</p>
                )}
                {auditoria.bloqueios.map((b, i) => (
                  <p key={i} className="text-[11px] text-red-700 font-semibold">
                    BLOQUEIO: {b.motivo}
                    {b.trecho ? ` (“${b.trecho}”)` : ""}
                  </p>
                ))}
                {auditoria.alertas.map((a, i) => (
                  <p key={i} className="text-[11px] text-amber-800 font-semibold">
                    ALERTA: {a.motivo}
                    {a.trecho ? ` (“${a.trecho}”)` : ""}
                  </p>
                ))}
                <Button
                  type="button"
                  size="sm"
                  disabled={!rascunho.trim() || !auditoria.ok}
                  onClick={async () => {
                    await navigator.clipboard.writeText(rascunho);
                    toast({ title: "Copiado", description: "Mensagem aprovada pelo auditor ético" });
                  }}
                >
                  Copiar só se compliance OK
                </Button>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
