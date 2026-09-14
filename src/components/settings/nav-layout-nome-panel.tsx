"use client";

import React, { useEffect, useState } from "react";
import { loadNavLayout, saveNavLayout, type NavLayoutMode } from "@/lib/nav-layout";
import { atualizarNomeUsuarioAction } from "@/app/actions/ranking-atendimento-actions";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { PanelLeft, PanelBottom, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function NavLayoutNomePanel() {
  const { profile, refreshProfile } = useAuth() as any;
  const { toast } = useToast();
  const [mode, setMode] = useState<NavLayoutMode>("dock");
  const [nome, setNome] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setMode(loadNavLayout());
    setNome(String(profile?.nome || ""));
  }, [profile?.nome]);

  const applyMode = (m: NavLayoutMode) => {
    setMode(m);
    saveNavLayout(m);
    toast({
      title: m === "vertical" ? "Menu vertical" : "Dock horizontal",
      description: "Layout aplicado. Recarregue se alguma página não atualizar.",
    });
  };

  const saveNome = async () => {
    setBusy(true);
    try {
      const r = await atualizarNomeUsuarioAction(nome);
      if (!r.success) {
        toast({ title: "Erro", description: r.message, variant: "destructive" });
        return;
      }
      toast({ title: "Nome atualizado", description: r.nome });
      try {
        await refreshProfile?.();
      } catch {
        /* */
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border/60 bg-card/50 backdrop-blur p-4 space-y-4">
      <div className="space-y-2">
        <Label className="text-[10px] font-black uppercase">Posição do menu</Label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => applyMode("dock")}
            className={cn(
              "flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-medium",
              mode === "dock" ? "border-primary bg-primary/10" : "hover:bg-muted"
            )}
          >
            <PanelBottom size={16} /> Horizontal
          </button>
          <button
            type="button"
            onClick={() => applyMode("vertical")}
            className={cn(
              "flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-medium",
              mode === "vertical" ? "border-primary bg-primary/10" : "hover:bg-muted"
            )}
          >
            <PanelLeft size={16} /> Vertical
          </button>
        </div>
        <p className="text-xs text-muted-foreground">Horizontal libera a tela para a carteira. Vertical lista todas as áreas na esquerda.</p>
      </div>
      <div className="space-y-2">
        <Label className="text-[10px] font-black uppercase">Nome completo (aparece no Hall de Prêmios)</Label>
        <Input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="NOME COMPLETO"
          className="uppercase"
        />
        <Button type="button" onClick={() => void saveNome()} disabled={busy} className="gap-2">
          {busy ? <Loader2 className="animate-spin" size={14} /> : null}
          Salvar nome
        </Button>
      </div>
    </div>
  );
}
