/**
 * Cliente opcional Jusbrasil/Digesto (API comercial).
 * Env: JUSBRASIL_API_KEY ou DIGESTO_API_TOKEN
 * Base: JUSBRASIL_API_BASE (default op.digesto.com.br)
 *
 * Sem chave → não quebra o app; scanner DataJud/DJEN continua sendo a fonte principal.
 */
export type JusbrProcesso = {
  numero?: string;
  tribunal?: string;
  classe?: string;
  situacao?: string;
  movimentos?: Array<{ data?: string; nome?: string; complemento?: string }>;
  raw?: unknown;
  fonte: 'jusbrasil' | 'digesto' | 'indisponivel';
  erro?: string;
};

function apiKey(): string | null {
  return (
    process.env.JUSBRASIL_API_KEY ||
    process.env.DIGESTO_API_TOKEN ||
    process.env.JUSBR_API_KEY ||
    null
  );
}

function baseUrl(): string {
  return (
    process.env.JUSBRASIL_API_BASE ||
    process.env.DIGESTO_API_BASE ||
    'https://op.digesto.com.br'
  ).replace(/\/$/, '');
}

export function isJusbrConfigured(): boolean {
  return !!apiKey();
}

/** Consulta capa/andamentos por CNJ (quando há chave). */
export async function consultarProcessoJusbr(cnj: string): Promise<JusbrProcesso> {
  const key = apiKey();
  const numero = String(cnj || '').trim();
  if (!key) {
    return {
      fonte: 'indisponivel',
      erro: 'Sem JUSBRASIL_API_KEY / DIGESTO_API_TOKEN no ambiente.',
    };
  }
  if (!numero) {
    return { fonte: 'indisponivel', erro: 'CNJ vazio' };
  }

  const url = `${baseUrl()}/api/base-judicial/tribproc/${encodeURIComponent(numero)}`;
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      next: { revalidate: 0 },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return {
        fonte: 'jusbrasil',
        erro: `HTTP ${res.status}: ${text.slice(0, 180)}`,
      };
    }
    const data = await res.json();
    const movs = Array.isArray(data?.movimentos)
      ? data.movimentos
      : Array.isArray(data?.andamentos)
        ? data.andamentos
        : [];
    return {
      numero: data?.numero || numero,
      tribunal: data?.tribunal || data?.tribunal_cnj || undefined,
      classe: data?.classeNatureza || data?.classe || (Array.isArray(data?.classes) ? data.classes[0] : undefined),
      situacao: data?.situacao || data?.status || undefined,
      movimentos: movs.slice(0, 40).map((m: any) => ({
        data: m.data || m.dataHora || m.date,
        nome: m.nome || m.descricao || m.texto || m.movimento,
        complemento: m.complemento || m.conteudo,
      })),
      raw: data,
      fonte: 'jusbrasil',
    };
  } catch (e: any) {
    return { fonte: 'indisponivel', erro: e?.message || 'Falha de rede JusBR' };
  }
}
