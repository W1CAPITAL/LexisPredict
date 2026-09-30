"use client";

import React, { useMemo, useRef, useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  buildLegalDocument,
  LEGAL_DOCUMENT_TEMPLATES,
  SPECIAL_POWER_OPTIONS,
  type LegalDocumentData,
  type LegalDocumentKind,
} from "@/lib/legal-document-generator";
import {
  extrairDadosProcuracaoAction,
  extrairTextoDoPDFAction,
  gerarPecaTextoPDFAction,
} from "@/app/actions/document-actions";
import {
  AlertTriangle,
  Clipboard,
  Download,
  FileEdit,
  FileText,
  Loader2,
  Save,
  ShieldCheck,
  Sparkles,
  Upload,
} from "lucide-react";

const initial: LegalDocumentData = {
  juizo: "",
  comarca: "",
  processo: "",
  autor: "",
  reu: "",
  clienteNome: "",
  cpf: "",
  rg: "",
  nacionalidade: "brasileiro(a)",
  estadoCivil: "",
  profissao: "",
  endereco: "",
  email: "",
  advogadoNome: "",
  oab: "",
  advogadoAnteriorNome: "",
  oabAnterior: "",
  advogadoNovoNome: "",
  oabNovo: "",
  tituloAcao: "",
  fatos: "",
  fundamentos: "",
  pedidos: "",
  decisao: "",
  prazoOuIntimacao: "",
  valorCausa: "",
  cidade: "",
  dataExtenso: "",
  notificante: "",
  notificado: "",
  enderecoNotificado: "",
  objetoNotificacao: "",
  prazoNotificacao: "",
  beneficiario: "",
  cpfBeneficiario: "",
  formaRecebimento: "",
  banco: "",
  agencia: "",
  conta: "",
  tipoConta: "",
  titularConta: "",
  cpfTitularConta: "",
  chavePix: "",
  valorExecucao: "",
  indiceCorrecao: "",
  juros: "",
  termoInicial: "",
  termoFinal: "",
  descontos: "",
  memoriaCalculo: "",
  observacoes: "",
  specialPowers: [],
  permiteSubstabelecer: true,
  clienteCienteSemReserva: false,
  constituiNovoPatrono: false,
  revisouPrazo: false,
  dadosBancariosConferidos: false,
};

function safeFileName(value: string) {
  return String(value || "documento-juridico")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 90);
}

function rtfEscape(text: string) {
  return String(text || "")
    .replace(/\\/g, "\\\\")
    .replace(/\{/g, "\\{")
    .replace(/\}/g, "\\}")
    .replace(/[^\x00-\x7F]/g, (c) => `\\u${c.charCodeAt(0)}?`)
    .replace(/\r?\n/g, "\\par\n");
}

