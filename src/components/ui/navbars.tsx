"use client";
import React from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

export function VerticalNav({ children, title = "Equipe" }: { children: React.ReactNode; title?: string }) {
  return (
    <ScrollArea className="h-full py-2">
      <div className="px-2 py-1">
        <h2 className="mb-2 px-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">{title}</h2>
        <div className="space-y-1">{children}</div>
      </div>
    </ScrollArea>
  );
}

export function VerticalNavItem(props: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  const { active, className, ...rest } = props;
  return (
    <Button
      type="button"
      variant="ghost"
      className={`w-full justify-start h-9 ${active ? "bg-primary/10 text-primary" : ""} ${className || ""}`}
      {...rest}
    />
  );
}
