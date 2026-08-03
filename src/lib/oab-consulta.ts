/**
 * Consulta cadastral de advogado (OAB / CNA).
 *
 * Não existe API pública oficial estável e gratuita da OAB nacional para todos os estados.
 * Estratégia:
 *  1) Validação de formato (UF + número)
 *  2) Tentativa de consulta via endpoint público do CNA (quando acessível do servidor)
 *  3) Fallback: dados manuais + link oficial para o usuário confirmar
 *
 * Uso: preencher formulário da banca / validar OAB na procuração.
 */

export type OabConsultaResult = {
  success: boolean;
  source: "cna" | "manual" | "validacao";
  nome?: string;
  oabNumero: string;
  oabUf: string;
  situacao?: string;
  inscricaoTipo?: string; // definitivo, suplementar, etc.
  raw?: string;
  error?: string;
  consultaUrl: string;
};

const UF_SET = new Set([
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
  "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
]);

export function normalizeOabNumero(num: string): string {
  return String(num || "").replace(/\D/g, "");
}

export function isValidOabUf(uf: string): boolean {
  return UF_SET.has(String(uf || "").toUpperCase());
}

export function buildCnaSearchUrl(uf: string, numero: string): string {
  const n = normalizeOabNumero(numero);
  const u = String(uf || "").toUpperCase();
  // Portal público do Cadastro Nacional dos Advogados
  return `https://cna.oab.org.br/?uf=${encodeURIComponent(u)}&nroOab=${encodeURIComponent(n)}`;
}

/**
 * Best-effort: alguns ambientes conseguem HTML do CNA; outros bloqueiam datacenter.
 * Nunca inventa nome — só preenche se extrair com confiança.
 */
export async function consultarOabCna(uf: string, numero: string): Promise<OabConsultaResult> {
  const oabUf = String(uf || "").toUpperCase();
  const oabNumero = normalizeOabNumero(numero);
  const consultaUrl = buildCnaSearchUrl(oabUf, oabNumero);

  if (!isValidOabUf(oabUf) || !oabNumero) {
    return {
      success: false,
      source: "validacao",
      oabNumero,
      oabUf,
      error: "Informe UF válida e número da OAB.",
      consultaUrl,
    };
  }

  try {
    // Tentativa leve: página inicial com query (pode não retornar JSON).
    const res = await fetch(consultaUrl, {
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; LexisPredict/1.0; +https://github.com/daviconcentrix-debug/LexisPredict)",
        Accept: "text/html,application/json",
      },
      signal: AbortSignal.timeout(12000),
      redirect: "follow",
    });

    const ct = res.headers.get("content-type") || "";
    const body = await res.text();

    if (ct.includes("application/json")) {
      try {
        const j = JSON.parse(body);
        const nome = j?.nome || j?.Nome || j?.name;
        const situacao = j?.situacao || j?.Situacao;
        if (nome) {
          return {
            success: true,
            source: "cna",
            nome: String(nome).toUpperCase(),
            oabNumero,
            oabUf,
            situacao: situacao ? String(situacao) : undefined,
            consultaUrl,
            raw: body.slice(0, 500),
          };
        }
      } catch {
        /* */
      }
    }

    // Heurística HTML (muito frágil — só se achar padrão claro)
    const nomeMatch =
      body.match(/class="[^"]*nome[^"]*"[^>]*>([^<]{5,120})</i) ||
      body.match(/"Nome"\s*:\s*"([^"]{5,120})"/);

    if (nomeMatch?.[1] && !/oab|consulta|cadastro/i.test(nomeMatch[1])) {
      return {
        success: true,
        source: "cna",
        nome: nomeMatch[1].trim().toUpperCase(),
        oabNumero,
        oabUf,
        consultaUrl,
      };
    }

    return {
      success: false,
      source: "cna",
      oabNumero,
      oabUf,
      error:
        "CNA não retornou dados legíveis deste servidor (bloqueio comum). Use o link oficial e preencha manualmente.",
      consultaUrl,
    };
  } catch (e: any) {
    return {
      success: false,
      source: "cna",
      oabNumero,
      oabUf,
      error: e?.message || "Falha de rede ao consultar CNA.",
      consultaUrl,
    };
  }
}
