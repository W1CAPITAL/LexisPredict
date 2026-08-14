
"use client";

import React, { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Delete, Eraser } from "lucide-react";
import { cn } from "@/lib/utils";

type Mode = "digits" | "oab" | "cnj";

/**
 * Numpad jurídico — entrada touch de OAB / CNJ / dígitos.
 * Não é motor de investigação; só input.
 */
export function JudicialNumpad({
  value,
  onChange,
  mode = "digits",
  className,
  maxLength,
}: {
  value: string;
  onChange: (v: string) => void;
  mode?: Mode;
  className?: string;
  maxLength?: number;
}) {
  const max =
    maxLength ??
    (mode === "cnj" ? 20 : mode === "oab" ? 7 : 32);

  const push = useCallback(
    (ch: string) => {
      const digits = String(value || "").replace(/\D/g, "");
      if (digits.length >= max) return;
      onChange(digits + ch);
    },
    [value, onChange, max]
  );

  const back = () => {
    const digits = String(value || "").replace(/\D/g, "");
    onChange(digits.slice(0, -1));
  };

  const clear = () => onChange("");

  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "limpar", "0", "apagar"];

  return (
    <div className={cn("grid grid-cols-3 gap-2 max-w-[240px]", className)}>
      {keys.map((k) => {
        if (k === "limpar") {
          return (
            <Button
              key={k}
              type="button"
              variant="outline"
              className="h-11 rounded-xl text-[10px] font-semibold"
              onClick={clear}
            >
              <Eraser size={14} className="mr-1" />
              Limpar
            </Button>
          );
        }
        if (k === "apagar") {
          return (
            <Button
              key={k}
              type="button"
              variant="outline"
              className="h-11 rounded-xl"
              onClick={back}
            >
              <Delete size={16} />
            </Button>
          );
        }
        return (
          <Button
            key={k}
            type="button"
            variant="secondary"
            className="h-11 rounded-xl text-lg font-semibold tabular-nums"
            onClick={() => push(k)}
          >
            {k}
          </Button>
        );
      })}
    </div>
  );
}
