"use client";

import React, { useState } from "react";
import {
  PopoverForm,
  PopoverFormButton,
  PopoverFormSuccess,
} from "@/components/ui/popover-form";
import { notesService } from "@/lib/notes/notes-service";
import { useToast } from "@/hooks/use-toast";

/**
 * Popover "Nova anotação" — UX Cult/popover-form, grava no CRM.
 */
export function NotesQuickAddPopover({
  enabled = true,
  onSaved,
}: {
  enabled?: boolean;
  onSaved?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "success">("idle");
  const { toast } = useToast();

  async function submit() {
    if (!enabled || !content.trim()) return;
    setState("loading");
    try {
      const result = await notesService.createNote({
        title: title.trim() || "Nota",
        content: content.trim(),
      } as any);
      if (result?.success) {
        setState("success");
        toast({ title: "Nota salva no CRM", variant: "success" as any });
        onSaved?.();
        setTimeout(() => {
          setOpen(false);
          setState("idle");
          setTitle("");
          setContent("");
        }, 1200);
      } else {
        setState("idle");
        toast({ title: "Falha ao salvar", variant: "destructive" });
      }
    } catch (e: any) {
      setState("idle");
      toast({ title: "Erro", description: e?.message, variant: "destructive" });
    }
  }

  return (
    <PopoverForm
      title="Nova anotação"
      triggerLabel="+ Anotação rápida"
      open={open}
      setOpen={(v) => {
        if (!enabled && v) return;
        setOpen(v);
      }}
      width="360px"
      showCloseButton={state !== "success"}
      showSuccess={state === "success"}
      openChild={
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="p-3 space-y-3"
        >
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título (opcional)"
            className="w-full h-9 px-3 text-xs font-semibold border rounded-lg bg-background"
          />
          <textarea
            autoFocus
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Observação do cliente / CRM…"
            className="w-full h-28 resize-none rounded-lg border p-3 text-sm outline-none focus:ring-2 focus:ring-primary"
            required
          />
          <div className="flex items-center gap-2">
            <PopoverFormButton loading={state === "loading"} text="Salvar no CRM" />
          </div>
        </form>
      }
      successChild={
        <PopoverFormSuccess
          title="Anotação salva"
          description="Registro gravado no CRM do gabinete."
        />
      }
    />
  );
}
