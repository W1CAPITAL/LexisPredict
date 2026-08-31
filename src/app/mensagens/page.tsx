"use client";

/**
 * Chat da equipe — Geral, DMs, grupos customizados.
 * Criar grupo, remover membro (grupo), ocultar da lista (Geral).
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  Users,
  UserPlus,
  Send,
  Paperclip,
  Mic,
  Loader2,
  Plus,
  Trash2,
  EyeOff,
  MessageSquare,
  UsersRound,
} from "lucide-react";
import { notifyChatMessage } from "@/components/system/chat-notif-permission";
import {
  listarMembrosChatAction,
  garantirThreadGeralAction,
  garantirThreadDmAction,
  listarMensagensAction,
  enviarMensagemAction,
  urlArquivoChatAction,
  assinarUploadChatAction,
  quemSouChatAction,
  listarThreadsChatAction,
  criarGrupoChatAction,
  listarMembrosGrupoAction,
  removerMembroGrupoAction,
  apagarGrupoChatAction,
  apagarMensagemChatAction,
  ocultarMembroListaAction,
  listarOcultosListaAction,
} from "@/app/actions/chat-empresa-actions";
import { createClient } from "@/lib/supabase/client";

type Member = {
  auth_user_id: string;
  nome?: string | null;
  email?: string | null;
  cargo?: string | null;
  avatar_url?: string | null;
  role?: string;
};

type Thread = {
  id: string;
  tipo: string;
  titulo?: string | null;
  dm_key?: string | null;
  created_by?: string | null;
};

type Msg = {
  id: string;
  thread_id: string;
  auth_user_id?: string | null;
  autor_nome?: string | null;
  body?: string | null;
  tipo?: string;
  file_path?: string | null;
  file_name?: string | null;
  created_at: string;
};

function initials(n?: string | null) {
  const p = String(n || "?").trim().split(/\s+/);
  return ((p[0]?.[0] || "?") + (p[1]?.[0] || "")).toUpperCase();
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-2 px-3 py-2.5 animate-pulse">
      <div className="h-8 w-8 rounded-full bg-muted" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3 w-24 rounded bg-muted" />
        <div className="h-2 w-16 rounded bg-muted/70" />
      </div>
    </div>
  );
}

function BubbleMedia({ msg }: { msg: Msg }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!msg.file_path) return;
    urlArquivoChatAction(msg.file_path).then((r) => setUrl(r.url));
  }, [msg.file_path]);
  if (!msg.file_path) return null;
  if (!url)
    return (
      <p className="text-[11px] text-muted-foreground animate-pulse">Carregando anexo…</p>
    );
  if (msg.tipo === "image")
    return <img src={url} alt="" className="max-h-56 rounded-lg object-contain" />;
  if (msg.tipo === "video") return <video src={url} controls className="max-h-56 w-full rounded-lg" />;
  if (msg.tipo === "audio") return <audio src={url} controls className="w-full" />;
  return (
    <a href={url} target="_blank" rel="noreferrer" className="text-[12px] underline">
      {msg.file_name || "Baixar"}
    </a>
  );
}

export default function MensagensPage() {
  const [boot, setBoot] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [me, setMe] = useState<{ auth_id: string | null }>({ auth_id: null });
  const [members, setMembers] = useState<Member[]>([]);
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [active, setActive] = useState<"geral" | string>("geral");
  const [groupMembers, setGroupMembers] = useState<Member[]>([]);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [pickIds, setPickIds] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isAdmUi, setIsAdmUi] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const loadThread = useCallback(async (id: string) => {
    setLoadingMsgs(true);
    try {
      const rows = await listarMensagensAction(id);
      setMsgs(rows as Msg[]);
    } finally {
      setLoadingMsgs(false);
    }
  }, []);

  const refreshLists = useCallback(async () => {
    const [people, thr, ocultos] = await Promise.all([
      listarMembrosChatAction(),
      listarThreadsChatAction(),
      listarOcultosListaAction(),
    ]);
    setMembers(people as Member[]);
    setThreads((thr as Thread[]) || []);
    setHiddenIds(ocultos || []);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const who = await quemSouChatAction();
        setMe({ auth_id: who.auth_id });
        const geral = await garantirThreadGeralAction();
        await refreshLists();
        if (geral.threadId) {
          setThreadId(geral.threadId);
          setActive("geral");
          await loadThread(geral.threadId);
        }
      } catch (e: any) {
        setErr(e?.message || "Falha ao carregar chat");
      } finally {
        setBoot(false);
      }
    })();
  }, [loadThread, refreshLists]);

  useEffect(() => {
    if (!threadId) return;
    const supabase = createClient();
    const ch = supabase
      .channel(`chat-${threadId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `thread_id=eq.${threadId}` },
        (payload: any) => {
          void loadThread(threadId);
          try {
            const row = payload?.new || {};
            const author = String(row.auth_user_id || row.user_id || "");
            const meId = String((me as any)?.auth_id || "");
            if (author && meId && author === meId) return;
            const body = String(row.body || row.texto || row.content || "Nova mensagem no chat equipe");
            notifyChatMessage("Chat equipe", body.slice(0, 120));
          } catch { /* */ }
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [threadId, loadThread, me]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  const openGeral = async () => {
    setActive("geral");
    setGroupMembers([]);
    const g = await garantirThreadGeralAction();
    if (g.threadId) {
      setThreadId(g.threadId);
      await loadThread(g.threadId);
    }
  };

  const openDm = async (uid: string) => {
    setActive(uid);
    setGroupMembers([]);
    const r = await garantirThreadDmAction(uid);
    if (r.threadId) {
      setThreadId(r.threadId);
      await loadThread(r.threadId);
    }
  };

  const openGrupo = async (t: Thread) => {
    setActive(t.id);
    setThreadId(t.id);
    await loadThread(t.id);
    const mem = await listarMembrosGrupoAction(t.id);
    setGroupMembers(mem as Member[]);
  };

  const sendText = async () => {
    if (!threadId || !text.trim() || busy) return;
    setBusy(true);
    setErr("");
    try {
      const r = await enviarMensagemAction({
        threadId,
        body: text.trim(),
        tipo: "text",
      });
      if (!r.success) setErr(r.message || "Falha ao enviar");
      else setText("");
      await loadThread(threadId);
    } finally {
      setBusy(false);
    }
  };

  const uploadBlob = async (f: File) => {
    if (!threadId) return;
    setBusy(true);
    try {
      const up = await assinarUploadChatAction({
        threadId,
        fileName: f.name,
        mime: f.type,
      });
      if (!up.success || !up.signedUrl || !up.path) {
        setErr(up.message || "Upload falhou");
        return;
      }
      await fetch(up.signedUrl, { method: "PUT", body: f, headers: { "Content-Type": f.type || "application/octet-stream" } });
      const tipo = f.type.startsWith("image/")
        ? "image"
        : f.type.startsWith("video/")
          ? "video"
          : f.type.startsWith("audio/")
            ? "audio"
            : "file";
      await enviarMensagemAction({
        threadId,
        body: f.name,
        tipo,
        file_path: up.path,
        file_name: f.name,
        file_mime: f.type,
        file_size: f.size,
      });
      await loadThread(threadId);
    } catch (e: any) {
      setErr(e?.message || "Falha no anexo");
    } finally {
      setBusy(false);
    }
  };

  const createGroup = async () => {
    setCreating(true);
    setErr("");
    try {
      const r = await criarGrupoChatAction({ titulo: newTitle, memberIds: pickIds });
      if (!r.success) {
        setErr(r.message || "Não criou o grupo");
        return;
      }
      setCreateOpen(false);
      setNewTitle("");
      setPickIds([]);
      await refreshLists();
      if (r.threadId) {
        await openGrupo({ id: r.threadId, tipo: "grupo", titulo: newTitle });
      }
    } finally {
      setCreating(false);
    }
  };

  const removeFromGroup = async (uid: string) => {
    if (!threadId || active === "geral") return;
    const r = await removerMembroGrupoAction(threadId, uid);
    if (!r.success) setErr(r.message || "Falha");
    else {
      const mem = await listarMembrosGrupoAction(threadId);
      setGroupMembers(mem as Member[]);
    }
  };

  const hideFromList = async (uid: string) => {
    const r = await ocultarMembroListaAction(uid);
    if (!r.success) setErr(r.message || "Falha");
    else setHiddenIds((h) => [...h, uid]);
  };

  const title = useMemo(() => {
    if (active === "geral") return "Geral da empresa";
    const g = threads.find((t) => t.id === active && t.tipo === "grupo");
    if (g) return g.titulo || "Grupo";
    return members.find((m) => m.auth_user_id === active)?.nome || "Conversa";
  }, [active, members, threads]);

  const visibleMembers = members.filter(
    (m) =>
      m.auth_user_id &&
      m.auth_user_id !== me.auth_id &&
      !hiddenIds.includes(m.auth_user_id)
  );
  const grupos = threads.filter((t) => t.tipo === "grupo");

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <Sidebar />
      <main
        className="flex-1 min-w-0 flex min-h-0 overflow-hidden lexis-main-pad" style={{ maxHeight: "calc(100vh - var(--lexis-dock-pad, 100px))" }}
        style={{ paddingBottom: "var(--lexis-dock-pad, 0px)" }}
      >
        <aside className="w-[280px] shrink-0 border-r border-border flex flex-col bg-card/40">
          <div className="p-3 border-b flex items-start justify-between gap-2">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Chat da empresa
              </p>
              <h1 className="text-sm font-black">Conversas</h1>
            </div>
            <Button
              size="sm"
              className="h-8 gap-1 text-[11px] font-bold"
              onClick={() => setCreateOpen(true)}
            >
              <Plus size={14} /> Grupo
            </Button>
          </div>

          <ScrollArea className="flex-1">
            {boot ? (
              <div className="py-2">
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
              </div>
            ) : (
              <div className="py-2 space-y-3">
                <div>
                  <p className="px-3 text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1">
                    Canais
                  </p>
                  <button
                    type="button"
                    onClick={() => void openGeral()}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-[13px] transition-all duration-200",
                      active === "geral"
                        ? "bg-primary/12 text-primary font-semibold"
                        : "hover:bg-muted/80"
                    )}
                  >
                    <Users size={16} className="shrink-0" />
                    Geral
                  </button>
                  {grupos.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => void openGrupo(g)}
                      className={cn(
                        "w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-[13px] transition-all duration-200",
                        active === g.id
                          ? "bg-primary/12 text-primary font-semibold"
                          : "hover:bg-muted/80"
                      )}
                    >
                      <UsersRound size={16} className="shrink-0" />
                      <span className="truncate">{g.titulo || "Grupo"}</span>
                    </button>
                  ))}
                </div>

                <div>
                  <p className="px-3 text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1">
                    Diretas
                  </p>
                  {visibleMembers.map((m) => (
                    <div
                      key={m.auth_user_id}
                      className={cn(
                        "group flex items-center gap-1 pr-1 transition-colors duration-200",
                        active === m.auth_user_id ? "bg-primary/12" : "hover:bg-muted/80"
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => void openDm(m.auth_user_id)}
                        className="flex-1 flex items-center gap-2.5 px-3 py-2 text-left text-[13px] min-w-0"
                      >
                        <Avatar className="h-7 w-7 shrink-0">
                          {m.avatar_url ? <AvatarImage src={m.avatar_url} /> : null}
                          <AvatarFallback className="text-[10px]">{initials(m.nome)}</AvatarFallback>
                        </Avatar>
                        <span className="truncate">{m.nome || m.email || "Colega"}</span>
                      </button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Ocultar desta lista (só para você)"
                        onClick={() => void hideFromList(m.auth_user_id)}
                      >
                        <EyeOff size={14} />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </ScrollArea>
        </aside>

        <section className="flex-1 min-w-0 flex flex-col min-h-0">
          <header className="h-14 border-b px-4 flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <MessageSquare size={16} className="text-primary shrink-0" />
              <h2 className="font-black text-sm truncate">{title}</h2>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {active !== "geral" && threads.some((x) => x.id === active && x.tipo === "grupo") && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 text-[11px] font-bold gap-1"
                  onClick={() => setSettingsOpen(true)}
                >
                  <UsersRound size={14} /> Config. do grupo
                </Button>
              )}
            </div>
          </header>

          <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
            {loadingMsgs ? (
              <div className="space-y-3 max-w-lg animate-pulse">
                <div className="h-12 rounded-2xl bg-muted w-2/3" />
                <div className="h-12 rounded-2xl bg-muted w-1/2 ml-auto" />
                <div className="h-12 rounded-2xl bg-muted w-3/5" />
              </div>
            ) : msgs.length === 0 ? (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                Nenhuma mensagem ainda. Comece a conversa.
              </div>
            ) : (
              msgs.map((m) => {
                const mine = m.auth_user_id && m.auth_user_id === me.auth_id;
                return (
                  <div
                    key={m.id}
                    className={cn(
                      "group max-w-[75%] rounded-2xl px-3.5 py-2.5 text-[13px] shadow-sm transition-all duration-200",
                      mine
                        ? "ml-auto bg-primary text-primary-foreground"
                        : "bg-muted/80"
                    )}
                  >
                    {!mine && (
                      <p className="text-[10px] font-bold opacity-70 mb-0.5">
                        {m.autor_nome || "Colega"}
                      </p>
                    )}
                    {m.body ? <p className="whitespace-pre-wrap break-words">{m.body}</p> : null}
                    <BubbleMedia msg={m} />
                    <div className={cn("flex items-center gap-2 mt-1", mine ? "justify-end" : "justify-start")}>
                      <p className="text-[9px] opacity-60">
                        {new Date(m.created_at).toLocaleString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                          day: "2-digit",
                          month: "2-digit",
                        })}
                      </p>
                      <button
                        type="button"
                        title="Apagar mensagem"
                        className="text-[9px] font-bold uppercase opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity"
                        onClick={async () => {
                          if (!confirm("Apagar esta mensagem?")) return;
                          const r = await apagarMensagemChatAction(m.id);
                          if (!r.success) setErr(r.message || "Falha");
                          else if (threadId) await loadThread(threadId);
                        }}
                      >
                        Apagar
                      </button>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>

          {err ? (
            <div className="px-4 py-2 text-[12px] bg-destructive/10 text-destructive border-t shrink-0">
              {err}
            </div>
          ) : null}

          <footer data-lexis-composer className="border-t p-3 pb-4 flex items-center gap-2 shrink-0 bg-background/95 backdrop-blur-sm z-30 sticky bottom-0">
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              accept="image/*,video/*,audio/*,.pdf,.zip,.rar,.7z,application/pdf"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void uploadBlob(f);
                e.currentTarget.value = "";
              }}
            />
            <Button type="button" variant="ghost" size="icon" onClick={() => fileRef.current?.click()}>
              <Paperclip size={18} />
            </Button>
            <Button type="button" variant="ghost" size="icon" onClick={() => fileRef.current?.click()}>
              <Mic size={18} />
            </Button>
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Mensagem para a equipe…"
              className="transition-shadow duration-200 focus-visible:ring-2"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void sendText();
                }
              }}
            />
            <Button type="button" onClick={() => void sendText()} disabled={busy || !text.trim()}>
              {busy ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
            </Button>
          </footer>
        </section>
      </main>

      
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Configurações do grupo</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <p className="text-[12px] text-muted-foreground">
              Administradores e o criador podem remover membros ou apagar o grupo.
            </p>
            <ScrollArea className="h-52 border rounded-lg">
              {groupMembers.map((m) => (
                <div
                  key={m.auth_user_id}
                  className="flex items-center gap-2 px-3 py-2 border-b border-border/50 last:border-0"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-[10px]">{initials(m.nome)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{m.nome || m.auth_user_id}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{m.email || m.role || ""}</p>
                  </div>
                  {m.auth_user_id !== me.auth_id && (
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      className="h-8 gap-1 text-[11px] shrink-0"
                      onClick={() => void removeFromGroup(m.auth_user_id)}
                    >
                      <Trash2 size={14} /> Remover
                    </Button>
                  )}
                </div>
              ))}
              {groupMembers.length === 0 && (
                <p className="p-4 text-sm text-muted-foreground">Nenhum membro listado.</p>
              )}
            </ScrollArea>
            <Button
              type="button"
              variant="destructive"
              className="w-full gap-2 font-bold"
              onClick={async () => {
                if (!threadId) return;
                if (!confirm("Apagar este grupo e o histórico associado?")) return;
                const r = await apagarGrupoChatAction(threadId);
                if (!r.success) setErr(r.message || "Falha ao apagar");
                else {
                  setSettingsOpen(false);
                  setGroupMembers([]);
                  await refreshLists();
                  await openGeral();
                }
              }}
            >
              <Trash2 size={16} /> Apagar grupo
            </Button>
          </div>
        </DialogContent>
      </Dialog>

<Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus size={18} /> Novo grupo
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Input
              placeholder="Nome do grupo"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground font-medium">Membros</p>
            <ScrollArea className="h-48 border rounded-lg">
              {members
                .filter((m) => m.auth_user_id && m.auth_user_id !== me.auth_id)
                .map((m) => {
                  const on = pickIds.includes(m.auth_user_id);
                  return (
                    <button
                      key={m.auth_user_id}
                      type="button"
                      onClick={() =>
                        setPickIds((ids) =>
                          on ? ids.filter((x) => x !== m.auth_user_id) : [...ids, m.auth_user_id]
                        )
                      }
                      className={cn(
                        "w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors",
                        on ? "bg-primary/10" : "hover:bg-muted"
                      )}
                    >
                      <Avatar className="h-7 w-7">
                        <AvatarFallback className="text-[10px]">{initials(m.nome)}</AvatarFallback>
                      </Avatar>
                      <span className="truncate">{m.nome || m.email}</span>
                    </button>
                  );
                })}
            </ScrollArea>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void createGroup()} disabled={creating || !newTitle.trim()}>
              {creating ? <Loader2 className="animate-spin" size={16} /> : "Criar grupo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
