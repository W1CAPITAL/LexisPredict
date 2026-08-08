"use client";

/**
 * D3 — Modelos & Peças: biblioteca reutilizável de procurações, habilitações,
 * substabelecimentos, revogações, petições e cartas a bancos.
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 */

import React, { useMemo, useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { ScrollText, Loader2, Copy, FileText, Library, Download } from "lucide-react";
import { gerarPecaTextoPDFAction } from "@/app/actions/document-actions";
import { downloadBase64File } from "@/lib/download-export";
import {
  MODELOS_DE_PECAS,
  CATEGORIAS,
  BANCOS_COBERTOS,
  renderModelo,
  type PecaMeta,
  type ModeloPeca,
  type CategoriaPeca,
} from "@/lib/pecas-modelos";

const CAMPOS_LABEL: Record<keyof PecaMeta, string> = {
  protocolo: "Processo / Contrato nº",
  cliente: "Cliente",
  cpfCliente: "CPF do cliente",
  rgCliente: "RG do cliente",
  enderecoCliente: "Endereço do cliente",
  banco: "Banco / Instituição",
  cnpjBanco: "CNPJ do banco",
  advogado: "Advogado",
  advogadoPassivo: "Advogado da parte contrária",
  oab: "Nº OAB",
  uf: "UF",
  tribunal: "Tribunal",
  comarca: "Comarca",
  orgao: "Órgão julgador",
  classeAcao: "Classe da ação",
  resumo: "Resumo / fundamentos",
  substabDe: "Advogado cedente",
  substabDeOab: "OAB do cedente",
  substabPara: "Advogado substabelecido",
  substabParaOab: "OAB do substabelecido",
  tipoAcao: "Tipo de ação",
  data: "Data",
  valorContrato: "Valor do contrato / saldo",
  valorProposta: "Valor da proposta",
  protocoloProcon: "Protocolo PROCON",
  cidade: "Cidade",
};

export default function ModelosPage() {
  const { profile, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [categoria, setCategoria] = useState<CategoriaPeca | "Todas">("Todas");
  const [selected, setSelected] = useState<ModeloPeca | null>(null);
  const [meta, setMeta] = useState<PecaMeta>({});
  const [preview, setPreview] = useState("");
  const [pdfLoading, setPdfLoading] = useState(false);

  const modelos = useMemo(
    () =>
      categoria === "Todas"
        ? MODELOS_DE_PECAS
        : MODELOS_DE_PECAS.filter((m) => m.categoria === categoria),
    [categoria]
  );

  const selectModelo = (m: ModeloPeca) => {
    setSelected(m);
    setMeta({});
    setPreview("");
  };

  const atualizarMeta = (k: keyof PecaMeta, v: string) => {
    setMeta((prev) => {
      const next = { ...prev, [k]: v };
      if (selected) setPreview(renderModelo(selected.id, next) || "");
      return next;
    });
  };

  const gerar = () => {
    if (!selected) return;
    setPreview(renderModelo(selected.id, meta) || "");
    toast({ title: "Modelo gerado", description: selected.titulo });
  };

  const copy = async () => {
    if (!preview) return;
    try {
      await navigator.clipboard.writeText(preview);
      toast({ title: "Copiado", description: "Texto copiado para a área de transferência." });
    } catch {
      toast({ title: "Não foi possível copiar", variant: "destructive" });
    }
  };

  const gerarPDF = async () => {
    if (!preview || !selected) return;
    setPdfLoading(true);
    try {
      // Bloqueia PDF com dados claramente inválidos (ex.: "a", "aa")
      const required = (selected.campos || []).filter((c) =>
        ["cliente", "advogado", "oab", "substabDe", "substabPara"].includes(c)
      );
      for (const key of required) {
        const v = String((meta as any)[key] || "").trim();
        if (v.length > 0 && v.length < 3) {
          toast({
            title: "Dados incompletos",
            description: `O campo "${key}" precisa de pelo menos 3 caracteres (não use placeholders).`,
            variant: "destructive",
          });
          setPdfLoading(false);
          return;
        }
      }
      if (!preview || preview.trim().length < 40) {
        toast({
          title: "Prévia vazia",
          description: "Preencha os campos e gere a prévia antes do PDF.",
          variant: "destructive",
        });
        setPdfLoading(false);
        return;
      }
      const res = await gerarPecaTextoPDFAction({ texto: preview, titulo: selected.titulo });
      if (!res?.success) throw new Error(res?.error || "Falha ao gerar PDF.");
      downloadBase64File(
        res.base64,
        `peca-${selected.id}.pdf`,
        "application/pdf"
      );
      toast({ title: "PDF gerado", description: "Peça baixada em PDF." });
    } catch (e: any) {
      toast({ title: "Erro", description: e?.message || "Falha ao gerar PDF.", variant: "destructive" });
    } finally {
      setPdfLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  if (!profile) {
    return (
      <div className="min-h-screen p-6 flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Faça login para acessar.</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <main className="flex-1 min-h-0 overflow-y-auto">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 space-y-6">
            <div>
              <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
                <Library className="h-6 w-6 text-primary" /> Modelos & Peças
              </h1>
              <p className="text-xs text-muted-foreground">
                {MODELOS_DE_PECAS.length} modelos reutilizáveis · {BANCOS_COBERTOS.length} instituições financeiras cobertas
              </p>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {(["Todas", ...CATEGORIAS] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategoria(c)}
                  className={cn(
                    "rounded-lg border px-2.5 py-1.5 text-[9px] font-black uppercase tracking-widest transition-all",
                    categoria === c
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground hover:border-primary/50"
                  )}
                >
                  {c}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {modelos.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => selectModelo(m)}
                  className={cn(
                    "text-left rounded-xl border p-3 transition-all shadow-sm",
                    selected?.id === m.id
                      ? "border-primary bg-primary/5"
                      : "border-border bg-card hover:border-primary/40"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary shrink-0" />
                    <p className="text-[11px] font-bold leading-tight">{m.titulo}</p>
                  </div>
                  <p className="mt-1 text-[10px] text-muted-foreground line-clamp-2">{m.descricao}</p>
                </button>
              ))}
            </div>

            {selected && (
              <Card className="border-primary/30">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <ScrollText className="h-4 w-4 text-primary" /> {selected.titulo}
                    <Badge variant="outline" className="ml-auto text-[9px] uppercase">{selected.categoria}</Badge>
                  </CardTitle>
                  <CardDescription className="text-xs">{selected.descricao}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {selected.campos.map((k) => (
                      <div key={k} className="space-y-1.5">
                        <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                          {CAMPOS_LABEL[k]}
                        </Label>
                        {k === "banco" ? (
                          <select
                            value={meta.banco || ""}
                            onChange={(e) => atualizarMeta("banco", e.target.value)}
                            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                          >
                            <option value="">Selecione…</option>
                            {BANCOS_COBERTOS.map((b) => (
                              <option key={b} value={b}>{b}</option>
                            ))}
                          </select>
                        ) : k === "resumo" ? (
                          <Textarea rows={2} value={meta.resumo || ""} onChange={(e) => atualizarMeta("resumo", e.target.value)} placeholder="Observações / fundamentos" />
                        ) : (
                          <Input value={meta[k] || ""} onChange={(e) => atualizarMeta(k, e.target.value)} placeholder={CAMPOS_LABEL[k]} />
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    <Button size="sm" onClick={gerar}>
                      <ScrollText className="mr-1.5 h-4 w-4" /> Gerar texto
                    </Button>
                    {preview && (
                      <Button size="sm" variant="outline" onClick={copy}>
                        <Copy className="mr-1.5 h-4 w-4" /> Copiar
                      </Button>
                    )}
                    {preview && (
                      <Button size="sm" onClick={gerarPDF} disabled={pdfLoading}>
                        {pdfLoading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Download className="mr-1.5 h-4 w-4" />} Baixar PDF
                      </Button>
                    )}
                  </div>

                  {preview && (
                    <Textarea readOnly value={preview} rows={18} className="font-serif text-xs leading-relaxed whitespace-pre-wrap" />
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
