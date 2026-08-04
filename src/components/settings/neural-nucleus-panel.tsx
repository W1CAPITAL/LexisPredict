/**
 * Painel Núcleo Neural — colar em Settings.
 */
"use client";

import React, { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { getNeuralNucleusStatusAction } from "@/app/actions/neural-nucleus-actions";
import { Bot, KeyRound, Cloud } from "lucide-react";

export function NeuralNucleusPanel() {
  const [engines, setEngines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getNeuralNucleusStatusAction()
      .then((r) => setEngines(r.engines || []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Bot size={18} />
          Núcleo Neural
        </CardTitle>
        <CardDescription>
          Motores disponíveis no app (Settings, Sugerir resposta, Chat, OCR).
          Oficiais usam chaves do Vercel; Lexis não precisa de API; Puter é fallback user-pays.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading && (
          <p className="text-sm text-muted-foreground">Carregando catálogo…</p>
        )}
        {engines.map((e) => (
          <div
            key={e.id}
            className="flex flex-wrap items-center justify-between gap-2 border rounded-xl p-3"
          >
            <div>
              <p className="text-sm font-bold">{e.label}</p>
              <p className="text-[11px] text-muted-foreground">
                {e.provider}
                {e.defaultModel ? ` · ${e.defaultModel}` : ""}
                {e.puterModel ? ` · ${e.puterModel}` : ""}
              </p>
              {e.notes && (
                <p className="text-[10px] text-muted-foreground mt-1 max-w-xl">
                  {e.notes}
                </p>
              )}
              {e.envKeys?.length > 0 && (
                <p className="text-[10px] font-mono opacity-60 mt-1">
                  Env: {e.envKeys.join(" | ")}
                </p>
              )}
            </div>
            <div className="flex gap-2 items-center">
              <Badge variant="outline" className="text-[9px] uppercase">
                {e.kind}
              </Badge>
              {e.configured ? (
                <Badge className="bg-emerald-600 text-white text-[9px] gap-1">
                  <KeyRound size={10} /> OK
                </Badge>
              ) : (
                <Badge variant="destructive" className="text-[9px]">
                  Sem chave
                </Badge>
              )}
              {e.kind === "puter" && (
                <Badge variant="secondary" className="text-[9px] gap-1">
                  <Cloud size={10} /> Client
                </Badge>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
