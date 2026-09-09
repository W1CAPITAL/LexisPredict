"use client";

/**
 * Autoaprimoramento do app (Ornith) — painel local.
 * Sem API: o ciclo roda na sua máquina (node scripts/selfimprove/cycle.mjs) e
 * publica um snapshot estático em /selfimprove/report.json, lido aqui.
 * Erros de runtime coletados no navegador são exportados como arquivo JSON
 * (inbox) para você soltar em reports/selfimprove/inbox/ — nada sai do app.
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 */

import React, { useCallback, useEffect, useState } from "react";
import { RefreshCw, Sparkles, Download, AlertTriangle, CheckCircle2, Terminal, ShieldCheck } from "lucide-react";

interface Proposta {
  id: number;
  titulo: string;
  prioridade: string;
  arquivos: string[];
  descricao: string;
  risco: string;
  patch: boolean;
}
interface Analise {
  resumo: string;
  diagnostico: string[];
  propostas: Proposta[];
  proximosPassos: string[];
}
interface Report {
  ciclo: string;
  quando: string;
  modelo: string;
  endpoint: string;
  ornithOk: boolean;
  erroOrnith: string | null;
  analise: Analise | null;
  temPatch: boolean;
  sinais: {
    saude: { typecheckOk: boolean; errosTsc: string[]; testesOk: boolean; falhasTeste: string[] };
    todos: Array<{ tipo: string; arquivo: string; linha: number; texto: string }>;
    inbox: Array<{ appVersion: string; eventos: Array<{ tipo: string; rota: string; mensagem: string; count: number }> }>;
    tamanho: { arquivos: number; linhas: number };
  };
}

const CORES_PRIORIDADE: Record<string, string> = {
  P0: "bg-red-600/20 text-red-300 border-red-700/40",
  P1: "bg-amber-500/20 text-amber-300 border-amber-600/40",
  P2: "bg-blue-500/20 text-blue-300 border-blue-600/40",
  P3: "bg-muted text-muted-foreground border-border",
};

