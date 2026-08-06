"use client";

import * as React from "react";
import { X, Loader2, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type FormState = "idle" | "loading" | "success";

export function PopoverForm({
  title,
  open,
  setOpen,
  width = "340px",
  height,
  showCloseButton = true,
  showSuccess = false,
  openChild,
  successChild,
  triggerLabel = "Abrir",
  triggerClassName,
}: {
  title: string;
  open: boolean;
  setOpen: (v: boolean) => void;
  width?: string;
  height?: string;
  showCloseButton?: boolean;
  showSuccess?: boolean;
  openChild: React.ReactNode;
  successChild?: React.ReactNode;
  triggerLabel?: string;
  triggerClassName?: string;
}) {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOpen]);

  return (
    <div className="relative inline-block">
      <Button
        type="button"
        variant="outline"
        className={cn("h-10 font-black uppercase text-[10px]", triggerClassName)}
        onClick={() => setOpen(!open)}
      >
        {triggerLabel}
      </Button>
      {open ? (
        <div
          className="absolute z-50 mt-2 right-0 sm:left-0 sm:right-auto rounded-2xl border-2 border-black bg-card shadow-[8px_8px_0_#000] overflow-hidden"
          style={{ width, minHeight: height }}
        >
          <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/40">
            <span className="text-[10px] font-black uppercase tracking-wider">{title}</span>
            {showCloseButton ? (
              <button
                type="button"
                className="p-1 rounded hover:bg-muted"
                onClick={() => setOpen(false)}
                aria-label="Fechar"
              >
                <X size={14} />
              </button>
            ) : null}
          </div>
          {showSuccess && successChild ? successChild : openChild}
        </div>
      ) : null}
    </div>
  );
}

export function PopoverFormButton({
  loading,
  text,
  className,
}: {
  loading?: boolean;
  text: string;
  className?: string;
}) {
  return (
    <Button
      type="submit"
      disabled={loading}
      className={cn(
        "ml-auto h-9 px-4 font-black uppercase text-[10px] rounded-lg",
        className
      )}
    >
      {loading ? <Loader2 className="animate-spin mr-2" size={14} /> : null}
      {text}
    </Button>
  );
}

export function PopoverFormSuccess({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="p-6 flex flex-col items-center text-center gap-2">
      <div className="h-10 w-10 rounded-full bg-emerald-500/15 text-emerald-600 flex items-center justify-center">
        <Check size={20} />
      </div>
      <p className="font-black text-sm uppercase">{title}</p>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

export function PopoverFormSeparator() {
  return <div className="flex-1 h-px bg-border" />;
}

export function PopoverFormCutOutLeftIcon() {
  return null;
}
export function PopoverFormCutOutRightIcon() {
  return null;
}
