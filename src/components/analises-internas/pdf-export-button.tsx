"use client";

import { useState } from "react";
import { Download, FileText, LoaderCircle } from "lucide-react";

type Props = {
  q: string;
  cat: string;
  pagina: number;
  atividadesPagina: number;
  acoesPagina: number;
};

export function AnalisesPdfExportButton(props: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function downloadPdf() {
    if (loading) return;
    setLoading(true);
    setError("");
    setSuccess(false);
    try {
      const params = new URLSearchParams({
        q: props.q, cat: props.cat, pagina: String(props.pagina),
        atividadesPagina: String(props.atividadesPagina),
        acoesPagina: String(props.acoesPagina),
      });
      const response = await fetch("/api/analises-internas/pdf?" + params.toString(), {
        credentials: "same-origin", cache: "no-store",
        headers: { Accept: "application/pdf, application/json" },
      });
      if (!response.ok || !(response.headers.get("content-type") || "").includes("application/pdf")) {
        const payload = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(payload?.error || `A exportação falhou (HTTP ${response.status}).`);
      }
      const blob = await response.blob();
      if (blob.size < 300) throw new Error("O PDF retornado está vazio. Tente novamente.");
      const disp = response.headers.get("content-disposition") || "";
      const raw = disp.match(/filename="([^"]+)"/i)?.[1];
      const filename = raw || "LexisPredict-Analises-Pessoais.pdf";
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = filename;
      anchor.style.display = "none";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
      setSuccess(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha inesperada ao exportar.");
    } finally {
      setLoading(false);
    }
  }

  return <div className="min-w-0">
    <button type="button" onClick={downloadPdf} disabled={loading} aria-busy={loading}
      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-indigo-400/40 bg-gradient-to-r from-indigo-700 via-violet-700 to-fuchsia-700 px-5 py-2.5 text-sm font-bold text-white shadow-md transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 disabled:cursor-wait disabled:opacity-60">
      {loading ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true"/> : <Download className="h-4 w-4" aria-hidden="true" />}
      {loading ? "Preparando PDF..." : <><FileText className="h-4 w-4" aria-hidden="true" /> Exportar PDF</>}
    </button>
    <p className="mt-1.5 text-xs text-muted-foreground">
      Relatório com capa, indicadores e os registros das páginas selecionadas.
    </p>
    {error ? <p role="alert" className="mt-1.5 max-w-[390px] text-xs text-rose-600">{error}</p> : null}
    {success && !error ? <p role="status" className="mt-1.5 text-xs text-emerald-600">PDF gerado para download.</p> : null}
  </div>;
}