export default function AutoaprimoramentoPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [erro, setErro] = useState<string>("");
  const [carregando, setCarregando] = useState(true);
  const [inbox, setInbox] = useState<Array<{ tipo: string; rota: string; mensagem: string; quando: string; count: number }>>([]);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro("");
    try {
      const res = await fetch("/selfimprove/report.json", { cache: "no-store" });
      if (!res.ok) throw new Error(`snapshot não publicado (HTTP ${res.status}) — rode o ciclo na sua máquina`);
      setReport((await res.json()) as Report);
    } catch (e: any) {
      setErro(e?.message || "falha ao carregar snapshot");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
    try {
      const raw = sessionStorage.getItem("lexis_selfimprove_inbox");
      if (raw) setInbox(JSON.parse(raw));
    } catch {
      /* noop */
    }
  }, [carregar]);

  /** Baixa a inbox de erros do navegador para soltar em reports/selfimprove/inbox/. */
  const exportarInbox = useCallback(() => {
    const drop = {
      tipo: "lexis-selfimprove-inbox",
      versaoApp: report?.sinais ? "runtime" : "runtime",
      exportadoEm: new Date().toISOString(),
      eventos: inbox.slice(0, 100),
    };
    const blob = new Blob([JSON.stringify(drop, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lexis-inbox-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [inbox, report]);

  const copiarComandoCiclo = useCallback(() => {
    navigator.clipboard
      ?.writeText("node scripts/selfimprove/cycle.mjs")
      .catch(() => undefined);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-primary" /> Autoaprimoramento (Ornith)
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Ciclo local: coleta sinais do app inteiro → modelo Ornith na sua máquina → propostas + patch.
              Sem API, sem nuvem.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={copiarComandoCiclo}
              className="text-xs rounded-lg border border-border/60 px-3 py-2 flex items-center gap-1.5 hover:bg-accent"
              title="Copia o comando do ciclo"
            >
              <Terminal className="w-3.5 h-3.5" /> node scripts/selfimprove/cycle.mjs
            </button>
            <button
              type="button"
              onClick={carregar}
              className="text-xs rounded-lg border border-border/60 px-3 py-2 flex items-center gap-1.5 hover:bg-accent"
            >
              <RefreshCw className={"w-3.5 h-3.5" + (carregando ? " animate-spin" : "")} /> Atualizar
            </button>
          </div>
        </header>

        {erro && (
          <div className="rounded-xl border border-amber-600/40 bg-amber-500/10 text-amber-200 p-4 text-sm">
            <b>Nenhum snapshot publicado ainda.</b> {erro}
            <div className="mt-2 text-xs text-amber-200/80">
              No seu computador: <code>node scripts/selfimprove/cycle.mjs</code> e depois copie{" "}
              <code>reports/selfimprove/cycle-*.json</code> para <code>public/selfimprove/report.json</code>.
            </div>
          </div>
        )}

        {report && (
          <>
            <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-xl border border-border/60 p-3">
                <div className="text-xs text-muted-foreground">Ciclo</div>
                <div className="font-mono font-bold">{report.ciclo}</div>
              </div>
              <div className="rounded-xl border border-border/60 p-3">
                <div className="text-xs text-muted-foreground">Modelo</div>
                <div className="text-xs font-mono mt-1 truncate" title={report.modelo}>{report.modelo}</div>
              </div>
              <div className="rounded-xl border border-border/60 p-3">
                <div className="text-xs text-muted-foreground">Typecheck</div>
                <div className={"text-sm font-bold flex items-center gap-1 " + (report.sinais.saude.typecheckOk ? "text-green-500" : "text-red-500")}>
                  {report.sinais.saude.typecheckOk ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                  {report.sinais.saude.typecheckOk ? "OK" : `${report.sinais.saude.errosTsc.length} erro(s)`}
                </div>
              </div>
              <div className="rounded-xl border border-border/60 p-3">
                <div className="text-xs text-muted-foreground">Testes</div>
                <div className={"text-sm font-bold flex items-center gap-1 " + (report.sinais.saude.testesOk ? "text-green-500" : "text-red-500")}>
                  {report.sinais.saude.testesOk ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                  {report.sinais.saude.testesOk ? "OK" : `${report.sinais.saude.falhasTeste.length} falha(s)`}
                </div>
              </div>
            </section>

            {!report.ornithOk && (
              <div className="rounded-xl border border-red-700/40 bg-red-600/10 text-red-200 p-4 text-sm">
                <b>Ciclo não completou a análise:</b> {report.erroOrnith}
              </div>
            )}

            {report.analise && (
              <>
                <section className="rounded-xl border border-border/60 p-4">
                  <h2 className="font-semibold mb-1">Resumo do modelo</h2>
                  <p className="text-sm text-muted-foreground">{report.analise.resumo}</p>
                  {report.analise.diagnostico.length > 0 && (
                    <ul className="mt-3 text-sm space-y-1">
                      {report.analise.diagnostico.map((d, i) => (
                        <li key={i} className="flex gap-2"><span className="text-primary">›</span>{d}</li>
                      ))}
                    </ul>
                  )}
                </section>

                <section className="space-y-3">
                  <h2 className="font-semibold">Propostas ({report.analise.propostas.length})</h2>
                  {report.analise.propostas.map((p) => (
                    <article key={p.id} className="rounded-xl border border-border/60 p-4 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={"text-[11px] rounded-md border px-2 py-0.5 font-bold " + (CORES_PRIORIDADE[p.prioridade] || CORES_PRIORIDADE.P3)}>
                          {p.prioridade}
                        </span>
                        <h3 className="font-medium">{p.titulo}</h3>
                        {p.patch && (
                          <span className="text-[11px] rounded-md border border-green-700/40 bg-green-600/10 text-green-300 px-2 py-0.5">patch</span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{p.descricao}</p>
                      <div className="text-xs text-muted-foreground/80">
                        <div>Arquivos: <code>{p.arquivos.join(", ") || "—"}</code></div>
                        <div>Risco: {p.risco}</div>
                      </div>
                    </article>
                  ))}
                </section>

                {report.analise.proximosPassos.length > 0 && (
                  <section className="rounded-xl border border-border/60 p-4">
                    <h2 className="font-semibold mb-2">Próximos passos sugeridos</h2>
                    <ol className="text-sm space-y-1 list-decimal list-inside text-muted-foreground">
                      {report.analise.proximosPassos.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ol>
                  </section>
                )}
              </>
            )}
          </>
        )}

        <section className="rounded-xl border border-border/60 p-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="font-semibold flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-primary" /> Inbox de erros do app</h2>
              <p className="text-sm text-muted-foreground">
                {inbox.length === 0
                  ? "Nenhum erro de runtime capturado nesta sessão."
                  : `${inbox.length} evento(s) capturado(s) nesta sessão — exporte e solte em reports/selfimprove/inbox/.`}
              </p>
            </div>
            <button
              type="button"
              onClick={exportarInbox}
              disabled={inbox.length === 0}
              className="text-xs rounded-lg border border-border/60 px-3 py-2 flex items-center gap-1.5 hover:bg-accent disabled:opacity-40"
            >
              <Download className="w-3.5 h-3.5" /> Exportar inbox (.json)
            </button>
          </div>
          {inbox.length > 0 && (
            <ul className="mt-3 text-xs font-mono space-y-1 max-h-40 overflow-auto">
              {inbox.slice(-8).map((e, i) => (
                <li key={i} className="text-muted-foreground truncate">
                  [{e.tipo}] {e.rota} ×{e.count} — {e.mensagem.slice(0, 120)}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
