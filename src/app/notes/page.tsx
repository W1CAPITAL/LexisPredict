/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * Notas / anotações do CRM — criar, editar e excluir (persistido em Supabase).
 */
"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import {
  Plus,
  Trash2,
  StickyNote,
  Search,
  RefreshCcw,
  Loader2,
  Image as ImageIcon,
  X,
  Maximize2,
  Copyright,
  ShieldCheck,
  Zap,
  Sparkles,
  Pencil,
  Save,
} from "lucide-react";
import { CaseNote } from "@/lib/case-logic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAdmin } from "@/hooks/use-admin";
import { notesService } from "@/lib/notes/notes-service";
import { analisarNotasIA } from "@/ai/flows/note-analysis-flow";
import { cn } from "@/lib/utils";
import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

function parseNoteContent(raw: any): { text: string; imageUrl?: string } {
  if (!raw) return { text: "" };
  if (typeof raw === "object" && raw !== null) {
    return { text: String(raw.text || raw.content || ""), imageUrl: raw.imageUrl };
  }
  const s = String(raw);
  if (s.trim().startsWith("{")) {
    try {
      const j = JSON.parse(s);
      return { text: String(j.text || j.content || s), imageUrl: j.imageUrl };
    } catch {
      /* */
    }
  }
  return { text: s };
}

