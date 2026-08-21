/**
 * Recibo simples ao marcar pago.
 * HTML imprimível (Ctrl+P → PDF) — sem dependência nova.
 */

export type ReciboData = {
  numero: string;
  empresaNome: string;
  clienteNome: string;
  descricao: string;
  valor: number;
  forma: string;
  pagoEm: string; // ISO ou YYYY-MM-DD
  protocolo?: string;
};

export function formatBRL(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function gerarReciboHtml(r: ReciboData): string {
  const data = new Date(r.pagoEm).toLocaleString("pt-BR");
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8"/>
  <title>Recibo ${r.numero}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 640px; margin: 40px auto; color: #111; }
    h1 { font-size: 18px; letter-spacing: 0.08em; text-transform: uppercase; }
    .box { border: 2px solid #111; padding: 24px; }
    .row { display: flex; justify-content: space-between; margin: 8px 0; font-size: 14px; }
    .valor { font-size: 22px; font-weight: 800; margin: 16px 0; }
    .foot { margin-top: 32px; font-size: 11px; color: #555; }
  </style>
</head>
<body>
  <div class="box">
    <h1>Recibo de pagamento</h1>
    <div class="row"><span>Nº</span><strong>${r.numero}</strong></div>
    <div class="row"><span>Emitente</span><strong>${escapeHtml(r.empresaNome)}</strong></div>
    <div class="row"><span>Recebido de</span><strong>${escapeHtml(r.clienteNome)}</strong></div>
    <div class="row"><span>Referente</span><span>${escapeHtml(r.descricao)}</span></div>
    ${r.protocolo ? `<div class="row"><span>Protocolo</span><span>${escapeHtml(r.protocolo)}</span></div>` : ""}
    <div class="row"><span>Forma</span><span>${escapeHtml(r.forma)}</span></div>
    <div class="row"><span>Data</span><span>${data}</span></div>
    <div class="valor">${formatBRL(r.valor)}</div>
    <p>Declaramos ter recebido a quantia acima.</p>
    <div class="foot">Documento gerado pelo LexisPredict — conferir com o extrato bancário.</div>
  </div>
  <script>window.onload = function(){ setTimeout(function(){ window.print(); }, 300); }</script>
</body>
</html>`;
}

function escapeHtml(s: string) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Abre recibo em nova aba para impressão/PDF. */
export function abrirReciboImpressao(r: ReciboData) {
  if (typeof window === "undefined") return;
  const html = gerarReciboHtml(r);
  const w = window.open("", "_blank", "noopener,noreferrer,width=720,height=900");
  if (!w) return;
  w.document.write(html);
  w.document.close();
}

export function numeroRecibo(receberId: string) {
  const d = new Date();
  const ymd = d.toISOString().slice(0, 10).replace(/-/g, "");
  return `REC-${ymd}-${receberId.slice(0, 6).toUpperCase()}`;
}
