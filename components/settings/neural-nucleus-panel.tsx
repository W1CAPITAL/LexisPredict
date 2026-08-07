"use client";

/**
 * Settings → Núcleo Neural
 * - Lista TODOS os motores (oficial / Lexis / Puter)
 * - Seletor de motor preferido
 * - Opção: Claude + DJEN identifica Busca e Apreensão
 */

import React, { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getNeuralNucleusStatusAction } from "@/app/actions/neural-nucleus-actions";
import {
  MOTORS,
  loadPreferredMotor,
  savePreferredMotor,
  loadBaClaudeDjenEnabled,
  saveBaClaudeDjenEnabled,
  type MotorId,
} from "@/lib/ai/motors";
import { Bot, KeyRound, Cloud, ShieldAlert, Sparkles } from "lucide-react";

export function NeuralNucleusPanel() {
  const [engines, setEngines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [preferred, setPreferred] = useState<MotorId>("claude");
  const [baClaude, setBaClaude] = useState(false);

  useEffect(() => {
    setPreferred(loadPreferredMotor());
    setBaClaude(loadBaClaudeDjenEnabled());
    getNeuralNucleusStatusAction()
      .then((r) => setEngines(r.engines || []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bot size={18} />
            Núcleo Neural
          </CardTitle>
          <CardDescription>
            Todos os motores disponíveis no app (Chat, Sugerir resposta, OCR, Automação).
            Claude (Anthropic) é o principal quando a chave está no Vercel.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-wider">
                Motor preferido
              </Label>
              <Select
                value={preferred}
                onValueChange={(v) => {
                  const id = v as MotorId;
                  setPreferred(id);
                  savePreferredMotor(id);
                }}
              >
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {MOTORS.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.label} · {m.scope}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">
                Cascata: se o preferido falhar (quota/auth), tenta o próximo com chave válida.
              </p>
            </div>

            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
              <div className="flex items-start gap-2">
                <ShieldAlert className="text-amber-600 shrink-0 mt-0.5" size={16} />
                <div>
                  <p className="text-sm font-bold">Claude + DJEN · Busca e Apreensão</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Opcional. Quando ativo, o Assistente e a varredura BA usam Claude para
                    confirmar se o teor do DJEN é realmente mandado de busca e apreensão
                    (além das keywords determinísticas).
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="ba-claude-djen" className="text-xs font-medium">
                  Ativar análise Claude no DJEN (BA)
                </Label>
                <Switch
                  id="ba-claude-djen"
                  checked={baClaude}
                  onCheckedChange={(on) => {
                    setBaClaude(on);
                    saveBaClaudeDjenEnabled(on);
                  }}
                />
              </div>
            </div>
          </div>

          {loading && (
            <p className="text-sm text-muted-foreground">Carregando catálogo…</p>
          )}

          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <Sparkles size={12} /> Motores no catálogo
            </p>
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
                  ) : e.kind === "official" ? (
                    <Badge variant="destructive" className="text-[9px] gap-1">
                      <Cloud size={10} /> Sem key
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-[9px]">
                      Client
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>

          <p className="text-[10px] text-muted-foreground border-t pt-3">
            Vercel (produção): ANTHROPIC_API_KEY, ANTHROPIC_MODEL=claude-sonnet-4-20250514,
            e demais chaves conforme a lista acima. Nunca grave keys no GitHub.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