export default function NotesPage() {
  const [notes, setNotes] = useState<CaseNote[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<CaseNote | null>(null);
  const [editForm, setEditForm] = useState({ title: "", content: "", imageUrl: "" as string | null });

  const initialLoadDone = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { isOperador, isAdmin } = useAdmin();
  const { toast } = useToast();

  const [newNote, setNewNote] = useState({ title: "", content: "" });

  const loadData = useCallback(async (force = false) => {
    if (!force && initialLoadDone.current) return;
    setLoading(true);
    try {
      const data = await notesService.getNotes();
      setNotes(data);
      initialLoadDone.current = true;
    } catch (e) {
      console.error("Notes failed to load", e);
      toast({ title: "Falha ao carregar notas", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleAddNote = async () => {
    if (!isOperador || isSaving) return;
    if (!newNote.content.trim()) {
      toast({ title: "Escreva o conteúdo da nota", variant: "destructive" });
      return;
    }
    setIsSaving(true);
    try {
      const result = await notesService.createNote({
        title: newNote.title.trim() || "Nota",
        content: newNote.content.trim(),
        imageUrl: imagePreview || undefined,
      } as any);
      if (result?.success) {
        toast({ title: "Nota salva no CRM" });
        setNewNote({ title: "", content: "" });
        setImagePreview(null);
        await loadData(true);
      } else {
        toast({ title: "Falha ao salvar", variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Erro", description: e?.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const openEdit = (note: CaseNote) => {
    const parsed = parseNoteContent((note as any).content);
    setEditing(note);
    setEditForm({
      title: note.title || "Nota",
      content: parsed.text || String((note as any).content || ""),
      imageUrl: parsed.imageUrl || (note as any).imageUrl || null,
    });
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editing?.id || isSaving) return;
    if (!editForm.content.trim()) {
      toast({ title: "Conteúdo obrigatório", variant: "destructive" });
      return;
    }
    setIsSaving(true);
    try {
      const result = await notesService.updateNote(editing.id, {
        title: editForm.title.trim() || "Nota",
        content: editForm.content.trim(),
        imageUrl: editForm.imageUrl || undefined,
      } as any);
      if (result?.success) {
        toast({ title: "Nota atualizada no CRM" });
        setEditOpen(false);
        setEditing(null);
        await loadData(true);
      } else {
        toast({
          title: "Falha ao atualizar",
          description: "A action updateNote pode ter falhado no servidor.",
          variant: "destructive",
        });
      }
    } catch (e: any) {
      toast({ title: "Erro ao editar", description: e?.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteNote = async (id: string) => {
    if (!confirm("Remover esta nota permanentemente?")) return;
    setIsSaving(true);
    try {
      const result = await notesService.deleteNote(id);
      if (result?.success) {
        toast({ title: "Nota removida" });
        await loadData(true);
      } else {
        toast({ title: "Falha ao excluir", variant: "destructive" });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleIAAnalysis = async () => {
    if (isAnalyzing || notes.length === 0) return;
    setIsAnalyzing(true);
    try {
      await analisarNotasIA({ notes: notes.slice(0, 30) } as any);
      window.dispatchEvent(new Event("lexis-insights-updated"));
      toast({ title: "Análise IA concluída" });
    } catch {
      toast({ title: "Falha na análise IA", variant: "destructive" });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return notes.filter((n) => {
      const parsed = parseNoteContent((n as any).content);
      return (
        (n.title || "").toLowerCase().includes(q) ||
        parsed.text.toLowerCase().includes(q)
      );
    });
  }, [notes, search]);

  return (
    <div className="flex h-screen bg-background font-sans text-foreground overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-auto border-b border-border/50 bg-card/60 backdrop-blur-xl flex items-center justify-between p-4 sm:px-8 shrink-0 gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <StickyNote size={20} className="text-primary" />
            <div>
              <h1 className="font-black text-xl uppercase tracking-tight">Anotações do CRM</h1>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
                Salvas na empresa · editar e excluir
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={handleIAAnalysis}
              disabled={isAnalyzing || notes.length === 0}
              className="h-10 bg-black text-white border-2 border-black font-black uppercase text-[10px] px-6 shadow-[4px_4px_0px_#c9a227] hover:shadow-none transition-all rounded-none"
            >
              {isAnalyzing ? <Loader2 className="animate-spin mr-2" size={14} /> : <Sparkles className="mr-2" size={14} />}
              Analisar IA
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => loadData(true)}
              className="border-2 border-black h-10 w-10 rounded-none"
            >
              <RefreshCcw className={cn("w-4 h-4", loading && "animate-spin")} />
            </Button>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-4 sm:p-8 space-y-6">
          {/* Nova nota */}
          <div className="border-2 border-black bg-white p-4 shadow-[6px_6px_0_#000] space-y-3 max-w-3xl">
            <Label className="text-[9px] font-black uppercase">Nova anotação</Label>
            <Input
              placeholder="Título (opcional)"
              value={newNote.title}
              onChange={(e) => setNewNote({ ...newNote, title: e.target.value })}
              className="border-2 border-black rounded-none h-10 font-bold text-xs"
            />
            <Textarea
              placeholder="Escreva a anotação..."
              value={newNote.content}
              onChange={(e) => setNewNote({ ...newNote, content: e.target.value })}
              rows={4}
              className="border-2 border-black rounded-none text-sm"
            />
            {imagePreview && (
              <div className="relative w-32 h-32 border-2 border-black">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imagePreview} alt="preview" className="object-cover w-full h-full" />
                <button
                  type="button"
                  onClick={() => setImagePreview(null)}
                  className="absolute top-1 right-1 bg-black text-white p-1"
                >
                  <X size={12} />
                </button>
              </div>
            )}
            <div className="flex gap-2">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                ref={fileInputRef}
                onChange={handleImageUpload}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-black h-10 w-10 rounded-none"
                disabled={isSaving}
              >
                <ImageIcon size={16} />
              </Button>
              <Button
                size="sm"
                onClick={handleAddNote}
                disabled={isSaving || !newNote.content.trim() || !isOperador}
                className="h-10 font-black bg-black text-white border-2 border-black hover:bg-white hover:text-black px-10 uppercase text-[10px] rounded-none shadow-[4px_4px_0px_#000]"
              >
                {isSaving ? <Loader2 className="animate-spin mr-2" size={14} /> : <Plus className="mr-2" size={14} />}
                Salvar no CRM
              </Button>
            </div>
          </div>

          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Buscar anotações..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-11 border-2 border-black rounded-none"
            />
          </div>

          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="animate-spin" size={28} />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground uppercase font-bold tracking-widest">
              Nenhuma anotação
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((note) => {
                const parsed = parseNoteContent((note as any).content);
                const img = parsed.imageUrl || (note as any).imageUrl;
                return (
                  <div
                    key={note.id}
                    className="group border-2 border-black bg-white p-4 shadow-[4px_4px_0_#000] hover:shadow-[6px_6px_0_#000] transition-shadow flex flex-col gap-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-black uppercase text-xs tracking-wide">
                          {note.title || "Nota"}
                        </h3>
                        <span className="text-[9px] text-black/40 font-black uppercase tracking-[0.15em]">
                          {(note as any).updatedAt || (note as any).createdAt || ""}
                        </span>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        {img && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setFullscreenImage(img)}
                            className="h-8 w-8 bg-white text-black border-2 border-black rounded-none"
                          >
                            <Maximize2 size={14} />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(note)}
                          disabled={!isOperador || isSaving}
                          title="Editar anotação"
                          className="h-8 w-8 bg-white text-black border-2 border-black rounded-none hover:bg-primary hover:text-black"
                        >
                          <Pencil size={14} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteNote(note.id)}
                          disabled={isSaving}
                          className="h-8 w-8 bg-white text-black hover:bg-red-600 hover:text-white border-2 border-black rounded-none"
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </div>
                    {img && (
                      <div className="relative w-full h-36 border border-black/20 overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={img} alt="" className="object-cover w-full h-full" />
                      </div>
                    )}
                    <p className="text-sm whitespace-pre-wrap leading-relaxed flex-1">
                      {parsed.text}
                    </p>
                    <Badge variant="outline" className="w-fit text-[8px] font-black uppercase rounded-none border-black">
                      CRM
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal editar */}
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="sm:max-w-lg rounded-none border-2 border-black shadow-[12px_12px_0_#000]">
            <DialogHeader>
              <DialogTitle className="font-black uppercase tracking-widest text-sm flex items-center gap-2">
                <Pencil size={16} /> Editar anotação
              </DialogTitle>
              <DialogDescription className="text-xs">
                Alterações são gravadas na tabela <code>notes</code> do CRM (Supabase).
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-1">
                <Label className="text-[9px] font-black uppercase">Título</Label>
                <Input
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  className="border-2 border-black rounded-none h-10 font-bold text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[9px] font-black uppercase">Conteúdo</Label>
                <Textarea
                  value={editForm.content}
                  onChange={(e) => setEditForm({ ...editForm, content: e.target.value })}
                  rows={8}
                  className="border-2 border-black rounded-none text-sm"
                />
              </div>
              {editForm.imageUrl && (
                <p className="text-[10px] text-muted-foreground truncate">
                  Imagem anexada mantida ao salvar.
                </p>
              )}
            </div>
            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditOpen(false)}
                className="rounded-none border-2 border-black"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleSaveEdit}
                disabled={isSaving || !editForm.content.trim()}
                className="rounded-none bg-black text-white font-black uppercase text-[10px] border-2 border-black"
              >
                {isSaving ? <Loader2 className="animate-spin mr-2" size={14} /> : <Save className="mr-2" size={14} />}
                Salvar no CRM
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!fullscreenImage} onOpenChange={(o) => !o && setFullscreenImage(null)}>
          <DialogContent className="max-w-4xl bg-black border-none">
            {fullscreenImage && (
              <div className="relative w-full min-h-[60vh]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={fullscreenImage} alt="" className="max-h-[80vh] mx-auto object-contain" />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setFullscreenImage(null)}
                  className="absolute top-4 right-4 text-white"
                >
                  <X size={28} />
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
