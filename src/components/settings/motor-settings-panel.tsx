"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Cpu, CheckCircle2 } from "lucide-react";
import { MOTORS, MotorId, loadPreferredMotor, savePreferredMotor } from "@/lib/ai/motors";
import { cn } from "@/lib/utils";

export function MotorSettingsPanel() {
  const [iaModel, setIaModel] = useState<MotorId>("xai");

  useEffect(() => {
    setIaModel(loadPreferredMotor());
  }, []);

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
          <Cpu size={16} /> Motor neural padrão
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground mb-4">
          Usado no Assistente IA, Sugerir Resposta (Tarefas/Processos) e rascunhos. Cascata automática
          se o motor escolhido falhar por quota.
        </p>
        <RadioGroup
          value={iaModel}
          onValueChange={(val) => {
            const id = val as MotorId;
            setIaModel(id);
            savePreferredMotor(id);
          }}
          className="grid gap-3 sm:grid-cols-2"
        >
          {MOTORS.map((m) => (
            <label
              key={m.id}
              htmlFor={`motor-${m.id}`}
              className={cn(
                "flex cursor-pointer gap-3 rounded-xl border p-3 transition-colors",
                iaModel === m.id ? "border-primary bg-primary/5" : "border-border/60 hover:bg-muted/40"
              )}
            >
              <RadioGroupItem value={m.id} id={`motor-${m.id}`} className="mt-1" />
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black uppercase">{m.label}</span>
                  <Badge variant="outline" className="text-[8px] uppercase">
                    {m.scope}
                  </Badge>
                  {iaModel === m.id && <CheckCircle2 size={12} className="text-primary" />}
                </div>
                <p className="text-[11px] text-muted-foreground leading-snug">{m.desc}</p>
                {m.envKey && (
                  <p className="text-[10px] font-mono text-muted-foreground">ENV: {m.envKey}</p>
                )}
              </div>
            </label>
          ))}
        </RadioGroup>
      </CardContent>
    </Card>
  );
}
