"use client";

import React, { useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { auditContractAction } from "@/app/actions/ai-audit-actions";
import { FileSearch, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function AuditoriaContratoPage() {
  const { toast } = useToast();
  const [text, setText] = useState("");
  const [contractType, setContractType] = useState("financiamento");
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState("");

  const run = async () => {
    setLoading(true);
    setReport("");
    try {
      const res = await auditContractAction({ text, contractType, focus: "completo" });
      if (!res.success) {
        toast({ title: "Auditoria falhou", description: res.error || res.content, variant: "destructive" });
        return;
      }
      setReport(res.content);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-auto p-4 sm:p-8">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center">
              <FileSearch className="text-primary" size={20} />
            </div>
            <div>
              <h1 className="text-lg font-black uppercase tracking-tight">Auditoria de contrato</h1>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Cláusulas · CDC · SWOT · ações para assessoria
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase">Tipo</Label>
            <Input
              value={contractType}
              onChange={(e) => setContractType(e.target.value)}
              className="rounded-xl h-10"
              placeholder="financiamento, consignado, cartão…"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase">Texto do contrato / cláusulas</Label>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="min-h-[200px] rounded-xl font-mono text-[12px]"
              placeholder="Cole aqui trechos do contrato, CCB, aditivo…"
            />
          </div>

          <Button
            onClick={run}
            disabled={loading || text.trim().length < 40}
            className="h-11 rounded-xl font-black uppercase text-[10px] tracking-widest"
          >
            {loading ? <Loader2 className="animate-spin mr-2" size={16} /> : <FileSearch className="mr-2" size={16} />}
            Rodar auditoria
          </Button>

          {report ? (
            <pre
              className={cn(
                "whitespace-pre-wrap rounded-2xl border border-border/50 bg-card p-4 sm:p-6",
                "text-[12px] leading-relaxed font-sans"
              )}
            >
              {report}
            </pre>
          ) : null}
        </div>
      </main>
    </div>
  );
}
