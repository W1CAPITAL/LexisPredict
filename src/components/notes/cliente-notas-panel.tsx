"use client";

/**
 * Painel de anotações do histórico do cliente — listar + adicionar rápida.
 */
import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, StickyNote, Plus, RefreshCcw } from "lucide-react";
import {
  getNotesByClienteAction,
  createNoteAction,
} from "@/app/actions/notes-actions";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

type NoteRow = {
  id?: string;
  title: string;
  content: string;
  protocolo?: string | null;
  created_at?: string;
};

export function ClienteNotasPanel({
  cliente,
  protocolo,
  className,
}: {
  cliente: string;
  protocolo?: string;
  className?: string;
}) {
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const { toast } = useToast();

  const load = async () => {
    if (!cliente) return;
    setLoading(true);
    try {
      const data = await getNotesByClienteAction(cliente);
      setNotes(Array.isArray(data) ? data : []);
    } catch {
      setNotes([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cliente]);

  const add = async () => {
    if (!text.trim() || !cliente) return;
    setSaving(true);
    try {
      const res = await createNoteAction({
        title: title.trim() || `Histórico · ${cliente.split(" ")[0]}`,
        content: text.trim(),
        cliente,
        protocolo: protocolo || undefined,
      });
      if (res?.success) {
        toast({ title: "Nota no histórico do cliente" });
        setText("");
        setTitle("");
        await load();
      } else {
        toast({
          title: "Falha ao salvar",
          description: (res as any)?.error || "Verifique colunas cliente/protocolo na tabela notes",
          variant: "destructive",
        });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={className}>
      <div className="flex items-center justify-between gap-2 mb-3">
        <h4 className="text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5">
          <StickyNote size={14} /> Anotações · {cliente}
        </h4>
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={load}>
          <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
        </Button>
      </div>

      <div className="space-y-2 mb-4 rounded-xl border border-border/60 p-3 bg-muted/20">
        <Input
          placeholder="Título (opcional)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="h-9 text-xs rounded-lg"
        />
        <Textarea
          placeholder="Nova anotação no histórico deste cliente..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          className="text-xs rounded-lg"
        />
        <Button
          type="button"
          size="sm"
          onClick={add}
          disabled={saving || !text.trim()}
          className="h-9 w-full font-black uppercase text-[9px] tracking-widest rounded-lg gap-1"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          Salvar no histórico
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="animate-spin" size={18} />
        </div>
      ) : notes.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">Nenhuma anotação vinculada a este cliente.</p>
      ) : (
        <ul className="space-y-2 max-h-64 overflow-y-auto">
          {notes.map((n) => (
            <li key={n.id} className="rounded-lg border border-border/50 p-2.5 text-xs bg-background">
              <div className="flex justify-between gap-2 mb-1">
                <span className="font-bold uppercase text-[10px]">{n.title}</span>
                <span className="text-[9px] text-muted-foreground shrink-0">
                  {n.created_at
                    ? (() => {
                        try {
                          return format(new Date(n.created_at), "dd/MM/yyyy HH:mm");
                        } catch {
                          return "";
                        }
                      })()
                    : ""}
                </span>
              </div>
              <p className="whitespace-pre-wrap text-muted-foreground leading-relaxed">{n.content}</p>
              {n.protocolo && (
                <p className="text-[9px] font-mono mt-1 text-primary">{n.protocolo}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
