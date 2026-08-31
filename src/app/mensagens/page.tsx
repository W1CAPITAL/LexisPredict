"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageFooter,
  MessageHeader,
} from "@/components/ui/message";
import {
  garantirThreadDmAction,
  garantirThreadGeralAction,
  listarMembrosChatAction,
  listarMensagensAction,
  enviarMensagemAction,
  assinarUploadChatAction,
  urlArquivoChatAction,
  quemSouChatAction,
} from "@/app/actions/chat-empresa-actions";
import { createClient } from "@/lib/supabase/client";
import {
  FileArchive,
  FileText,
  ImagePlus,
  Loader2,
  Mic,
  Paperclip,
  Send,
  Users,
  Video,
} from "lucide-react";

type Member = {
  auth_user_id: string;
  nome: string;
  email?: string;
  cargo?: string;
  avatar_url?: string | null;
};
type Msg = {
  id: string;
  auth_user_id?: string;
  autor_nome?: string;
  body?: string;
  tipo?: string;
  file_path?: string | null;
  file_name?: string | null;
  file_mime?: string | null;
  created_at: string;
};

function tipoDeArquivo(mime: string, name: string) {
  const m = (mime || "").toLowerCase();
  const n = (name || "").toLowerCase();
  if (m.startsWith("image/")) return "image";
  if (m.startsWith("video/")) return "video";
  if (m.startsWith("audio/")) return "audio";
  if (m.includes("pdf") || n.endsWith(".pdf")) return "pdf";
  if (n.endsWith(".zip") || n.endsWith(".rar") || n.endsWith(".7z")) return "zip";
  return "file";
}

function BubbleMedia({ msg }: { msg: Msg }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!msg.file_path) return;
    urlArquivoChatAction(msg.file_path).then((r) => setUrl(r.url));
  }, [msg.file_path]);
  if (!msg.file_path) return null;
  if (!url) return <p className="text-[11px] text-muted-foreground">Carregando anexo…</p>;
  if (msg.tipo === "image") {
    return <img src={url} alt={msg.file_name || ""} className="max-h-56 rounded-lg object-contain" />;
  }
  if (msg.tipo === "video") return <video src={url} controls className="max-h-56 w-full rounded-lg" />;
  if (msg.tipo === "audio") return <audio src={url} controls className="w-full" />;
  return (
    <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-[12px] underline">
      {msg.tipo === "pdf" ? <FileText size={14} /> : <FileArchive size={14} />}
      {msg.file_name || "Baixar arquivo"}
    </a>
  );
}

