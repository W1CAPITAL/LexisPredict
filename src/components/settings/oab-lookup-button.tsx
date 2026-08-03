"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Search, ExternalLink } from "lucide-react";
import { consultarOabAction } from "@/app/actions/oab-actions";
import { useToast } from "@/hooks/use-toast";
import { buildCnaSearchUrl } from "@/lib/oab-consulta";

/**
 * Botão "Consultar OAB" ao lado do número — preenche nome se CNA responder.
 */
export function OabLookupButton({
  uf,
  numero,
  onFound,
}: {
  uf: string;
  numero: string;
  onFound?: (data: { nome?: string; situacao?: string; consultaUrl: string }) => void;
}) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const run = async () => {
    if (!uf || !numero) {
      toast({ title: "Informe UF e número da OAB", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await consultarOabAction(uf, numero);
      if (res.success && res.nome) {
        onFound?.({ nome: res.nome, situacao: res.situacao, consultaUrl: res.consultaUrl });
        toast({
          title: "OAB encontrada",
          description: `${res.nome}${res.situacao ? ` · ${res.situacao}` : ""}`,
        });
      } else {
        onFound?.({ consultaUrl: res.consultaUrl });
        toast({
          title: "Consulta CNA incompleta",
          description: res.error || "Abra o link oficial e confira manualmente.",
        });
        window.open(res.consultaUrl || buildCnaSearchUrl(uf, numero), "_blank", "noopener,noreferrer");
      }
    } catch (e: any) {
      toast({ title: "Erro OAB", description: e?.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-10 rounded-xl text-[9px] font-black uppercase gap-1"
        onClick={run}
        disabled={loading}
      >
        {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
        Consultar OAB
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-10 w-10 rounded-xl"
        title="Abrir CNA"
        onClick={() =>
          window.open(buildCnaSearchUrl(uf, numero), "_blank", "noopener,noreferrer")
        }
      >
        <ExternalLink size={14} />
      </Button>
    </div>
  );
}
