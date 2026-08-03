"use server";

export type OabResult = {
  success: boolean;
  nome?: string;
  situacao?: string;
  oabNumero: string;
  oabUf: string;
  error?: string;
  consultaUrl: string;
};

export async function consultarOabAction(uf: string, numero: string): Promise<OabResult> {
  const oabUf = String(uf || "").toUpperCase();
  const oabNumero = String(numero || "").replace(/\D/g, "");
  const consultaUrl = `https://cna.oab.org.br/?uf=${encodeURIComponent(oabUf)}&nroOab=${encodeURIComponent(oabNumero)}`;

  if (!oabUf || !oabNumero) {
    return { success: false, oabNumero, oabUf, error: "UF e número obrigatórios", consultaUrl };
  }

  try {
    const res = await fetch(consultaUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; LexisPredict/1.0)",
        Accept: "text/html,application/json",
      },
      signal: AbortSignal.timeout(12000),
      redirect: "follow",
    });
    const body = await res.text();
    const ct = res.headers.get("content-type") || "";

    if (ct.includes("json")) {
      try {
        const j = JSON.parse(body);
        const nome = j?.nome || j?.Nome;
        if (nome) {
          return {
            success: true,
            nome: String(nome).toUpperCase(),
            situacao: j?.situacao ? String(j.situacao) : undefined,
            oabNumero,
            oabUf,
            consultaUrl,
          };
        }
      } catch {
        /* */
      }
    }

    return {
      success: false,
      oabNumero,
      oabUf,
      error: "CNA não retornou dados legíveis deste servidor (bloqueio comum em cloud).",
      consultaUrl,
    };
  } catch (e: any) {
    return {
      success: false,
      oabNumero,
      oabUf,
      error: e?.message || "Falha de rede na consulta OAB",
      consultaUrl,
    };
  }
}
