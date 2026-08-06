/**
 * Cadastro de processo (ex-Automação Judicial)
 * Fluxo principal: CNJ → DataJud + DJEN → formulário completo → carteira
 * Sem screenshot automático do tribunal.
 */
"use client";

import React, { useMemo, useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Search,
  ClipboardList,
  CheckCircle2,
  Sparkles,
  ExternalLink,
  Receipt,
  User,
  Building2,
  Scale,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  registerCaseFromAutomacaoAction,
  enrichCadastroByCnjAction,
} from "@/app/actions/automacao-register-actions";
import { getTribunalByCnj } from "@/lib/tribunais-links";
import { cn } from "@/lib/utils";
import Link from "next/link";

export const PORTAL_CUSTAS_TJSP =
  "https://portaldecustas.tjsp.jus.br/portaltjsp/pages/custas/new";

type TabId = "cadastro" | "custas";

const emptyForm = () => ({
  protocolo: "",
  cliente: "",
  cpf: "",
  email: "",
  telefone: "",
  estado_civil: "",
  emprego: "",
  nacionalidade: "BRASILEIRA",
  parte_passiva: "",
  parte_passiva_cnpj: "",
  advogado: "",
  escritorio: "",
  classe_acao: "",
  tribunal: "",
  orgao_julgador: "",
  situacao: "EM ANDAMENTO",
  proximoPrazo: "",
  observacao: "",
});

