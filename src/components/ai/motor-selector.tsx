"use client";

import React, { useEffect, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Cpu } from "lucide-react";
import {
  MOTORS,
  MotorId,
  loadPreferredMotor,
  savePreferredMotor,
  getMotor,
} from "@/lib/ai/motors";
import { cn } from "@/lib/utils";

export function MotorSelector({
  value,
  onChange,
  className,
  compact,
  allowPuter = true,
}: {
  value?: string;
  onChange?: (id: MotorId) => void;
  className?: string;
  compact?: boolean;
  allowPuter?: boolean;
}) {
  const [internal, setInternal] = useState<MotorId>("omni");

  useEffect(() => {
    const v = (value as MotorId) || loadPreferredMotor();
    setInternal(v);
  }, [value]);

  useEffect(() => {
    const h = (e: Event) => {
      const d = (e as CustomEvent).detail as MotorId;
      if (d) setInternal(d);
    };
    window.addEventListener("lexis-motor-change", h);
    return () => window.removeEventListener("lexis-motor-change", h);
  }, []);

  const set = (id: string) => {
    const mid = id as MotorId;
    setInternal(mid);
    savePreferredMotor(mid);
    onChange?.(mid);
  };

  const list = MOTORS.filter((m) => allowPuter || m.id !== "puter");

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {!compact && (
        <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1">
          <Cpu size={12} /> Motor
        </span>
      )}
      <Select value={internal} onValueChange={set}>
        <SelectTrigger
          className={cn(
            "h-9 rounded-xl border-border/60 bg-background/80 font-bold text-[10px] uppercase tracking-wide",
            compact ? "w-[140px]" : "w-[240px]"
          )}
        >
          <SelectValue placeholder="Motor" />
        </SelectTrigger>
        <SelectContent className="rounded-xl max-h-[320px]">
          {list.map((m) => (
            <SelectItem key={m.id} value={m.id} className="text-xs">
              <div className="flex flex-col gap-0.5 py-0.5">
                <span className="font-bold">{m.label}</span>
                <span className="text-[10px] text-muted-foreground font-normal normal-case">
                  {m.desc}
                </span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Badge variant="outline" className="text-[8px] font-black uppercase hidden sm:inline-flex">
        {getMotor(internal).scope}
      </Badge>
    </div>
  );
}
