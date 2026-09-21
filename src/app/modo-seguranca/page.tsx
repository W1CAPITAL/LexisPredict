"use client";

import { useEffect, useState } from "react";
import { listSafetyCarteiraAction } from "@/app/actions/safety-carteira-actions";
import { loadSafetySession, writeSafetyCookies, clearSafetySession } from "@/lib/hybrid/safety-mode";
import Link from "next/link";

type Row = {
  protocolo?: string;
  cliente?: string;
  status?: string;
  atendente?: string;
  created_by?: string;
  tribunal?: string;
  ultimoRetorno?: string;
  proximoPrazo?: string;
};

export default function ModoSegurancaPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [err, setErr] = useState("");
  const [meta, setMeta] = useState("");
  const [loading, setLoading] = useState(true);
  const sess = typeof window !== "undefined" ? loadSafetySession() : null;

  useEffect(() => {
    const s = loadSafetySession();
    if (s?.active) writeSafetyCookies(s.user);
    let alive = true;
    (async () => {
      try {
        const res = await listSafetyCarteiraAction();
        if (!alive) return;
        setRows(res.rows || []);
        setMeta(`${res.totalVisivel} visíveis · ${res.totalPlanilha} na planilha`);
        if (!res.ok) setErr(res.error || "Webhook da planilha não respondeu.");
        if (res.ok && res.totalPlanilha === 0) {
          setErr("Planilha respondeu, mas a aba Processos está vazia. Cole a planilha com Assistente.");
        }
      } catch (e: any) {
        if (alive) setErr(e?.message || "Falha ao ler a planilha.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 p-6">
      <div className="mx-auto max-w-6xl space-y-4">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-500/40 pb-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-amber-400">Modo segurança</p>
            <h1 className="text-xl font-black">Carteira pela planilha</h1>
            <p className="text-sm text-slate-300">
              {sess?.user?.nome || sess?.user?.login || "Usuário da aba Usuarios"} · banco fora do ar
            </p>
            {meta ? <p className="text-xs text-slate-400">{meta}</p> : null}
          </div>
          <div className="flex gap-2">
            <Link href="/tarefas" className="rounded-md bg-white px-3 py-2 text-xs font-bold text-slate-900">Fila</Link>
            <Link href="/processos" className="rounded-md border border-white/30 px-3 py-2 text-xs font-bold">Processos</Link>
            <button type="button" className="rounded-md border border-white/30 px-3 py-2 text-xs" onClick={() => { clearSafetySession(); window.location.replace("/login"); }}>Sair</button>
          </div>
        </header>
        {loading ? <p className="text-sm text-slate-400">Lendo aba Processos…</p> : null}
        {err ? (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-100">
            {err}
            <p className="mt-2 text-xs text-amber-200/80">
              Vercel → LEXIS_SHEETS_WEBHOOK_URL (/exec) e LEXIS_SHEETS_TOKEN. Apps Script: web app, acesso qualquer pessoa.
            </p>
          </div>
        ) : null}
        <p className="text-sm text-slate-400">{rows.length} processo(s)</p>
        <div className="overflow-auto rounded-lg border border-white/10">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-white/5 text-[10px] uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-3 py-2">Assistente</th>
                <th className="px-3 py-2">Cliente</th>
                <th className="px-3 py-2">Protocolo</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Tribunal</th>
                <th className="px-3 py-2">Retorno</th>
                <th className="px-3 py-2">Próximo</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 500).map((r, i) => (
                <tr key={String(r.protocolo || i)} className="border-t border-white/10">
                  <td className="px-3 py-2">{r.atendente || r.created_by || "—"}</td>
                  <td className="px-3 py-2">{r.cliente || "—"}</td>
                  <td className="px-3 py-2 font-mono text-xs">{r.protocolo}</td>
                  <td className="px-3 py-2">{r.status || "—"}</td>
                  <td className="px-3 py-2">{r.tribunal || "—"}</td>
                  <td className="px-3 py-2">{r.ultimoRetorno || "—"}</td>
                  <td className="px-3 py-2">{r.proximoPrazo || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
