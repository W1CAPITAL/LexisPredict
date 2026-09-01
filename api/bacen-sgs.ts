/**
 * BACEN SGS — API pública (Vercel serverless).
 * Tipagem local sem @vercel/node (evita TS2307 no typecheck do Next).
 */
type VercelRequest = {
  method?: string;
  query: Record<string, string | string[] | undefined>;
};
type VercelResponse = {
  setHeader: (k: string, v: string) => void;
  status: (n: number) => VercelResponse;
  json: (b: unknown) => void;
};

export const SERIES: Record<string, { code: number; label: string }> = {
  pessoal: { code: 25464, label: "Crédito pessoal não-consignado PF" },
  consignado: { code: 25468, label: "Crédito pessoal consignado INSS" },
  veiculos: { code: 25471, label: "Aquisição de veículos PF" },
};

function parseBrRate(raw: string): number | null {
  const n = Number(String(raw).replace(",", ".").trim());
  return Number.isFinite(n) ? n : null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "public, max-age=3600");
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const produto = String(req.query.produto || "veiculos").toLowerCase();
  const serie = SERIES[produto] || SERIES.veiculos;
  const dataRef = String(req.query.data || "").trim();
  let dataInicial = "01/01/2020";
  let dataFinal = new Date().toLocaleDateString("pt-BR");

  if (/^\d{4}-\d{2}$/.test(dataRef)) {
    const [y, m] = dataRef.split("-");
    dataInicial = `01/${m}/${y}`;
    const last = new Date(Number(y), Number(m), 0).getDate();
    dataFinal = `${String(last).padStart(2, "0")}/${m}/${y}`;
  } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(dataRef)) {
    dataInicial = dataRef;
    dataFinal = dataRef;
  }

  const url =
    `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${serie.code}/dados` +
    `?formato=json&dataInicial=${encodeURIComponent(dataInicial)}&dataFinal=${encodeURIComponent(dataFinal)}`;

  try {
    const r = await fetch(url);
    if (!r.ok) {
      return res.status(502).json({ error: "BACEN indisponível", status: r.status });
    }
    const rows = (await r.json()) as { data: string; valor: string }[];
    if (!Array.isArray(rows) || !rows.length) {
      return res.status(404).json({ error: "Sem pontos na série para o período" });
    }
    const last = rows[rows.length - 1];
    const taxaMedia = parseBrRate(last.valor);
    return res.status(200).json({
      ok: true,
      produto,
      serie: serie.code,
      label: serie.label,
      data: last.data,
      taxaMediaMensal: taxaMedia,
      taxaMediaAnualApprox:
        taxaMedia != null
          ? Number((Math.pow(1 + taxaMedia / 100, 12) - 1) * 100).toFixed(2)
          : null,
      fonte: "Banco Central do Brasil — SGS (público)",
    });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "Falha BACEN" });
  }
}
