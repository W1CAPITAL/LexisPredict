"use client";

import React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

type Props = {
  name?: string | null;
  src?: string | null;
  className?: string;
  size?: "sm" | "md" | "lg";
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
 * Usa avatar_url do usuário quando existir.
 */
export function UserAvatar({ name, src, className, size = "md" }: Props) {
  return (
    <Avatar className={cn(sizeCls[size], "shrink-0 rounded-xl border border-border/50", className)}>
      {src ? <AvatarImage src={src} alt={name || "Usuário"} className="object-cover" /> : null}
      <AvatarFallback className="rounded-xl bg-primary/10 text-primary font-black uppercase">
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