export default function MensagensPage() {
  const [me, setMe] = useState<{ auth_id: string | null }>({ auth_id: null });
  const [members, setMembers] = useState<Member[]>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [active, setActive] = useState<"geral" | string>("geral");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [rec, setRec] = useState(false);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const loadThread = useCallback(async (id: string) => {
    const rows = await listarMensagensAction(id);
    setMsgs(rows as Msg[]);
  }, []);

  useEffect(() => {
    (async () => {
      const who = await quemSouChatAction();
      setMe({ auth_id: who.auth_id });
      const [geral, people] = await Promise.all([
        garantirThreadGeralAction(),
        listarMembrosChatAction(),
      ]);
      setMembers(people as Member[]);
      if (geral.threadId) {
        setThreadId(geral.threadId);
        await loadThread(geral.threadId);
      }
    })();
  }, [loadThread]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs.length]);

  useEffect(() => {
    if (!threadId) return;
    const t = setInterval(() => {
      listarMensagensAction(threadId).then((rows) => setMsgs(rows as Msg[]));
    }, 4000);
    let channel: ReturnType<ReturnType<typeof createClient>["channel"]> | null = null;
    try {
      const sb = createClient();
      channel = sb
        .channel(`chat-${threadId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "chat_messages", filter: `thread_id=eq.${threadId}` },
          (payload) => {
            setMsgs((prev) => {
              if (prev.some((m) => m.id === payload.new?.id)) return prev;
              return [...prev, payload.new as Msg];
            });
          }
        )
        .subscribe();
    } catch {
      /* poll */
    }
    return () => {
      clearInterval(t);
      try {
        channel?.unsubscribe();
      } catch {
        /* */
      }
    };
  }, [threadId]);

  const openGeral = async () => {
    const r = await garantirThreadGeralAction();
    if (r.threadId) {
      setActive("geral");
      setThreadId(r.threadId);
      await loadThread(r.threadId);
    }
  };

  const openDm = async (uid: string) => {
    const r = await garantirThreadDmAction(uid);
    if (r.threadId) {
      setActive(uid);
      setThreadId(r.threadId);
      await loadThread(r.threadId);
    }
  };

  const sendText = async () => {
    if (!threadId || !text.trim() || busy) return;
    setBusy(true);
    const body = text;
    setText("");
    const r = await enviarMensagemAction({ threadId, body, tipo: "text" });
    if (r.success && r.message) setMsgs((p) => [...p, r.message as Msg]);
    setBusy(false);
  };

  const uploadBlob = async (file: File) => {
    if (!threadId) return;
    setBusy(true);
    try {
      const signed = await assinarUploadChatAction({
        threadId,
        fileName: file.name,
        mime: file.type,
      });
      if (!signed.success || !signed.path || !signed.signedUrl) {
        alert(signed.message || "Falha no upload. Rode supabase/chat-empresa.sql");
        return;
      }
      const put = await fetch(signed.signedUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!put.ok) {
        alert("Upload recusado. Crie o bucket chat-empresa no Storage.");
        return;
      }
      const tipo = tipoDeArquivo(file.type, file.name);
      const r = await enviarMensagemAction({
        threadId,
        body: file.name,
        tipo,
        file_path: signed.path,
        file_name: file.name,
        file_mime: file.type,
        file_size: file.size,
      });
      if (r.success && r.message) setMsgs((p) => [...p, r.message as Msg]);
    } finally {
      setBusy(false);
    }
  };

  const startRec = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mr = new MediaRecorder(stream);
    chunksRef.current = [];
    mr.ondataavailable = (e) => {
      if (e.data.size) chunksRef.current.push(e.data);
    };
    mr.onstop = async () => {
      stream.getTracks().forEach((tr) => tr.stop());
      const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
      const file = new File([blob], `audio-${Date.now()}.webm`, { type: blob.type });
      await uploadBlob(file);
    };
    mediaRef.current = mr;
    mr.start();
    setRec(true);
  };

  const stopRec = () => {
    mediaRef.current?.stop();
    setRec(false);
  };

  const title = useMemo(() => {
    if (active === "geral") return "Geral da empresa";
    return members.find((m) => m.auth_user_id === active)?.nome || "Conversa";
  }, [active, members]);

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <Sidebar />
      <main className="flex-1 min-w-0 flex">
        <aside className="w-64 shrink-0 border-r border-border flex flex-col">
          <div className="p-3 border-b">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Chat da empresa
            </p>
            <h1 className="text-sm font-black">Membros</h1>
          </div>
          <ScrollArea className="flex-1">
            <button
              type="button"
              onClick={openGeral}
              className={`w-full flex items-center gap-2 px-3 py-2 text-left text-[13px] ${
                active === "geral" ? "bg-primary/10 text-primary" : "hover:bg-muted"
              }`}
            >
              <Users size={16} /> Geral
            </button>
            {members
              .filter((m) => m.auth_user_id && m.auth_user_id !== me.auth_id)
              .map((m) => (
                <button
                  key={m.auth_user_id}
                  type="button"
                  onClick={() => openDm(m.auth_user_id)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-left ${
                    active === m.auth_user_id ? "bg-primary/10" : "hover:bg-muted"
                  }`}
                >
                  <Avatar className="h-7 w-7">
                    {m.avatar_url ? <AvatarImage src={m.avatar_url} alt="" /> : null}
                    <AvatarFallback>{(m.nome || "?").slice(0, 2)}</AvatarFallback>
                  </Avatar>
                  <span className="truncate text-[12px] font-medium">{m.nome}</span>
                </button>
              ))}
          </ScrollArea>
        </aside>

        <section className="flex-1 min-w-0 flex flex-col">
          <header className="h-12 border-b px-4 flex items-center font-black text-sm">{title}</header>
          <ScrollArea className="flex-1 p-4">
            <div className="mx-auto max-w-2xl space-y-4">
              {msgs.map((m) => {
                const mine = !!(m.auth_user_id && m.auth_user_id === me.auth_id);
                return (
                  <Message key={m.id} align={mine ? "end" : "start"}>
                    {!mine ? (
                      <MessageAvatar>
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>{(m.autor_nome || "?").slice(0, 2)}</AvatarFallback>
                        </Avatar>
                      </MessageAvatar>
                    ) : null}
                    <MessageContent className={mine ? "items-end" : ""}>
                      <MessageHeader>{m.autor_nome}</MessageHeader>
                      <div
                        className={`w-fit max-w-full rounded-2xl px-3 py-2 text-sm ${
                          mine
                            ? "bg-primary text-primary-foreground rounded-br-md"
                            : "bg-muted rounded-bl-md"
                        }`}
                      >
                        {m.file_path ? <BubbleMedia msg={m} /> : null}
                        {m.body && m.tipo === "text" ? <p>{m.body}</p> : null}
                      </div>
                      <MessageFooter>
                        {new Date(m.created_at).toLocaleString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                          day: "2-digit",
                          month: "2-digit",
                        })}
                      </MessageFooter>
                    </MessageContent>
                  </Message>
                );
              })}
              <div ref={bottomRef} />
            </div>
          </ScrollArea>

          <footer className="border-t p-3 flex items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              accept="image/*,video/*,audio/*,.pdf,.zip,.rar,.7z,application/pdf,application/zip"
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
              <ImagePlus size={18} />
            </Button>
            <Button type="button" variant="ghost" size="icon" onClick={() => fileRef.current?.click()}>
              <Video size={18} />
            </Button>
            <Button
              type="button"
              variant={rec ? "destructive" : "ghost"}
              size="icon"
              onClick={() => (rec ? stopRec() : void startRec())}
            >
              <Mic size={18} />
            </Button>
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Mensagem para a equipe…"
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
    </div>
  );
}
