"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Zap, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AI_ENGINES, type AiEngine } from "@/lib/ai-engines-catalog";
import { cn } from "@/lib/utils";

function EngineOption({
  engine,
  selected,
}: {
  engine: AiEngine;
  selected: boolean;
}) {
  const statusColor =
    engine.status === "ONLINE"
      ? "bg-emerald-500/10 text-emerald-500"
      : engine.status === "ZERO-TOKEN"
      ? "bg-sky-500/10 text-sky-500"
      : engine.status === "SEMPRE"
      ? "bg-violet-500/10 text-violet-500"
      : "bg-amber-500/10 text-amber-600";

  return (
    <label
      htmlFor={engine.id}
      className={cn(
        "flex items-center justify-between p-5 border rounded-lg transition-all cursor-pointer group",
        selected
          ? "border-primary bg-primary/5"
          : "border-border hover:border-primary/40 bg-background/20"
      )}
    >
      <div className="flex items-center gap-4">
        <RadioGroupItem value={engine.id} id={engine.id} />
        <div className="text-left">
          <p className="font-black text-[11px] uppercase tracking-widest text-foreground group-hover:text-primary transition-colors">
            {engine.label}
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">{engine.desc}</p>
        </div>
      </div>
      <Badge className={cn("border-none text-[8px] font-black uppercase px-2 py-0.5", statusColor)}>
        {engine.status}
      </Badge>
    </label>
  );
}

type Props = {
  isAdmin: boolean;
};

export function NeuralEnginePanel({ isAdmin }: Props) {
  const { toast } = useToast();
  const [iaModel, setIaModel] = useState("xai");
  const [scanWithFreeAi, setScanWithFreeAi] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("lexisPredict_preferred_ia") || "xai";
    setIaModel(saved);
    setScanWithFreeAi(localStorage.getItem("lexisPredict_scan_puter_ai") === "1");
  }, []);

  const handleChangeModel = (val: string) => {
    if (!isAdmin) {
      toast({
        title: "Acesso Negado",
        description: "Apenas administradores alteram o motor neural.",
        variant: "destructive",
      });
      return;
    }
    setIaModel(val);
    localStorage.setItem("lexisPredict_preferred_ia", val);
    toast({ title: "Prioridade Alterada", description: val });
  };

  const oficiais = AI_ENGINES.filter((e) => e.group === "oficial" || e.group === "local");
  const puters = AI_ENGINES.filter((e) => e.group === "puter");

  return (
    <Card className="bg-background/40 backdrop-blur-xl border border-border rounded-lg shadow-2xl overflow-hidden">
      <CardHeader className="border-b border-border bg-background/50">
        <CardTitle className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
          <Zap size={14} className="text-primary" /> Neural Infrastructure
        </CardTitle>
      </CardHeader>

      <CardContent className="p-8 space-y-8">
        {/* Aviso de sigilo */}
        <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-start gap-4">
          <ShieldCheck className="text-amber-500 mt-1 shrink-0" size={18} />
          <div>
            <p className="text-[10px] font-black uppercase text-amber-700">
              Protocolo de Sigilo Ativo
            </p>
            <p className="text-[9px] font-bold text-amber-600/80 uppercase leading-relaxed mt-1">
              As IAs estão instruídas a nunca citar nomes de empresas. Todo despacho é gerado em tom institucional neutro.
            </p>
          </div>
        </div>

        {/* Motores oficiais */}
        <div className="space-y-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            Motores Oficiais (tokens no Vercel)
          </p>
          <RadioGroup value={iaModel} onValueChange={handleChangeModel}>
            <div className="grid gap-3">
              {oficiais.map((engine) => (
                <EngineOption
                  key={engine.id}
                  engine={engine}
                  selected={iaModel === engine.id}
                />
              ))}
            </div>
          </RadioGroup>
        </div>

        {/* Motores Puter (zero-token) */}
        <div className="space-y-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            Zero-Token no Servidor (Puter no browser)
          </p>
          <RadioGroup value={iaModel} onValueChange={handleChangeModel}>
            <div className="grid gap-3">
              {puters.map((engine) => (
                <EngineOption
                  key={engine.id}
                  engine={engine}
                  selected={iaModel === engine.id}
                />
              ))}
            </div>
          </RadioGroup>
        </div>

        {/* Scanner + Puter */}
        <div className="p-5 border border-border rounded-lg space-y-3">
          <p className="text-[10px] font-black uppercase tracking-widest">
            Scanner tribunal + IA sem seus tokens
          </p>
          <p className="text-[10px] text-muted-foreground">
            Pós-scan DataJud/DJEN: interpretação/rascunho via Puter (Claude/Grok),
            sem chamar XAI/GROQ/Gemini do Vercel. Scripts Lexis seguem 1ª linha.
          </p>
          <label className="flex items-center justify-between gap-4 cursor-pointer">
            <span className="text-[11px] font-bold uppercase">
              Ativar análise pós-scan via Puter
            </span>
            <input
              type="checkbox"
              className="h-5 w-5 accent-primary"
              checked={scanWithFreeAi}
              onChange={(e) => {
                if (!isAdmin) {
                  toast({ title: "Acesso Negado", variant: "destructive" });
                  return;
                }
                const on = e.target.checked;
                setScanWithFreeAi(on);
                localStorage.setItem("lexisPredict_scan_puter_ai", on ? "1" : "0");
                toast({
                  title: on ? "Scanner + Puter IA ativo" : "Scanner + Puter IA off",
                });
              }}
            />
          </label>
        </div>
      </CardContent>
    </Card>
  );
}
