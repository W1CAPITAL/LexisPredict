"use client";

/**
 * Dock global de agentes CRM (estilo CompAI) — disponível em todo o Lexis (Vercel),
 * não só em /crm. Skills + e-mail + enriquecimento CNPJ.
 */
import React, { useEffect, useState } from "react";
import { Bot, Loader2, Mail, X, Building2 } from "lucide-react";
import {
  listAgentCatalogAction,
  runCrmAgentAction,
  agentDraftEmailAction,
  agentSendEmailAction,
  agentBrasilApiCnpjAction,
} from "@/app/actions/crm-agent-actions";
import type { CrmAgentId } from "@/lib/crm-agent/types";
import { cn } from "@/lib/utils";

export function AgentDock() {
  const [open, setOpen] = useState(false);
  const [catalog, setCatalog] = useState<Record<string, { nome: string; descricao: string }>>({});
  const [agentId, setAgentId] = useState<CrmAgentId>("followup-operacional");
  const [prompt, setPrompt] = useState("");
  const [protocolo, setProtocolo] = useState("");
  const [emailTo, setEmailTo] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState("");
  const [mailSubject, setMailSubject] = useState("");
  const [mailBody, setMailBody] = useState("");

  useEffect(() => {
    if (!open) return;
    listAgentCatalogAction().then((r) => setCatalog(r.catalog || {}));
  }, [open]);

  const run = async () => {
    setBusy(true);
    setOut("");
    try {
      const res = await runCrmAgentAction({
        agent_id: agentId,
        prompt: prompt || undefined,
        protocolo: protocolo || undefined,
      });
      setOut(res.content || res.error || "");
    } finally {
      setBusy(false);
    }
  };

  const draftMail = async () => {
    setBusy(true);
    try {
      const res = await agentDraftEmailAction({
        to: emailTo,
        protocolo,
        contexto: prompt || out,
      });
      if (res.success) {
        setMailSubject(res.subject);
        setMailBody(res.body);
        setOut((res.body || "").slice(0, 2000));
      } else setOut(res.error || "Falha rascunho");
    } finally {
      setBusy(false);
    }
  };

  const sendMail = async (send: boolean) => {
    setBusy(true);
    try {
      const res = await agentSendEmailAction({
        to: emailTo,
        subject: mailSubject || "Atualização",
        body: mailBody || out,
        send,
      });
      if (res.mailto && !send) {
        window.open(res.mailto, "_blank");
      }
      setOut(
        res.success
          ? res.message || res.mode || "OK"
          : res.error || "Erro"
      );
    } finally {
      setBusy(false);
    }
  };

  const enrichCnpj = async () => {
    setBusy(true);
    try {
      const res = await agentBrasilApiCnpjAction(cnpj);
      if (res.success && res.observed) {
        setOut(JSON.stringify(res.observed, null, 2));
      } else setOut(res.error || "Sem dados");
    } finally {
      setBusy(false);
    }
  };

  // Não mostrar em login
  if (typeof window !== "undefined" && window.location.pathname.startsWith("/login")) {
    return null;
  }

  return (
    <div className="lexis-agent-dock">
      {open && (
        <div className="lexis-agent-panel space-y-3 text-sm">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-black text-xs uppercase tracking-widest">
              <Bot className="h-4 w-4 text-primary" />
              Agentes Lexis
            </div>
            <button type="button" className="p-1 rounded-md hover:bg-muted" onClick={() => setOpen(false)}>
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Skills CompAI (evidência, identidade, limites). E-mail e CNPJ sem RapidAPI/LinkedIn pagos.
          </p>

          <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Agente</label>
          <select
            className="w-full h-9 rounded-md border border-border bg-background px-2 text-xs"
            value={agentId}
            onChange={(e) => setAgentId(e.target.value as CrmAgentId)}
          >
            {Object.entries(catalog).map(([id, meta]) => (
              <option key={id} value={id}>
                {meta.nome}
              </option>
            ))}
          </select>

          <input
            className="w-full h-9 rounded-md border border-border bg-background px-2 text-xs"
            placeholder="CNJ (opcional)"
            value={protocolo}
            onChange={(e) => setProtocolo(e.target.value)}
          />
          <textarea
            className="w-full min-h-[72px] rounded-md border border-border bg-background px-2 py-1.5 text-xs"
            placeholder="Pedido ao agente…"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void run()}
              className="h-9 px-3 rounded-md bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Rodar"}
            </button>
          </div>

          <div className="border-t border-border pt-2 space-y-2">
            <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              <Mail className="h-3.5 w-3.5" /> E-mail cliente
            </div>
            <input
              className="w-full h-8 rounded-md border border-border bg-background px-2 text-xs"
              placeholder="cliente@email.com"
              value={emailTo}
              onChange={(e) => setEmailTo(e.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-ghost text-[10px] font-bold uppercase h-8 px-2 border border-border rounded-md" disabled={busy} onClick={() => void draftMail()}>
                Rascunho
              </button>
              <button type="button" className="text-[10px] font-bold uppercase h-8 px-2 border border-border rounded-md" disabled={busy} onClick={() => void sendMail(false)}>
                Abrir mailto
              </button>
              <button type="button" className="text-[10px] font-bold uppercase h-8 px-2 border border-primary/40 rounded-md text-primary" disabled={busy} onClick={() => void sendMail(true)}>
                Enviar (Resend)
              </button>
            </div>
          </div>

          <div className="border-t border-border pt-2 space-y-2">
            <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              <Building2 className="h-3.5 w-3.5" /> CNPJ · BrasilAPI
            </div>
            <div className="flex gap-2">
              <input
                className="flex-1 h-8 rounded-md border border-border bg-background px-2 text-xs"
                placeholder="00.000.000/0000-00"
                value={cnpj}
                onChange={(e) => setCnpj(e.target.value)}
              />
              <button type="button" className="h-8 px-2 border border-border rounded-md text-[10px] font-bold uppercase" disabled={busy} onClick={() => void enrichCnpj()}>
                Buscar
              </button>
            </div>
          </div>

          {out ? (
            <pre className="text-[11px] whitespace-pre-wrap break-words rounded-md bg-muted/50 p-2 max-h-40 overflow-auto border border-border">
              {out}
            </pre>
          ) : null}
        </div>
      )}

      <button
        type="button"
        className={cn("lexis-agent-fab")}
        onClick={() => setOpen((v) => !v)}
        title="Agentes CRM em todo o app"
      >
        <Bot className="h-4 w-4" />
        {open ? "Fechar" : "Agentes"}
      </button>
    </div>
  );
}