function downloadBlob(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[10px] font-black uppercase tracking-wide text-[#5f1d25]">{label}</Label>
      <Input
        type={type}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-11 rounded-none border-[#b89b5e]/60 bg-[#fffdf7]"
      />
    </div>
  );
}

export default function LegalDocumentGeneratorPage() {
  const [kind, setKind] = useState<LegalDocumentKind>("peticao-inicial");
  const [form, setForm] = useState<LegalDocumentData>(initial);
  const [draft, setDraft] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [sourceText, setSourceText] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const template = useMemo(
    () => LEGAL_DOCUMENT_TEMPLATES.find((x) => x.id === kind) || LEGAL_DOCUMENT_TEMPLATES[0],
    [kind]
  );

  const set = (key: keyof LegalDocumentData, value: any) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const regenerate = () => {
    const result = buildLegalDocument(kind, form);
    setDraft(result.text);
    setWarnings(result.warnings);
    toast({ title: "Minuta atualizada", description: "O texto abaixo continua 100% editável." });
  };

  const handlePdf = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("pdf", file);
      const parsed = await extrairTextoDoPDFAction(fd);
      if (!parsed.success || !parsed.text) {
        toast({ title: "Falha na leitura", description: parsed.error || "Não foi possível extrair o PDF.", variant: "destructive" });
        return;
      }
      setSourceText(parsed.text);
      const extracted = await extrairDadosProcuracaoAction(parsed.text, form.advogadoNome || "", "SP");
      if (extracted.success) {
        const cliente: any = extracted.cliente || {};
        const proc: any = extracted.processos?.[0] || {};
        setForm((prev) => ({
          ...prev,
          clienteNome: prev.clienteNome || cliente.nome || "",
          autor: prev.autor || cliente.nome || "",
          cpf: prev.cpf || cliente.cpf || "",
          rg: prev.rg || cliente.rg || "",
          endereco: prev.endereco || cliente.endereco || "",
          email: prev.email || cliente.email || "",
          processo: prev.processo || proc.numero || "",
          reu: prev.reu || proc.banco || "",
          tituloAcao: prev.tituloAcao || proc.acao || "",
        }));
      }
      toast({ title: "PDF importado", description: "Dados básicos foram pré-preenchidos. Revise tudo antes de gerar." });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const exportPdf = async () => {
    if (!draft.trim()) regenerate();
    const text = draft.trim() || buildLegalDocument(kind, form).text;
    setBusy(true);
    try {
      const result = await gerarPecaTextoPDFAction({
        texto: text,
        titulo: template.label,
        sub: form.processo ? `Processo ${form.processo}` : "Minuta editável",
      });
      if (!result.success || !result.base64) {
        toast({ title: "Falha no PDF", description: result.error || "Não foi possível gerar.", variant: "destructive" });
        return;
      }
      const bytes = Uint8Array.from(atob(result.base64), (c) => c.charCodeAt(0));
      downloadBlob(
        `${safeFileName(template.label)}.pdf`,
        new Blob([bytes], { type: "application/pdf" })
      );
    } finally {
      setBusy(false);
    }
  };

  const exportRtf = () => {
    const text = draft.trim() || buildLegalDocument(kind, form).text;
    const rtf = `{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0 Times New Roman;}}\\fs24 ${rtfEscape(text)}}`;
    downloadBlob(
      `${safeFileName(template.label)}.rtf`,
      new Blob([rtf], { type: "application/rtf;charset=utf-8" })
    );
  };

  const saveLocal = () => {
    localStorage.setItem("lexis-legal-document-draft-v1", JSON.stringify({ kind, form, draft }));
    toast({ title: "Rascunho salvo neste navegador" });
  };

  const loadLocal = () => {
    try {
      const raw = localStorage.getItem("lexis-legal-document-draft-v1");
      if (!raw) return toast({ title: "Nenhum rascunho salvo" });
      const saved = JSON.parse(raw);
      if (saved.kind) setKind(saved.kind);
      if (saved.form) setForm({ ...initial, ...saved.form });
      if (typeof saved.draft === "string") setDraft(saved.draft);
      toast({ title: "Rascunho restaurado" });
    } catch {
      toast({ title: "Rascunho inválido", variant: "destructive" });
    }
  };

  const togglePower = (power: string) => {
    const current = form.specialPowers || [];
    set("specialPowers", current.includes(power) ? current.filter((x) => x !== power) : [...current, power]);
  };

  const isMandate = ["procuracao","substabelecimento-com-reserva","substabelecimento-sem-reserva","revogacao-mandato"].includes(kind);
  const isMLE = kind === "mle-tjsp";
  const isExecution = ["cumprimento-sentenca","impugnacao-cumprimento"].includes(kind);
  const isAppeal = ["apelacao","recurso-inominado","embargos-declaracao"].includes(kind);
  const isNotification = kind === "notificacao-extrajudicial";

  return (
    <div className="flex min-h-screen bg-[#f3efe4] text-[#241b17]">
      <Sidebar />
      <main className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 border-b border-[#b89b5e]/40 bg-[#fffaf0]/95 backdrop-blur">
          <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-4 py-4 lg:px-8">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center border border-[#b89b5e] bg-[#6f1d2b] text-[#f7df9b]">
                <FileEdit size={21} />
              </div>
              <div>
                <h1 className="text-lg font-black uppercase tracking-tight text-[#6f1d2b]">Central de Peças Jurídicas</h1>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#6b6258]">Minuta → revisão → edição → PDF / RTF</p>
              </div>
            </div>
            <Badge className="rounded-none bg-[#6f1d2b] text-[#f7df9b]">Tudo editável</Badge>
          </div>
        </header>

        <div className="mx-auto grid max-w-[1600px] grid-cols-1 gap-6 p-4 lg:grid-cols-[460px_minmax(0,1fr)] lg:p-8">
          <section className="space-y-5">
            <Card className="rounded-none border-[#b89b5e]/70 bg-[#fffaf0] shadow-[6px_6px_0_#6f1d2b]">
              <CardHeader className="border-b border-[#b89b5e]/40 pb-4">
                <CardTitle className="text-xs font-black uppercase tracking-[0.16em] text-[#6f1d2b]">1. Tipo de documento</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-5">
                <Select value={kind} onValueChange={(v) => { setKind(v as LegalDocumentKind); setWarnings([]); }}>
                  <SelectTrigger className="h-12 rounded-none border-[#6f1d2b] bg-white font-bold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-[420px]">
                    {LEGAL_DOCUMENT_TEMPLATES.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.label} · {item.category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="border-l-4 border-[#b89b5e] bg-white p-3 text-xs">
                  <p className="font-bold text-[#6f1d2b]">{template.description}</p>
                  <p className="mt-2 text-[11px] text-[#655b52]"><b>Base:</b> {template.legalBasis.join(" · ")}</p>
                  {template.deadlineHint ? <p className="mt-2 text-[11px] text-[#8a5b20]"><b>Prazo:</b> {template.deadlineHint}</p> : null}
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-none border-[#b89b5e]/70 bg-[#fffaf0]">
              <CardHeader className="border-b border-[#b89b5e]/40 pb-4">
                <CardTitle className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-[#6f1d2b]">
                  <Upload size={15}/> Importar processo/documento
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 pt-5">
                <input ref={fileRef} type="file" accept=".pdf,application/pdf" className="hidden" onChange={(e) => void handlePdf(e.target.files?.[0])}/>
                <Button onClick={() => fileRef.current?.click()} disabled={busy} className="w-full rounded-none bg-[#6f1d2b] text-white hover:bg-[#561620]">
                  {busy ? <Loader2 className="mr-2 animate-spin" size={16}/> : <Upload className="mr-2" size={16}/>} Ler PDF e pré-preencher
                </Button>
                {sourceText ? (
                  <>
                    <p className="text-[10px] font-bold uppercase text-[#6b6258]">Texto extraído: {sourceText.length.toLocaleString("pt-BR")} caracteres</p>
                    <Button variant="outline" onClick={() => set("fatos", sourceText.slice(0,12000))} className="w-full rounded-none border-[#b89b5e]">
                      Usar texto extraído no campo Fatos
                    </Button>
                  </>
                ) : null}
              </CardContent>
            </Card>

            <Card className="rounded-none border-[#b89b5e]/70 bg-[#fffaf0]">
              <CardHeader className="border-b border-[#b89b5e]/40 pb-4">
                <CardTitle className="text-xs font-black uppercase tracking-[0.16em] text-[#6f1d2b]">2. Dados principais</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-3 pt-5 sm:grid-cols-2">
                <div className="sm:col-span-2"><Field label="Juízo / destinatário" value={form.juizo} onChange={(v)=>set("juizo",v)} placeholder="Ex.: Excelentíssimo(a) Senhor(a) Doutor(a) Juiz(a)..."/></div>
                <Field label="Processo CNJ" value={form.processo} onChange={(v)=>set("processo",v)} />
                <Field label="Comarca" value={form.comarca} onChange={(v)=>set("comarca",v)} />
                <Field label="Autor / requerente" value={form.autor} onChange={(v)=>set("autor",v)} />
                <Field label="Réu / requerido" value={form.reu} onChange={(v)=>set("reu",v)} />
                <Field label="Cliente / outorgante" value={form.clienteNome} onChange={(v)=>set("clienteNome",v)} />
                <Field label="CPF" value={form.cpf} onChange={(v)=>set("cpf",v)} />
                <Field label="RG" value={form.rg} onChange={(v)=>set("rg",v)} />
                <Field label="E-mail" value={form.email} onChange={(v)=>set("email",v)} />
                <div className="sm:col-span-2"><Field label="Endereço" value={form.endereco} onChange={(v)=>set("endereco",v)} /></div>
                <Field label="Advogado responsável" value={form.advogadoNome} onChange={(v)=>set("advogadoNome",v)} />
                <Field label="OAB" value={form.oab} onChange={(v)=>set("oab",v)} placeholder="SP 000000"/>
                <Field label="Cidade" value={form.cidade} onChange={(v)=>set("cidade",v)} />
                <Field label="Data por extenso" value={form.dataExtenso} onChange={(v)=>set("dataExtenso",v)} placeholder="30 de setembro de 2026"/>
                <div className="sm:col-span-2"><Field label="Ação / assunto / objeto" value={form.tituloAcao} onChange={(v)=>set("tituloAcao",v)} /></div>
                <Field label="Valor da causa / valor correto" value={form.valorCausa} onChange={(v)=>set("valorCausa",v)} />
                <Field label="Intimação / termo inicial / prazo" value={form.prazoOuIntimacao} onChange={(v)=>set("prazoOuIntimacao",v)} />
              </CardContent>
            </Card>

            {isMandate ? (
              <Card className="rounded-none border-[#b89b5e]/70 bg-[#fffaf0]">
                <CardHeader className="border-b border-[#b89b5e]/40 pb-4">
                  <CardTitle className="text-xs font-black uppercase tracking-[0.16em] text-[#6f1d2b]">Mandato e poderes</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-5">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Field label="Advogado anterior / substabelecente" value={form.advogadoAnteriorNome} onChange={(v)=>set("advogadoAnteriorNome",v)} />
                    <Field label="OAB anterior" value={form.oabAnterior} onChange={(v)=>set("oabAnterior",v)} />
                    <Field label="Novo advogado / substabelecido" value={form.advogadoNovoNome} onChange={(v)=>set("advogadoNovoNome",v)} />
                    <Field label="OAB novo" value={form.oabNovo} onChange={(v)=>set("oabNovo",v)} />
                  </div>
                  {kind === "procuracao" ? (
                    <div className="space-y-2 border-t border-[#b89b5e]/30 pt-4">
                      <p className="text-[10px] font-black uppercase text-[#6f1d2b]">Poderes especiais — selecionar somente os autorizados</p>
                      {SPECIAL_POWER_OPTIONS.map((power) => (
                        <label key={power} className="flex items-start gap-2 text-xs">
                          <input type="checkbox" checked={(form.specialPowers||[]).includes(power)} onChange={()=>togglePower(power)} className="mt-0.5"/>
                          <span>{power}</span>
                        </label>
                      ))}
                      <label className="flex items-center gap-2 text-xs font-semibold">
                        <input type="checkbox" checked={!!form.permiteSubstabelecer} onChange={(e)=>set("permiteSubstabelecer",e.target.checked)}/>
                        Autorizar substabelecimento
                      </label>
                    </div>
                  ) : null}
                  {kind === "substabelecimento-sem-reserva" ? (
                    <label className="flex items-start gap-2 border border-amber-300 bg-amber-50 p-3 text-xs font-semibold">
                      <input type="checkbox" className="mt-0.5" checked={!!form.clienteCienteSemReserva} onChange={(e)=>set("clienteCienteSemReserva",e.target.checked)}/>
                      Confirmo que há prévio e inequívoco conhecimento do cliente sobre o substabelecimento sem reserva.
                    </label>
                  ) : null}
                  {kind === "revogacao-mandato" ? (
                    <label className="flex items-start gap-2 border border-[#b89b5e] bg-white p-3 text-xs font-semibold">
                      <input type="checkbox" className="mt-0.5" checked={!!form.constituiNovoPatrono} onChange={(e)=>set("constituiNovoPatrono",e.target.checked)}/>
                      Novo patrono será constituído no mesmo ato / representação processual revisada.
                    </label>
                  ) : null}
                </CardContent>
              </Card>
            ) : null}

            {isMLE ? (
              <Card className="rounded-none border-[#b89b5e]/70 bg-[#fffaf0]">
                <CardHeader className="border-b border-[#b89b5e]/40 pb-4">
                  <CardTitle className="text-xs font-black uppercase tracking-[0.16em] text-[#6f1d2b]">Dados MLE</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 gap-3 pt-5 sm:grid-cols-2">
                  <Field label="Beneficiário / credor" value={form.beneficiario} onChange={(v)=>set("beneficiario",v)} />
                  <Field label="CPF/CNPJ beneficiário" value={form.cpfBeneficiario} onChange={(v)=>set("cpfBeneficiario",v)} />
                  <div className="sm:col-span-2"><Field label="Forma de recebimento" value={form.formaRecebimento} onChange={(v)=>set("formaRecebimento",v)} placeholder="Banco / BB / outro banco / PIX"/></div>
                  <Field label="Banco" value={form.banco} onChange={(v)=>set("banco",v)} />
                  <Field label="Agência" value={form.agencia} onChange={(v)=>set("agencia",v)} />
                  <Field label="Conta" value={form.conta} onChange={(v)=>set("conta",v)} />
                  <Field label="Tipo de conta" value={form.tipoConta} onChange={(v)=>set("tipoConta",v)} />
                  <Field label="Titular da conta" value={form.titularConta} onChange={(v)=>set("titularConta",v)} />
                  <Field label="CPF/CNPJ titular" value={form.cpfTitularConta} onChange={(v)=>set("cpfTitularConta",v)} />
                  <div className="sm:col-span-2"><Field label="Chave PIX" value={form.chavePix} onChange={(v)=>set("chavePix",v)} /></div>
                  <label className="sm:col-span-2 flex items-start gap-2 border border-[#b89b5e] bg-white p-3 text-xs font-semibold">
                    <input type="checkbox" className="mt-0.5" checked={!!form.dadosBancariosConferidos} onChange={(e)=>set("dadosBancariosConferidos",e.target.checked)}/>
                    Conferi beneficiário, titularidade, conta/PIX e poderes para receber/dar quitação.
                  </label>
                </CardContent>
              </Card>
            ) : null}

            {isNotification ? (
              <Card className="rounded-none border-[#b89b5e]/70 bg-[#fffaf0]">
                <CardHeader className="border-b border-[#b89b5e]/40 pb-4">
                  <CardTitle className="text-xs font-black uppercase tracking-[0.16em] text-[#6f1d2b]">Notificação</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 gap-3 pt-5">
                  <Field label="Notificante" value={form.notificante} onChange={(v)=>set("notificante",v)} />
                  <Field label="Notificado" value={form.notificado} onChange={(v)=>set("notificado",v)} />
                  <Field label="Endereço do notificado" value={form.enderecoNotificado} onChange={(v)=>set("enderecoNotificado",v)} />
                  <Field label="Objeto" value={form.objetoNotificacao} onChange={(v)=>set("objetoNotificacao",v)} />
                  <Field label="Prazo para resposta/cumprimento" value={form.prazoNotificacao} onChange={(v)=>set("prazoNotificacao",v)} />
                </CardContent>
              </Card>
            ) : null}

            {isExecution ? (
              <Card className="rounded-none border-[#b89b5e]/70 bg-[#fffaf0]">
                <CardHeader className="border-b border-[#b89b5e]/40 pb-4">
                  <CardTitle className="text-xs font-black uppercase tracking-[0.16em] text-[#6f1d2b]">Cálculo / execução</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 gap-3 pt-5 sm:grid-cols-2">
                  <Field label="Valor atualizado / cobrado" value={form.valorExecucao} onChange={(v)=>set("valorExecucao",v)} />
                  <Field label="Índice de correção" value={form.indiceCorrecao} onChange={(v)=>set("indiceCorrecao",v)} />
                  <Field label="Juros e taxa" value={form.juros} onChange={(v)=>set("juros",v)} />
                  <Field label="Termo inicial" value={form.termoInicial} onChange={(v)=>set("termoInicial",v)} />
                  <Field label="Data-base / termo final" value={form.termoFinal} onChange={(v)=>set("termoFinal",v)} />
                  <Field label="Descontos" value={form.descontos} onChange={(v)=>set("descontos",v)} />
                  <div className="sm:col-span-2 space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-[#6f1d2b]">Memória discriminada do cálculo</Label>
                    <Textarea value={form.memoriaCalculo||""} onChange={(e)=>set("memoriaCalculo",e.target.value)} rows={7} className="rounded-none border-[#b89b5e]/60 bg-white font-mono text-xs"/>
                  </div>
                </CardContent>
              </Card>
            ) : null}

            {isAppeal || ["replica","impugnacao-cumprimento"].includes(kind) ? (
              <label className="flex items-start gap-2 border border-amber-300 bg-amber-50 p-3 text-xs font-semibold">
                <input type="checkbox" className="mt-0.5" checked={!!form.revisouPrazo} onChange={(e)=>set("revisouPrazo",e.target.checked)}/>
                Conferi o cabimento, a intimação, o termo inicial, o prazo e o preparo/gratuidade diretamente nos autos.
              </label>
            ) : null}

            {!isMandate && !isMLE ? (
              <Card className="rounded-none border-[#b89b5e]/70 bg-[#fffaf0]">
                <CardHeader className="border-b border-[#b89b5e]/40 pb-4">
                  <CardTitle className="text-xs font-black uppercase tracking-[0.16em] text-[#6f1d2b]">3. Conteúdo jurídico</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-5">
                  {isAppeal || kind === "cumprimento-sentenca" ? (
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase text-[#6f1d2b]">Decisão / sentença / título</Label>
                      <Textarea value={form.decisao||""} onChange={(e)=>set("decisao",e.target.value)} rows={7} className="rounded-none border-[#b89b5e]/60 bg-white"/>
                    </div>
                  ) : null}
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-[#6f1d2b]">Fatos / objeto</Label>
                    <Textarea value={form.fatos||""} onChange={(e)=>set("fatos",e.target.value)} rows={9} className="rounded-none border-[#b89b5e]/60 bg-white"/>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-[#6f1d2b]">Fundamentos</Label>
                    <Textarea value={form.fundamentos||""} onChange={(e)=>set("fundamentos",e.target.value)} rows={9} className="rounded-none border-[#b89b5e]/60 bg-white"/>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-[#6f1d2b]">Pedidos / requerimentos</Label>
                    <Textarea value={form.pedidos||""} onChange={(e)=>set("pedidos",e.target.value)} rows={9} className="rounded-none border-[#b89b5e]/60 bg-white"/>
                  </div>
                </CardContent>
              </Card>
            ) : null}

            <div className="grid grid-cols-2 gap-3">
              <Button onClick={regenerate} className="rounded-none bg-[#6f1d2b] text-white hover:bg-[#561620]">
                <Sparkles className="mr-2" size={16}/> Gerar minuta
              </Button>
              <Button variant="outline" onClick={saveLocal} className="rounded-none border-[#b89b5e]">
                <Save className="mr-2" size={16}/> Salvar local
              </Button>
              <Button variant="outline" onClick={loadLocal} className="col-span-2 rounded-none border-[#b89b5e]">
                Restaurar rascunho deste navegador
              </Button>
            </div>
          </section>

          <section className="min-w-0 space-y-5">
            {warnings.length ? (
              <Alert className="rounded-none border-amber-400 bg-amber-50">
                <AlertTriangle className="h-4 w-4"/>
                <AlertTitle>Pontos para conferir antes de usar</AlertTitle>
                <AlertDescription>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
                    {warnings.map((w)=><li key={w}>{w}</li>)}
                  </ul>
                </AlertDescription>
              </Alert>
            ) : (
              <Alert className="rounded-none border-[#b89b5e] bg-[#fffaf0]">
                <ShieldCheck className="h-4 w-4"/>
                <AlertTitle>Editor controlado</AlertTitle>
                <AlertDescription className="text-xs">
                  O gerador não inventa fatos faltantes: campos ausentes permanecem marcados para preenchimento. Gere a minuta e revise o texto integralmente antes de protocolar.
                </AlertDescription>
              </Alert>
            )}

            <Card className="rounded-none border-[#b89b5e]/70 bg-[#fffaf0] shadow-[8px_8px_0_#b89b5e]">
              <CardHeader className="flex-row items-center justify-between gap-4 border-b border-[#b89b5e]/40">
                <div>
                  <CardTitle className="text-sm font-black uppercase tracking-[0.12em] text-[#6f1d2b]">Editor da minuta</CardTitle>
                  <p className="mt-1 text-[10px] font-bold uppercase text-[#6b6258]">O texto abaixo é o documento final exportado</p>
                </div>
                <Badge variant="outline" className="rounded-none border-[#6f1d2b] text-[#6f1d2b]">{draft.length.toLocaleString("pt-BR")} caracteres</Badge>
              </CardHeader>
              <CardContent className="p-0">
                <Textarea
                  value={draft}
                  onChange={(e)=>setDraft(e.target.value)}
                  placeholder="Clique em “Gerar minuta”. Depois edite livremente aqui."
                  className="min-h-[780px] resize-y rounded-none border-0 bg-[#fffdf7] p-8 font-serif text-[15px] leading-7 shadow-none focus-visible:ring-0"
                />
              </CardContent>
            </Card>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Button variant="outline" className="rounded-none border-[#6f1d2b] text-[#6f1d2b]" onClick={async()=>{
                const text=draft.trim()||buildLegalDocument(kind,form).text;
                await navigator.clipboard.writeText(text);
                toast({title:"Texto copiado"});
              }}>
                <Clipboard className="mr-2" size={16}/> Copiar
              </Button>
              <Button variant="outline" className="rounded-none border-[#6f1d2b] text-[#6f1d2b]" onClick={exportRtf}>
                <FileText className="mr-2" size={16}/> RTF editável
              </Button>
              <Button disabled={busy} onClick={()=>void exportPdf()} className="rounded-none bg-[#6f1d2b] text-white hover:bg-[#561620]">
                {busy?<Loader2 className="mr-2 animate-spin" size={16}/>:<Download className="mr-2" size={16}/>} PDF
              </Button>
              <Button variant="outline" className="rounded-none border-[#b89b5e]" onClick={()=>{setForm(initial);setDraft("");setWarnings([]);setSourceText("");}}>
                Nova minuta
              </Button>
            </div>

            <div className="border-l-4 border-[#6f1d2b] bg-[#fffaf0] p-4 text-xs leading-5 text-[#655b52]">
              <b>Referência de projeto:</b> a estrutura prioriza cabeçalho claro, seções numeradas, pedidos individualizados e área de assinatura, seguindo o padrão documental fornecido. O conteúdo jurídico continua dependente dos fatos, documentos, decisão e prazo do caso concreto.
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
