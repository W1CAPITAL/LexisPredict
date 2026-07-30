
"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Plus, Trash2, StickyNote, Search, RefreshCcw, Loader2, Image as ImageIcon, X, Maximize2, Copyright, ShieldCheck, Zap, Sparkles } from 'lucide-react';
import { CaseNote } from '@/lib/case-logic';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAdmin } from '@/hooks/use-admin';
import { notesService } from '@/lib/notes/notes-service';
import { analisarNotasIA } from '@/ai/flows/note-analysis-flow';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function NotesPage() {
  const [notes, setNotes] = useState<CaseNote[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  
  const initialLoadDone = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { isOperador, isAdmin } = useAdmin();
  const { toast } = useToast();

  const [newNote, setNewNote] = useState({ title: '', content: '' });

  const loadData = useCallback(async (force = false) => {
    if (!force && initialLoadDone.current) return;
    
    setLoading(true);
    try {
      const data = await notesService.getNotes();
      setNotes(data);
      initialLoadDone.current = true;
    } catch (e) {
      console.error('Notes failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddNote = async () => {
    if (!isOperador || isSaving) return;
    
    if (!newNote.content.trim()) {
      toast({ title: "Atenção", description: "O conteúdo da evidência é obrigatório.", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    console.log("[UI] [INIT SAVE]");

    const notePayload: Partial<CaseNote> = {
      title: newNote.title.trim() || 'Atualização estratégica',
      content: newNote.content.trim(),
      imageUrl: imagePreview || undefined,
    };

    try {
      const result = await notesService.createNote(notePayload);
      
      if (result.success) {
        setNewNote({ title: '', content: '' });
        setImagePreview(null);
        toast({ title: "Evidência Sincronizada", description: "Registro atômico concluído com sucesso." });
        // Recarregar para garantir sincronia com IDs do banco
        await loadData(true);
      } else {
        toast({ title: "Falha técnica", description: "Não foi possível gravar a evidência no momento.", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Erro de Rede", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleIAAnalysis = async () => {
    if (notes.length === 0) return;
    
    setIsAnalyzing(true);
    try {
      const sanitizedNotes = notes.map(n => ({ title: n.title, content: n.content }));
      const result = await analisarNotasIA(sanitizedNotes);
      
      if (result && !result.error) {
        localStorage.setItem('lexisPredict_notes_analysis', JSON.stringify(result));
        window.dispatchEvent(new Event('lexis-insights-updated'));
        toast({ title: "Auditoria Concluída" });
      }
    } catch (e) {
      toast({ title: "Falha na análise neural", variant: "destructive" });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDeleteNote = async (id: string) => {
    if (!isOperador || isSaving) return;
    if (!confirm("Deseja remover esta evidência permanentemente?")) return;
    
    setIsSaving(true);
    try {
      const result = await notesService.deleteNote(id);
      if (result.success) {
        setNotes(prev => prev.filter(n => n.id !== id));
        toast({ title: "Registro removido" });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const filteredNotes = useMemo(() => {
    const searchLower = search.toLowerCase();
    return notes.filter(n => 
      (n.title || '').toLowerCase().includes(searchLower) || 
      (n.content || '').toLowerCase().includes(searchLower)
    );
  }, [notes, search]);

  return (
    <div className="flex h-screen bg-[#f3f2f2] font-sans text-black relative overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col h-screen overflow-hidden text-black relative z-10">
        <header className="h-16 border-b border-[#dddbda] bg-white flex items-center justify-between px-8 shrink-0 z-40">
          <div className="flex items-center gap-4">
            <h1 className="font-black text-xl text-black uppercase tracking-tight">Evidências de Gabinete</h1>
            <Badge variant="outline" className="border-black border-2 text-black font-black uppercase text-[10px] px-3">
              {isAdmin ? 'Acesso Global' : 'Acesso Restrito'}
            </Badge>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={handleIAAnalysis} disabled={isAnalyzing || notes.length === 0} className="h-10 bg-black text-white border-2 border-black font-black uppercase text-[10px] px-6 shadow-[4px_4px_0px_#c9a227] hover:shadow-none transition-all rounded-none">
              {isAnalyzing ? <Loader2 className="animate-spin mr-2" size={14}/> : <Sparkles className="mr-2 text-yellow-500" size={14}/>}
              Auditoria IA
            </Button>
            <div className="relative w-64 hidden lg:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-black/40 w-4 h-4" />
              <Input placeholder="FILTRAR..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 h-10 border-black border-2 text-[10px] font-black uppercase rounded-none focus-visible:ring-0" />
            </div>
            <Button variant="ghost" size="icon" onClick={() => loadData(true)} className="border-2 border-black h-10 w-10">
              <RefreshCcw className={cn("w-4 h-4", loading && "animate-spin")} />
            </Button>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-8 space-y-8">
          {isOperador && (
            <section className="max-w-xl mx-auto bg-white border-2 border-black p-6 rounded-none shadow-[10px_10px_0px_#000] space-y-4">
              <Input placeholder="TÍTULO DA NOTA" value={newNote.title} onChange={(e) => setNewNote({...newNote, title: e.target.value})} className="border-none text-[12px] font-black focus-visible:ring-0 px-0 uppercase" disabled={isSaving} />
              <Textarea placeholder="REGISTRE AQUI OS DETALHES DO ATENDIMENTO OU ANDAMENTO..." value={newNote.content} onChange={(e) => setNewNote({...newNote, content: e.target.value})} className="border-none text-[12px] focus-visible:ring-0 px-0 min-h-[100px] resize-none font-black uppercase leading-relaxed" disabled={isSaving} />
              
              {imagePreview && (
                <div className="relative w-32 h-32 border-2 border-black">
                  <Image src={imagePreview} alt="Preview" fill className="object-cover" />
                  <button onClick={() => setImagePreview(null)} className="absolute top-1 right-1 bg-black text-white p-1 hover:bg-red-600"><X size={12} /></button>
                </div>
              )}

              <div className="flex justify-between items-center pt-4 border-t-2 border-black/5">
                <div className="flex gap-2">
                  <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageUpload} />
                  <Button variant="ghost" size="icon" onClick={() => fileInputRef.current?.click()} className="border-2 border-black h-10 w-10" disabled={isSaving}>
                    <ImageIcon size={18} />
                  </Button>
                </div>
                <Button size="sm" onClick={handleAddNote} disabled={isSaving || !newNote.content.trim()} className="h-10 font-black bg-black text-white border-2 border-black hover:bg-white hover:text-black px-10 uppercase text-[10px] transition-all shadow-[4px_4px_0px_#000] hover:shadow-none">
                  {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> : <Plus className="w-3.5 h-3.5 mr-2" />}
                  Gravar Evidência
                </Button>
              </div>
            </section>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 pb-12">
            {filteredNotes.length > 0 ? filteredNotes.map((note) => (
              <div key={note.id} className="p-6 bg-white border-2 border-black rounded-none transition-all hover:bg-black group relative flex flex-col h-full shadow-[6px_6px_0px_#000] hover:shadow-none">
                <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                   {note.imageUrl && (
                    <Button variant="ghost" size="icon" onClick={() => setFullscreenImage(note.imageUrl!)} className="h-8 w-8 bg-white text-black border-2 border-black rounded-none shadow-sm"><Maximize2 size={14} /></Button>
                  )}
                  {isOperador && (
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteNote(note.id)} disabled={isSaving} className="h-8 w-8 bg-white text-black hover:bg-red-600 hover:text-white border-2 border-black rounded-none shadow-sm"><Trash2 size={14} /></Button>
                  )}
                </div>
                
                {note.imageUrl && (
                  <div className="relative w-full h-44 mb-5 border-2 border-black cursor-pointer" onClick={() => setFullscreenImage(note.imageUrl!)}>
                    <Image src={note.imageUrl} alt="Anexo" fill className="object-cover" unoptimized />
                  </div>
                )}

                <h3 className="font-black text-[13px] mb-3 text-black group-hover:text-white uppercase tracking-tight">{note.title}</h3>
                <p className="text-[11px] text-black/60 group-hover:text-white/80 leading-relaxed font-black uppercase whitespace-pre-wrap flex-1 tracking-widest">{note.content}</p>
                
                <div className="mt-5 pt-5 border-t-2 border-black/5 group-hover:border-white/20 flex justify-between items-center">
                  <span className="text-[9px] text-black/40 group-hover:text-white/40 font-black uppercase tracking-[0.2em]">{note.updatedAt}</span>
                  <StickyNote size={14} className="text-black/20 group-hover:text-white/20" />
                </div>
              </div>
            )) : (
              <div className="col-span-full py-32 text-center border-2 border-dashed border-black/20 opacity-40">
                <p className="text-[11px] font-black uppercase tracking-[0.3em]">{loading ? "Lendo repositório..." : "Nenhum registro localizado."}</p>
              </div>
            )}
          </div>
        </div>

        <footer className="h-10 border-t border-[#dddbda] bg-white flex items-center justify-center gap-6 text-[10px] text-black/60 font-black uppercase tracking-[0.2em] shrink-0">
          <div className="flex items-center gap-2"><Copyright size={10} /> 2026 W1 Capital.</div>
          <span className="uppercase font-black">Relatório de Gabinete • FUNDADOR DAVI ALVES FIGUEREDO</span>
        </footer>

        <Dialog open={!!fullscreenImage} onOpenChange={(open) => !open && setFullscreenImage(null)}>
          <DialogContent className="max-w-[95vw] w-full h-[95vh] p-0 bg-black/95 border-none flex items-center justify-center">
            {fullscreenImage && (
              <div className="relative w-full h-full flex items-center justify-center">
                <img src={fullscreenImage} alt="Evidência" className="max-w-full max-h-full object-contain" />
                <Button variant="ghost" size="icon" onClick={() => setFullscreenImage(null)} className="absolute top-8 right-8 text-white bg-black/40 hover:bg-black rounded-none h-14 w-14 border-2 border-white/20"><X size={32} /></Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