export default function CadastroProcessoPage() {
  const [tab, setTab] = useState<TabId>("cadastro");
  const [loading, setLoading] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [meta, setMeta] = useState<{
    fonte?: string;
    djenCount?: number;
    djenResumo?: string | null;
    movimentosResumo?: string | null;
    poloAtivo?: string[];
    poloPassivo?: string[];
  } | null>(null);
  const [custasCnj, setCustasCnj] = useState("");
  const [custasCpf, setCustasCpf] = useState("");
  const { toast } = useToast();

  const cleanCnj = form.protocolo.replace(/\D/g, "");
  const tribunalPreview = form.protocolo.trim()
    ? getTribunalByCnj(form.protocolo)
    : null;

  const setField = (key: keyof ReturnType<typeof emptyForm>, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  /** Busca DataJud + DJEN e preenche o formulário */
  const runEnrich = async () => {
    if (cleanCnj.length !== 20) {
      toast({ title: "CNJ inválido", description: "Informe 20 dígitos.", variant: "destructive" });
      return;
    }
    setLoading("enrich");
    try {
      const res = await enrichCadastroByCnjAction(form.protocolo);
      if (!res.success) {
        toast({
          title: "Consulta incompleta",
          description: res.error || "Sem dados oficiais",
          variant: "destructive",
        });
        return;
      }
      setForm((prev) => ({
        ...prev,
        protocolo: res.protocolo || prev.protocolo,
        cliente: res.cliente || prev.cliente,
        parte_passiva: res.parte_passiva || prev.parte_passiva,
        parte_passiva_cnpj: res.parte_passiva_cnpj || prev.parte_passiva_cnpj,
        advogado: res.advogado || prev.advogado,
        classe_acao: res.classe_acao || prev.classe_acao,
        tribunal: res.tribunal || prev.tribunal,
        orgao_julgador: res.orgao_julgador || prev.orgao_julgador,
        nacionalidade: prev.nacionalidade || "BRASILEIRA",
        cpf: (res as any).cpf || prev.cpf,
      }));
      setMeta({
        fonte: res.fonte,
        djenCount: res.djenCount,
        djenResumo: res.djenResumo,
        movimentosResumo: res.movimentosResumo,
        poloAtivo: res.poloAtivo,
        poloPassivo: res.poloPassivo,
      });
      const filled = [
        res.cliente && "cliente",
        res.parte_passiva && "réu",
        res.classe_acao && "classe",
        res.advogado && "advogado",
        (res as any).cpf && "CPF",
      ].filter(Boolean);
      toast({
        title: filled.length ? "Dados oficiais carregados" : "Consulta ok — complete manualmente",
        description: `${res.fonte || "CNJ"} · ${filled.length ? filled.join(", ") : "partes não indexadas no tribunal"}`,
      });
    } catch (e: any) {
      toast({ title: "Erro", description: e?.message || "Falha", variant: "destructive" });
    } finally {
      setLoading(null);
    }
  };

  const runSave = async () => {
    if (cleanCnj.length !== 20) {
      toast({ title: "CNJ inválido", variant: "destructive" });
      return;
    }
    if (!form.cliente.trim()) {
      toast({ title: "Informe o cliente", variant: "destructive" });
      return;
    }
    setLoading("save");
    try {
      const res = await registerCaseFromAutomacaoAction({
        protocolo: form.protocolo,
        cliente: form.cliente,
        telefone: form.telefone,
        tribunal: form.tribunal,
        classificacao: form.classe_acao,
        observacao: form.observacao,
        cpf: form.cpf,
        email: form.email,
        estado_civil: form.estado_civil,
        emprego: form.emprego,
        nacionalidade: form.nacionalidade || "BRASILEIRA",
        parte_passiva: form.parte_passiva,
        parte_passiva_cnpj: form.parte_passiva_cnpj,
        classe_acao: form.classe_acao,
        orgao_julgador: form.orgao_julgador,
        advogado: form.advogado,
        escritorio: form.escritorio,
        proximoPrazo: form.proximoPrazo,
        situacao: form.situacao,
      });
      if (!res.success) {
        toast({ title: "Cadastro falhou", description: res.error, variant: "destructive" });
        return;
      }
      toast({
        title: res.created ? "Processo cadastrado" : "Processo atualizado",
        description: "Disponível na aba Processos",
      });
    } catch (e: any) {
      toast({ title: "Erro", description: e?.message, variant: "destructive" });
    } finally {
      setLoading(null);
    }
  };

  const custasUrl = useMemo(() => {
    const q = new URLSearchParams();
    if (custasCnj.replace(/\D/g, "").length === 20) q.set("cnj", custasCnj);
    return PORTAL_CUSTAS_TJSP;
  }, [custasCnj]);

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 p-4 md:p-8 max-w-5xl mx-auto space-y-6 overflow-auto">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tight flex items-center gap-2">
              <ClipboardList className="w-6 h-6 text-primary" />
              Cadastro
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Informe o CNJ → sistema consulta DataJud e DJEN → complete os dados do cliente e grave na carteira.
            </p>
          </div>
          <Button asChild variant="outline" className="rounded-xl font-black uppercase text-[10px]">
            <Link href="/cases">Abrir Processos</Link>
          </Button>
        </div>

        <div className="flex gap-2 border-b border-border">
          <button
            type="button"
            onClick={() => setTab("cadastro")}
            className={cn(
              "px-4 py-2.5 text-[11px] font-black uppercase tracking-widest rounded-t-xl border border-b-0",
              tab === "cadastro" ? "bg-card border-border" : "text-muted-foreground border-transparent"
            )}
          >
            Novo processo
          </button>
          <button
            type="button"
            onClick={() => setTab("custas")}
            className={cn(
              "px-4 py-2.5 text-[11px] font-black uppercase tracking-widest rounded-t-xl border border-b-0",
              tab === "custas" ? "bg-card border-border" : "text-muted-foreground border-transparent"
            )}
          >
            Custas (TJSP)
          </button>
        </div>

        {tab === "cadastro" && (
          <div className="space-y-6">
            {/* CNJ + buscar */}
            <Card className="border-2 border-black/10 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-black uppercase flex items-center gap-2">
                  <Search size={16} className="text-primary" /> Consulta pelo CNJ
                </CardTitle>
                <CardDescription>
                  Não abre o site do tribunal nem tira print. Usa DataJud (partes/classe) e DJEN (publicações).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1 space-y-2">
                    <Label className="text-[10px] font-black uppercase">Número do processo (CNJ)</Label>
                    <Input
                      value={form.protocolo}
                      onChange={(e) => setField("protocolo", e.target.value)}
                      placeholder="0000000-00.0000.0.00.0000"
                      className="h-12 font-mono rounded-xl"
                    />
                  </div>
                  <div className="flex items-end">
                    <Button
                      onClick={runEnrich}
                      disabled={loading === "enrich"}
                      className="h-12 px-6 rounded-xl font-black uppercase text-[10px] bg-black text-white"
                    >
                      {loading === "enrich" ? (
                        <Loader2 className="animate-spin mr-2" size={16} />
                      ) : (
                        <Sparkles className="mr-2" size={16} />
                      )}
                      Buscar no tribunal / DJEN
                    </Button>
                  </div>
                </div>
                {tribunalPreview && (
                  <div className="flex flex-wrap gap-2 items-center text-[10px] font-bold uppercase text-muted-foreground">
                    <Badge variant="outline">{tribunalPreview.sigla}</Badge>
                    <span>{tribunalPreview.sistema}</span>
                    {tribunalPreview.url && (
                      <a
                        href={tribunalPreview.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        <ExternalLink size={12} /> Abrir consulta pública (opcional)
                      </a>
                    )}
                  </div>
                )}
                {meta && (
                  <div className="rounded-xl border bg-secondary/30 p-4 space-y-2 text-[11px]">
                    <div className="flex flex-wrap gap-2">
                      <Badge className="bg-emerald-600 text-white uppercase text-[8px]">
                        <CheckCircle2 size={10} className="mr-1" /> {meta.fonte || "OK"}
                      </Badge>
                      {typeof meta.djenCount === "number" && (
                        <Badge variant="outline" className="uppercase text-[8px]">
                          DJEN {meta.djenCount}
                        </Badge>
                      )}
                    </div>
                    {meta.movimentosResumo && (
                      <p>
                        <span className="font-black uppercase text-muted-foreground">Últimos andamentos: </span>
                        {meta.movimentosResumo}
                      </p>
                    )}
                    {meta.djenResumo && (
                      <p>
                        <span className="font-black uppercase text-muted-foreground">DJEN: </span>
                        {meta.djenResumo}
                      </p>
                    )}
                    {(meta.poloAtivo?.length || meta.poloPassivo?.length) ? (
                      <p>
                        <span className="font-black uppercase text-muted-foreground">Polos: </span>
                        Ativo: {(meta.poloAtivo || []).join(", ") || "—"} · Passivo:{" "}
                        {(meta.poloPassivo || []).join(", ") || "—"}
                      </p>
                    ) : null}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Cliente */}
            <Card className="border-2 border-black/10">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-black uppercase flex items-center gap-2">
                  <User size={16} className="text-primary" /> Cliente (polo ativo)
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2 space-y-2">
                  <Label className="text-[10px] font-black uppercase">Nome completo *</Label>
                  <Input
                    value={form.cliente}
                    onChange={(e) => setField("cliente", e.target.value.toUpperCase())}
                    className="h-11 rounded-xl font-black uppercase text-xs"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase">CPF</Label>
                  <Input
                    value={form.cpf}
                    onChange={(e) => setField("cpf", e.target.value)}
                    className="h-11 rounded-xl font-mono text-xs"
                    placeholder="000.000.000-00"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase">E-mail</Label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => setField("email", e.target.value)}
                    className="h-11 rounded-xl text-xs"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase">Telefone</Label>
                  <Input
                    value={form.telefone}
                    onChange={(e) => setField("telefone", e.target.value)}
                    className="h-11 rounded-xl font-mono text-xs"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase">Estado civil</Label>
                  <Select
                    value={form.estado_civil || "nao_informado"}
                    onValueChange={(v) => setField("estado_civil", v === "nao_informado" ? "" : v)}
                  >
                    <SelectTrigger className="h-11 rounded-xl font-bold uppercase text-xs">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nao_informado">Não informado</SelectItem>
                      <SelectItem value="SOLTEIRO(A)">Solteiro(a)</SelectItem>
                      <SelectItem value="CASADO(A)">Casado(a)</SelectItem>
                      <SelectItem value="UNIÃO ESTÁVEL">União estável</SelectItem>
                      <SelectItem value="DIVORCIADO(A)">Divorciado(a)</SelectItem>
                      <SelectItem value="VIÚVO(A)">Viúvo(a)</SelectItem>
                      <SelectItem value="SEPARADO(A)">Separado(a)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase">Emprego / profissão</Label>
                  <Input
                    value={form.emprego}
                    onChange={(e) => setField("emprego", e.target.value.toUpperCase())}
                    className="h-11 rounded-xl font-bold uppercase text-xs"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase">Nacionalidade</Label>
                  <Input
                    value={form.nacionalidade}
                    onChange={(e) => setField("nacionalidade", e.target.value.toUpperCase())}
                    className="h-11 rounded-xl font-bold uppercase text-xs"
                    placeholder="BRASILEIRA"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Parte passiva + processo */}
            <Card className="border-2 border-black/10">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-black uppercase flex items-center gap-2">
                  <Building2 size={16} className="text-primary" /> Parte passiva e ação
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2 space-y-2">
                  <Label className="text-[10px] font-black uppercase">Parte passiva (banco / réu)</Label>
                  <Input
                    value={form.parte_passiva}
                    onChange={(e) => setField("parte_passiva", e.target.value.toUpperCase())}
                    className="h-11 rounded-xl font-bold uppercase text-xs"
                    placeholder="Ex.: BANCO ITAÚ UNIBANCO S.A."
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase">CNPJ parte passiva</Label>
                  <Input
                    value={form.parte_passiva_cnpj}
                    onChange={(e) => setField("parte_passiva_cnpj", e.target.value)}
                    className="h-11 rounded-xl font-mono text-xs"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase">Classe / tipo da ação</Label>
                  <Input
                    value={form.classe_acao}
                    onChange={(e) => setField("classe_acao", e.target.value.toUpperCase())}
                    className="h-11 rounded-xl font-bold uppercase text-xs"
                    placeholder="PROCEDIMENTO COMUM CÍVEL"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase">Tribunal</Label>
                  <Input
                    value={form.tribunal}
                    onChange={(e) => setField("tribunal", e.target.value.toUpperCase())}
                    className="h-11 rounded-xl font-bold uppercase text-xs"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase">Órgão julgador</Label>
                  <Input
                    value={form.orgao_julgador}
                    onChange={(e) => setField("orgao_julgador", e.target.value.toUpperCase())}
                    className="h-11 rounded-xl font-bold uppercase text-xs"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase">Advogado responsável</Label>
                  <Input
                    value={form.advogado}
                    onChange={(e) => setField("advogado", e.target.value.toUpperCase())}
                    className="h-11 rounded-xl font-bold uppercase text-xs"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase">Escritório</Label>
                  <Input
                    value={form.escritorio}
                    onChange={(e) => setField("escritorio", e.target.value.toUpperCase())}
                    className="h-11 rounded-xl font-bold uppercase text-xs"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase">Situação</Label>
                  <Select value={form.situacao} onValueChange={(v) => setField("situacao", v)}>
                    <SelectTrigger className="h-11 rounded-xl font-bold uppercase text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EM ANDAMENTO">EM ANDAMENTO</SelectItem>
                      <SelectItem value="ENCERRADO">ENCERRADO</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase">Próximo prazo</Label>
                  <Input
                    value={form.proximoPrazo}
                    onChange={(e) => setField("proximoPrazo", e.target.value)}
                    className="h-11 rounded-xl text-xs"
                    placeholder="dd/mm/aaaa"
                  />
                </div>
                <div className="sm:col-span-2 space-y-2">
                  <Label className="text-[10px] font-black uppercase">Observações</Label>
                  <Textarea
                    value={form.observacao}
                    onChange={(e) => setField("observacao", e.target.value.toUpperCase())}
                    className="min-h-[100px] rounded-xl font-bold uppercase text-xs resize-none"
                  />
                </div>
              </CardContent>
            </Card>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={runSave}
                disabled={!!loading}
                className="h-14 flex-1 rounded-xl font-black uppercase text-[11px] bg-black text-white shadow-xl"
              >
                {loading === "save" ? (
                  <Loader2 className="animate-spin mr-2" />
                ) : (
                  <CheckCircle2 className="mr-2" size={18} />
                )}
                Salvar na carteira (Processos)
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-14 rounded-xl font-black uppercase text-[10px]"
                onClick={() => {
                  setForm(emptyForm());
                  setMeta(null);
                }}
              >
                Limpar
              </Button>
            </div>
          </div>
        )}

        {tab === "custas" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-black uppercase flex items-center gap-2">
                <Receipt size={16} /> Portal de custas TJSP
              </CardTitle>
              <CardDescription>
                Atalho para o portal oficial. O app não calcula custas automaticamente.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase">CNJ (referência)</Label>
                  <Input value={custasCnj} onChange={(e) => setCustasCnj(e.target.value)} className="h-11 rounded-xl font-mono" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase">CPF (referência)</Label>
                  <Input value={custasCpf} onChange={(e) => setCustasCpf(e.target.value)} className="h-11 rounded-xl font-mono" />
                </div>
              </div>
              <Button asChild className="rounded-xl font-black uppercase text-[10px]">
                <a href={custasUrl} target="_blank" rel="noreferrer">
                  <ExternalLink size={14} className="mr-2" /> Abrir portal de custas
                </a>
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
