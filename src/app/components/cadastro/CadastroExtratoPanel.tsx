"use client";

/**
 * Painel de cadastro: cola texto do extrato PDF **ou** só o protocolo.
 * DJEN é buscado no browser (evita WAF do IP Vercel).
 */
import { useState } from "react";
import { cadastrarFromExtratoOuProtocoloAction } from "@/app/actions/cadastro-extrato-action";
import { formatCnj, digitsOnly } from "@/lib/cnj-extract";

// Ajuste o import se o client DJEN estiver em outro path no seu tree:
// import { djenBuscaPorNumeroProcesso } from "@/lib/djen-client";

type Props = {
  onReady?: (campos: Record<string, unknown>) => void;
};

export function CadastroExtratoPanel({ onReady }: Props) {
  const [texto, setTexto] = useState("");
  const [protocolo, setProtocolo] = useState("");
  const [status, setStatus] = useState("");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  async function buscarDjenClient(cnj: string) {
    // Client-side oficial (mesmo host que comunica.pje.jus.br)
    const params = new URLSearchParams({
      numeroProcesso: digitsOnly(cnj),
      itensPorPagina: "50",
      pagina: "1",
    });
    try {
      const res = await fetch(
        `https://comunicaapi.pje.jus.br/api/v1/comunicacao?${params}`,
        { method: "GET", headers: { Accept: "application/json" } }
      );
      const ct = res.headers.get("content-type") || "";
      if (!ct.includes("json")) {
        return { ok: false, htmlBlocked: true, items: [] as any[], error: "HTML em vez de JSON" };
      }
      const json = await res.json();
      const items = json?.items || json?.comunicacoes || json?.data || [];
      return { ok: true, items: Array.isArray(items) ? items : [], htmlBlocked: false };
    } catch (e) {
      return {
        ok: false,
        items: [] as any[],
        error: e instanceof Error ? e.message : "rede",
      };
    }
  }

  async function onSubmit() {
    setLoading(true);
    setStatus("Processando…");
    try {
      let djenItems: any[] = [];
      let djenMeta: any = undefined;
      const cnj =
        protocolo.trim() ||
        (texto.match(/\d{7}[-.]?\d{2}[.]?\d{4}[.]?\d[.]?\d{2}[.]?\d{4}/) || [])[0];

      if (cnj && digitsOnly(cnj).length === 20 && !texto.trim()) {
        setStatus("Consultando DJEN no seu IP…");
        const d = await buscarDjenClient(formatCnj(cnj));
        djenItems = d.items;
        djenMeta = d;
      }

      const r = await cadastrarFromExtratoOuProtocoloAction({
        texto: texto.trim() || undefined,
        protocolo: protocolo.trim() || cnj || undefined,
        djenItems,
        djenMeta,
        usarGrokSeNecessario: true,
      });
      setResult(r);
      setStatus(r.ok ? `OK · modo ${r.mode} · confiança ${r.confianca}` : r.aviso || "Falha");
      if (r.ok && r.campos && onReady) onReady(r.campos as any);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "erro");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3 rounded-xl border p-4">
      <h3 className="font-semibold text-sm">Cadastro · extrato PDF ou só protocolo (DJEN)</h3>
      <p className="text-xs opacity-70">
        Cole o texto do comprovante de distribuição (eproc) <strong>ou</strong> só o CNJ. O
        parser não depende da ordem dos campos. DJEN roda no seu navegador para evitar bloqueio.
      </p>
      <textarea
        className="w-full min-h-[120px] rounded border bg-transparent p-2 text-xs font-mono"
        placeholder="Cole aqui o texto do PDF de distribuição (opcional se informar o protocolo)…"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
      />
      <input
        className="w-full rounded border bg-transparent p-2 text-sm font-mono"
        placeholder="Protocolo CNJ (ex. 5001032-25.2026.8.01.0006)"
        value={protocolo}
        onChange={(e) => setProtocolo(e.target.value)}
      />
      <button
        type="button"
        disabled={loading}
        onClick={() => void onSubmit()}
        className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {loading ? "Aguarde…" : "Capturar dados"}
      </button>
      <p className="text-xs">{status}</p>
      {result?.campos && (
        <pre className="max-h-48 overflow-auto rounded bg-black/30 p-2 text-[10px]">
          {JSON.stringify(result.campos, null, 2)}
        </pre>
      )}
    </div>
  );
}
