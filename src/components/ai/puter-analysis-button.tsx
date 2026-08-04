"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { puterChat, buildLegalSystemPrompt } from "@/lib/puter-ai-client";
import { AiDraftPreview } from "@/components/ai/ai-draft-preview";
import { isPuterEngine } from "@/lib/ai-engines-catalog";

type Props = {
  protocolo: string;
  cliente?: string;
  movimentos?: string;
  contexto?: string;
  tipo?: "scan" | "ba";
  className?: string;
};

export function PuterAnalysisButton({
  protocolo,
  cliente = "",
  movimentos = "",
  contexto = "",
  tipo = "scan",
  className,
}: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);

  const handleAnalyze = async () => {
    const preferred =
      localStorage.getItem("lexisPredict_preferred_ia") || "xai";
    const scanPuter =
      localStorage.getItem("lexisPredict_scan_puter_ai") === "1";

    if (!scanPuter || !isPuterEngine(preferred)) {
      toast({
        title: "Puter não ativo",
        description:
          "Ative “Scanner + Puter IA” e escolha um motor Puter em Configurações → Núcleo Neural.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setDraft(null);

    try {
      const prompt = `
Analise o seguinte processo judicial brasileiro e gere uma mensagem clara, direta e para leigo (WhatsApp/e-mail) para o cliente.

PROTOCOLO: ${protocolo}
CLIENTE: ${cliente || "Cliente"}
TIPO DE ANÁLISE: ${tipo === "ba" ? "Busca e Apreensão / Risco Urgente" : "Pós-scan DataJud/DJEN"}

MOVIMENTAÇÕES / TEOR:
${movimentos || "Não informado"}

OBSERVAÇÕES:
${contexto || "Nenhuma"}

Regras:
- Linguagem simples, sem juridiquês.
- Não prometa resultado nem dinheiro na conta.
- Nunca cite nomes de empresas ou escritórios.
- Se houver trânsito em julgado + documentos novos, explique que o escritório está analisando.
- Se for busca e apreensão, seja urgente mas calmo.
- Mostre que a equipe está trabalhando.
- Finalize oferecendo disponibilidade para dúvidas.
`.trim();

      const res = await puterChat({
        prompt,
        model: preferred,
        system: buildLegalSystemPrompt(),
      });

      if (!res.success || !res.text) {
        toast({
          title: "Falha na análise Puter",
          description: res.error || "Tente novamente",
          variant: "destructive",
        });
        return;
      }

      setDraft(res.text);
      toast({ title: "Análise Puter gerada" });
    } catch (err: any) {
      toast({
        title: "Erro",
        description: err?.message || "Falha inesperada",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={className}>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={handleAnalyze}
        disabled={loading}
        className="gap-2"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Sparkles className="h-4 w-4" />
        )}
        {tipo === "ba" ? "Analisar BA (Puter)" : "Analisar Scan (Puter)"}
      </Button>

      {draft && (
        <div className="mt-4">
          <AiDraftPreview text={draft} title="Rascunho Puter (zero-token)" />
        </div>
      )}
    </div>
  );
}
