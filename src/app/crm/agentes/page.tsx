"use client";

import React, { useEffect, useState } from "react";
import { CrmShell } from "@/components/crm/crm-shell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  listAgentCatalogAction,
  runCrmAgentAction,
  listAgentTasksAction,
  agentScheduleRecheckAction,
  agentListOutstandingAction,
} from "@/app/actions/crm-agent-actions";
import { Bot, Loader2, Play, CalendarClock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CrmAgentId } from "@/lib/crm-agent/types";

export default function CrmAgentesPage() {
  const [catalog, setCatalog] = useState<Record<string, { nome: string; descricao: string; tools: string[] }>>({});
  const [agentId, setAgentId] = useState<CrmAgentId>("silencio-comercial");
  const [prompt, setPrompt] = useState("");
  const [protocolo, setProtocolo] = useState("");
  const [running, setRunning] = useState(false);
  const [out, setOut] = useState("");
  const [logs, setLogs] = useState<{ tool: string; summary: string }[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [counts, setCounts] = useState({ atrasados: 0, silencio: 0 });

  useEffect(() => {
    listAgentCatalogAction().then((r) => setCatalog(r.catalog || {}));
    listAgentTasksAction().then((r) => setTasks(r.tasks || []));
    agentListOutstandingAction().then((r) =>
      setCounts({ atrasados: (r.atrasados || []).length, silencio: (r.silencio || []).length })
    );
  }, []);

  const run = async () => {
    setRunning(true);
    setOut("");
    try {
      const res = await runCrmAgentAction({
        agent_id: agentId,
        prompt: prompt || undefined,
        protocolo: protocolo || undefined,
      });
      setOut(res.content || res.error || "");
      setLogs(res.logs || []);
    } finally {
      setRunning(false);
    }
  };

  const schedule = async () => {
    await agentScheduleRecheckAction({
      agent_id: agentId,
      subject_type: "empresa",
      subject_id: "carteira",
      days: 7,
      note: prompt || "recheck semanal",
    });
    const t = await listAgentTasksAction();
    setTasks(t.tasks || []);
  };

  return (
    <CrmShell
      title="Agentes CRM"
      subtitle="Fila + skills (evidência, identidade, limites, brief) — o CRM guarda as notas do agente"
    >
      <div className="flex-1 overflow-auto p-4 sm:p-6 space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="rounded-xl border border-border/50 bg-card px-3 py-2">
            <p className="text-[8px] font-black uppercase text-muted-foreground">Atrasados (amostra)</p>
            <p className="text-xl font-black tabular-nums">{counts.atrasados}</p>
          </div>
          <div className="rounded-xl border border-border/50 bg-card px-3 py-2">
            <p className="text-[8px] font-black uppercase text-muted-foreground">Silêncio &gt;14d</p>
            <p className="text-xl font-black tabular-nums">{counts.silencio}</p>
          </div>
          <div className="rounded-xl border border-border/50 bg-card px-3 py-2">
            <p className="text-[8px] font-black uppercase text-muted-foreground">Tarefas na fila</p>
            <p className="text-xl font-black tabular-nums">{tasks.length}</p>
          </div>
          <div className="rounded-xl border border-border/50 bg-card px-3 py-2">
            <p className="text-[8px] font-black uppercase text-muted-foreground">Agentes</p>
            <p className="text-xl font-black tabular-nums">{Object.keys(catalog).length}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {Object.entries(catalog).map(([id, a]) => (
            <button
              key={id}
              type="button"
              onClick={() => setAgentId(id as CrmAgentId)}
              className={cn(
                "rounded-xl border px-3 py-2 text-left max-w-[220px]",
                agentId === id ? "border-primary bg-primary/10" : "border-border bg-card"
              )}
            >
              <p className="text-[10px] font-black uppercase">{a.nome}</p>
              <p className="text-[9px] text-muted-foreground line-clamp-2">{a.descricao}</p>
            </button>
          ))}
        </div>

        <Input
          value={protocolo}
          onChange={(e) => setProtocolo(e.target.value)}
          placeholder="CNJ opcional para enriquecer / brief"
          className="h-10 rounded-xl max-w-md"
        />
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Pedido (ex.: brief dos atrasados desta semana)"
          className="min-h-[90px] rounded-xl"
        />

        <div className="flex gap-2 flex-wrap">
          <Button onClick={run} disabled={running} className="h-10 rounded-xl font-black uppercase text-[10px]">
            {running ? <Loader2 className="animate-spin mr-2" size={14} /> : <Play className="mr-2" size={14} />}
            Rodar agente
          </Button>
          <Button variant="outline" onClick={schedule} className="h-10 rounded-xl font-black uppercase text-[10px]">
            <CalendarClock className="mr-2" size={14} />
            Recheck em 7 dias
          </Button>
        </div>

        {logs.length ? (
          <div className="flex flex-wrap gap-1">
            {logs.map((l, i) => (
              <span key={i} className="text-[8px] font-black uppercase border rounded-md px-2 py-0.5">
                {l.tool}: {l.summary}
              </span>
            ))}
          </div>
        ) : null}

        {out ? (
          <pre className="whitespace-pre-wrap rounded-2xl border border-border bg-card p-4 text-[12px] leading-relaxed font-sans">
            {out}
          </pre>
        ) : (
          <p className="text-[11px] text-muted-foreground flex items-center gap-2">
            <Bot size={14} /> Skills: evidência · identidade · limites · brief. Não marca pago nem encerra processo.
          </p>
        )}

        {tasks.length ? (
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-left text-[11px]">
              <thead className="bg-secondary/50 text-[9px] font-black uppercase">
                <tr>
                  <th className="px-3 py-2">Agente</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Due</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((t) => (
                  <tr key={t.id} className="border-t border-border/40">
                    <td className="px-3 py-2">{t.agent_id}</td>
                    <td className="px-3 py-2">{t.status}</td>
                    <td className="px-3 py-2 font-mono">{String(t.due_at || "").slice(0, 16)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </CrmShell>
  );
}
