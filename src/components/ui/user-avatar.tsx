"use client";

import React, { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type Props = {
  name?: string | null;
  src?: string | null;
  className?: string;
  size?: "sm" | "md" | "lg";
  /** Clique amplia a foto (padrão: true se houver src) */
  enlargeable?: boolean;
};

function initials(name?: string | null) {
  const parts = String(name || "?")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const sizeCls = {
  sm: "h-7 w-7 text-[9px]",
  md: "h-9 w-9 text-[10px]",
  lg: "h-11 w-11 text-xs",
};

/**
 * Foto de perfil com fallback de iniciais.
 * Clique (quando há foto) abre visualização ampliada.
 */
export function UserAvatar({ name, src, className, size = "md", enlargeable }: Props) {
  const [open, setOpen] = useState(false);
  const canEnlarge = enlargeable !== false && !!src;

  return (
    <>
      <button
        type="button"
        className={cn(
          "inline-flex rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
          canEnlarge ? "cursor-zoom-in" : "cursor-default"
        )}
        onClick={(e) => {
          e.stopPropagation();
          if (canEnlarge) setOpen(true);
        }}
        title={canEnlarge ? "Ampliar foto" : name || undefined}
        aria-label={name || "Avatar"}
      >
        <Avatar className={cn(sizeCls[size], "shrink-0 rounded-xl border border-border/50", className)}>
          {src ? <AvatarImage src={src} alt={name || "Usuário"} className="object-cover" /> : null}
          <AvatarFallback className="rounded-xl bg-primary/10 text-primary font-bold uppercase">
            {initials(name)}
          </AvatarFallback>
        </Avatar>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm p-4 rounded-2xl">
          <DialogTitle className="text-sm font-semibold truncate">{name || "Foto"}</DialogTitle>
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt={name || "Foto de perfil"}
              className="w-full max-h-[70vh] object-contain rounded-xl bg-muted"
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
