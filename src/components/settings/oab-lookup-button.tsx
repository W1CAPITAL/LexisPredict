"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Search, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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

  const cnaUrl = () => {
    const n = String(numero || "").replace(/\D/g, "");
    const u = String(uf || "").toUpperCase();
    return `https://cna.oab.org.br/?uf=${encodeURIComponent(u)}&nroOab=${encodeURIComponent(n)}`;
  };

  const run = async () => {
    if (!uf || !String(numero || "").replace(/\D/g, "")) {
      toast({ title: "Informe UF e número da OAB", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { consultarOabAction } = await import("@/app/actions/oab-actions");
      const res = await consultarOabAction(uf, numero);
      if (!res) {
        toast({
          title: "Consulta OAB indisponível",
          description: "Resposta vazia. Abrindo CNA oficial.",
          variant: "destructive",
        });
        window.open(cnaUrl(), "_blank", "noopener,noreferrer");
        return;
      }
      if (res.success && res.nome) {
        onFound?.({ nome: res.nome, situacao: res.situacao, consultaUrl: res.consultaUrl });
        toast({ title: "OAB encontrada", description: res.nome });
      } else {
        onFound?.({ consultaUrl: res.consultaUrl || cnaUrl() });
        toast({
          title: "Não foi possível preencher automaticamente",
          description: res.error || "Abra o CNA e confira o cadastro.",
        });
        window.open(res.consultaUrl || cnaUrl(), "_blank", "noopener,noreferrer");
      }
    } catch (e: any) {
      toast({
        title: "Erro na consulta OAB",
        description: e?.message || "Falha de rede ou action ausente no deploy.",
        variant: "destructive",
      });
      try {
        window.open(cnaUrl(), "_blank", "noopener,noreferrer");
      } catch {
        /* */
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex gap-1">
      <Button type="button" variant="outline" size="sm" className="h-10 rounded-xl text-[9px] font-black uppercase gap-1" onClick={run} disabled={loading}>
        {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
        OAB
      </Button>
      <Button type="button" variant="ghost" size="icon" className="h-10 w-10 rounded-xl" title="CNA" onClick={() => window.open(cnaUrl(), "_blank", "noopener,noreferrer")}>
        <ExternalLink size={14} />
      </Button>
    </div>
  );
}
