/**
 * @fileOverview Serviço DataJud (CNJ) v480 — BOTH não sacrifica o tribunal
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 */

import { perfCached, PerfKeys, perfLog, perfNow } from '@/lib/performance-motor';

export const COURT_ALIASES: Record<string, string> = {
  "8.01": "tjac", "8.02": "tjal", "8.03": "tjap", "8.04": "tjam", "8.05": "tjba",
  "8.06": "tjce", "8.07": "tjdft", "8.08": "tjes", "8.09": "tjgo", "8.10": "tjma",
  "8.11": "tjmt", "8.12": "tjms", "8.13": "tjmg", "8.14": "tjpa", "8.15": "tjpb",
  "8.16": "tjpr", "8.17": "tjpe", "8.18": "tjpi", "8.19": "tjrj", "8.20": "tjrn",
  "8.21": "tjrs", "8.22": "tjro", "8.23": "tjrr", "8.24": "tjsc", "8.25": "tjse",
  "8.26": "tjsp", "8.27": "tjto", "4.01": "trf1", "4.02": "trf2", "4.03": "trf3",
  "4.04": "trf4", "4.05": "trf5", "4.06": "trf6"
};

/** Chave DataJud: prefira env. Fallback = chave PÚBLICA oficial do CNJ (API pública). */
const DATAJUD_PUBLIC_KEY = 'cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==';
const DATAJUD_API_KEY = (process.env.DATAJUD_API_KEY || '').trim() || DATAJUD_PUBLIC_KEY;

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export interface DataJudOptions {
  /** true = scanner em lote (ainda tenta de verdade o tribunal) */
  fast?: boolean;
}


/** Extrai nomes de polo ativo e passivo a partir do array partes do DataJud. */
export function extrairPolos(partes: any[]): { ativo: string[]; passivo: string[]; outros: string[] } {
  const ativo: string[] = [];
  const passivo: string[] = [];
  const outros: string[] = [];
  for (const p of partes || []) {
    const nome = String(
      p?.nome || p?.nomeParte || p?.razaoSocial || p?.nomePessoa || p?.pessoa?.nome || ''
    ).trim();
    if (!nome || nome.length < 3) continue;
    // ignora advogados listados como "parte"
    const tipoParte = String(p?.tipo || p?.tipoParte || p?.qualificacao || '').toUpperCase();
    if (/ADVOGADO|OAB|PROCURADOR|REPRESENTANTE/.test(tipoParte) && !/AUTOR|R[EÉ]U|REQUER/.test(tipoParte)) {
      if (!outros.includes(nome)) outros.push(nome);
      continue;
    }
    const poloRaw = p?.polo ?? p?.tipoPolo ?? p?.codigoPolo ?? p?.poloProcessual ?? '';
    const polo =
      typeof poloRaw === 'object'
        ? String(poloRaw?.codigo || poloRaw?.nome || poloRaw?.descricao || '').toUpperCase()
        : String(poloRaw).toUpperCase();
    if (/ATIVO|^A$|^AT$|AUTOR|REQUERENTE|EXEQUENTE|APELANTE|AGRAVANTE|IMPETRANTE|RECLAMANTE|POLO\s*AT/.test(polo)) {
      if (!ativo.includes(nome)) ativo.push(nome);
    } else if (/PASSIVO|^P$|^PA$|R[EÉ]U|REQUERIDO|EXECUTADO|APELADO|AGRAVADO|IMPETRADO|RECLAMADO|POLO\s*PA/.test(polo)) {
      if (!passivo.includes(nome)) passivo.push(nome);
    } else if (polo.includes('AT') && !polo.includes('PA')) {
      if (!ativo.includes(nome)) ativo.push(nome);
    } else if (polo.includes('PA') || polo === 'P') {
      if (!passivo.includes(nome)) passivo.push(nome);
    } else {
      if (!outros.includes(nome)) outros.push(nome);
    }
  }
  // Se so ha "outros", heuristica: primeiro pessoa fisica ~ ativo, juridica/banco ~ passivo
  if (!ativo.length && !passivo.length && outros.length) {
    const isBank = (n: string) => /BANCO|S\.?A\.?|LTDA|FINANCEIRA|CREDITO|SEGURADORA|CAIXA ECON/.test(n.toUpperCase());
    for (const n of outros) {
      if (isBank(n)) {
        if (!passivo.includes(n)) passivo.push(n);
      } else if (!ativo.includes(n)) {
        ativo.push(n);
      }
    }
  }
  return { ativo, passivo, outros };
}

/**
 * Busca processos no DataJud por nome de parte (não há índice oficial de CPF).
 * Varre aliases informados (padrão: principais TJs).
 */
export async function searchDataJudByNome(
  nome: string,
  opts?: { aliases?: string[]; size?: number; classeCodigo?: number }
): Promise<{ success: boolean; items: any[]; error?: string }> {
  const q = String(nome || '').trim();
  if (q.length < 5) return { success: false, items: [], error: 'Nome muito curto' };

  const aliases = opts?.aliases || [
    'tjsp', 'tjrj', 'tjmg', 'tjba', 'tjrs', 'tjpr', 'tjsc', 'tjgo', 'tjpe', 'tjce', 'tjdft'
  ];
  const size = opts?.size || 5;
  const items: any[] = [];

  for (const alias of aliases) {
    if (items.length >= 20) break;
    try {
      const url = `https://api-publica.datajud.cnj.jus.br/api_publica_${alias}/_search`;
      const must: any[] = [{ match: { 'partes.nome': { query: q, operator: 'and' } } }];
      if (opts?.classeCodigo) {
        must.push({ match: { 'classe.codigo': opts.classeCodigo } });
      }
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 25000);
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `APIKey ${DATAJUD_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ size, query: { bool: { must } } }),
        signal: controller.signal,
        cache: 'no-store',
      });
      clearTimeout(id);
      if (!response.ok) continue;
      const data = await response.json();
      for (const hit of data.hits?.hits || []) {
        const source = hit._source || {};
        const partesRaw = Array.isArray(source.partes) ? source.partes : [];
        const polos = extrairPolos(partesRaw);
        items.push({
          numeroProcesso: source.numeroProcesso,
          classe: source.classe?.nome || 'N/A',
          classeCodigo: source.classe?.codigo ?? null,
          grau: source.grau || null,
          tribunal: source.tribunal || alias.toUpperCase(),
          orgaoJulgador: source.orgaoJulgador?.nome || null,
          poloAtivo: polos.ativo,
          poloPassivo: polos.passivo,
          partes: partesRaw,
          dataAjuizamento: source.dataAjuizamento || null,
        });
      }
    } catch {
      // tribunal offline — segue
    }
  }

  return { success: true, items };
}



/**
 * Busca processos no DataJud por CPF/CNPJ da parte.
 * Tenta vários campos usados pelos tribunais (schema não é uniforme).
 * Retorna lista com polo ativo/passivo e classe (inclui BA, revisional, etc.).
 */
export async function searchDataJudByCpf(
  documento: string,
  opts?: { aliases?: string[]; size?: number; onlyBA?: boolean }
): Promise<{ success: boolean; items: any[]; error?: string }> {
  const digits = String(documento || '').replace(/\D/g, '');
  if (digits.length < 11) {
    return { success: false, items: [], error: 'CPF/CNPJ inválido (mín. 11 dígitos)' };
  }

  const aliases = opts?.aliases || [
    'tjsp', 'tjrj', 'tjmg', 'tjba', 'tjrs', 'tjpr', 'tjsc', 'tjgo', 'tjpe', 'tjce',
    'tjdft', 'tjes', 'tjmt', 'tjms', 'tjma', 'tjpb', 'tjrn', 'tjpi', 'tjal', 'tjse',
  ];
  const size = opts?.size || 8;
  const items: any[] = [];
  const seen = new Set<string>();

  // Campos possíveis de documento nos índices (varia por tribunal)
  const docFields = [
    'partes.numeroDocumentoPrincipal',
    'partes.numeroDocumento',
    'partes.documento',
    'partes.cpfCnpj',
    'partes.cpf',
    'partes.cnpj',
  ];

  for (const alias of aliases) {
    if (items.length >= 30) break;
    try {
      const url = `https://api-publica.datajud.cnj.jus.br/api_publica_${alias}/_search`;
      const should = docFields.map((f) => ({ match: { [f]: digits } }));
      // Também tenta com máscara parcial de CPF (xxx.xxx.xxx-xx) se 11 dígitos
      if (digits.length === 11) {
        const masked = `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
        should.push({ match: { 'partes.numeroDocumentoPrincipal': masked } as any });
        should.push({ match: { 'partes.documento': masked } as any });
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 28000);
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `APIKey ${DATAJUD_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          size,
          query: { bool: { should, minimum_should_match: 1 } },
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!response.ok) continue;
      const data = await response.json();
      // Skill: 200 parcial com shards failed → não confiar em "vazio" absoluto
      const hits = data?.hits?.hits;
      if (!Array.isArray(hits)) continue;

      for (const hit of hits) {
        const source = hit?._source;
        if (!source) continue;
        const num = String(source.numeroProcesso || '').replace(/\D/g, '');
        if (!num || seen.has(num)) continue;

        // Confirma se alguma parte realmente carrega o documento (reduz falso positivo)
        const partesRaw = Array.isArray(source.partes) ? source.partes : [];
        const docHit = partesRaw.some((p: any) => {
          const blob = `${p?.numeroDocumentoPrincipal || ''} ${p?.numeroDocumento || ''} ${p?.documento || ''} ${p?.cpf || ''} ${p?.cnpj || ''} ${p?.cpfCnpj || ''}`.replace(/\D/g, '');
          return blob.includes(digits);
        });
        // Se o tribunal não expõe o doc nas partes, ainda aceita o hit do ES
        if (partesRaw.length > 0 && !docHit && digits.length >= 11) {
          // mantém se o match veio do índice mesmo sem echo no _source
        }

        const classeNome = String(source.classe?.nome || source.classe?.codigo || '').toUpperCase();
        const isBA = /BUSCA\s+E\s+APREENS/.test(classeNome);
        if (opts?.onlyBA && !isBA) continue;

        seen.add(num);
        const polos = extrairPolos(partesRaw);
        items.push({
          numeroProcesso: source.numeroProcesso || num,
          tribunal: source.tribunal || alias.toUpperCase(),
          grau: source.grau || null,
          classe: source.classe?.nome || source.classe?.codigo || null,
          classeCodigo: source.classe?.codigo ?? null,
          orgaoJulgador: source.orgaoJulgador?.nome || null,
          dataAjuizamento: source.dataAjuizamento || null,
          poloAtivo: polos.ativo,
          poloPassivo: polos.passivo,
          partes: partesRaw,
          isBuscaApreensao: isBA,
          alias,
        });
      }
    } catch {
      // timeout / rede — tenta próximo tribunal
      continue;
    }
  }

  return { success: true, items, error: items.length === 0 ? 'Nenhum processo encontrado para este documento nos tribunais consultados.' : undefined };
}

export async function fetchDataJud(cnj: string, attempt = 1, options: DataJudOptions = {}): Promise<any> {
  // Cache + dedupe só na 1ª tentativa (retries ficam fora do cache hit)
  if (attempt === 1) {
    const key = PerfKeys.datajud(cnj, options.fast === true);
    return perfCached(key, () => fetchDataJudUncached(cnj, 1, options), options.fast ? 60_000 : 120_000);
  }
  return fetchDataJudUncached(cnj, attempt, options);
}

async function fetchDataJudUncached(cnj: string, attempt = 1, options: DataJudOptions = {}): Promise<any> {
  const cnjLimpo = cnj.replace(/\D/g, '');
  const startTime = Date.now();

  if (cnjLimpo.length !== 20) {
    return { numeroProcesso: cnj, movimentos: [], error: true, message: "CNJ inválido.", attempts: attempt };
  }

  const aliasPart = `${cnjLimpo[13]}.${cnjLimpo.substring(14, 16)}`;
  const alias = COURT_ALIASES[aliasPart] || "tjsp";
  const url = `https://api-publica.datajud.cnj.jus.br/api_publica_${alias}/_search`;

  const isFast = options.fast === true;
  // ANTES: fast=15s/1 tentativa → DJEN ganhava e DataJud “sumia”
  // AGORA: fast ainda dá tempo real ao tribunal + 1 retry
  const timeoutMs = isFast ? 28000 : 40000;
  const maxAttempts = isFast ? 2 : 3;

  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `APIKey ${DATAJUD_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        size: 1,
        query: { match: { numeroProcesso: cnjLimpo } }
      }),
      signal: controller.signal,
      cache: 'no-store'
    });

    clearTimeout(id);
    const latency = Date.now() - startTime;

    if (response.status === 429) {
      if (attempt < maxAttempts) {
        await sleep(1200 * attempt + Math.random() * 400);
        return fetchDataJudUncached(cnj, attempt + 1, options);
      }
      return {
        numeroProcesso: cnjLimpo,
        movimentos: [],
        error: true,
        message: "Taxa excedida (429).",
        latency,
        attempts: attempt
      };
    }

    if (response.status >= 500 && attempt < maxAttempts) {
      await sleep(800 * attempt);
      return fetchDataJudUncached(cnj, attempt + 1, options);
    }

    if (!response.ok) {
      return {
        numeroProcesso: cnjLimpo,
        movimentos: [],
        error: true,
        message: `HTTP ${response.status}`,
        latency,
        attempts: attempt
      };
    }

    const data = await response.json();

    if (data._shards?.failed > 0 && (!data.hits?.hits || data.hits.hits.length === 0)) {
      if (attempt < maxAttempts) {
        await sleep(600);
        return fetchDataJudUncached(cnj, attempt + 1, options);
      }
      return {
        numeroProcesso: cnjLimpo,
        movimentos: [],
        error: true,
        message: "Tribunal instável (shard).",
        latency,
        attempts: attempt
      };
    }

    const source = data.hits?.hits?.[0]?._source;
    if (!source) {
      return {
        numeroProcesso: cnjLimpo,
        movimentos: [],
        error: false,
        message: "Não localizado no DataJud.",
        latency,
        attempts: attempt
      };
    }

    const partesRaw = Array.isArray(source.partes) ? source.partes : [];
    const polos = extrairPolos(partesRaw);

    return {
      numeroProcesso: source.numeroProcesso || cnjLimpo,
      classe: source.classe?.nome || source.classe?.codigo || 'N/A',
      classeCodigo: source.classe?.codigo ?? null,
      grau: source.grau || null,
      tribunal: source.tribunal || alias.toUpperCase(),
      orgaoJulgador: source.orgaoJulgador?.nome || source.orgaoJulgador?.codigo || null,
      movimentos: Array.isArray(source.movimentos) ? source.movimentos : [],
      dataAjuizamento: source.dataAjuizamento || null,
      partes: partesRaw,
      poloAtivo: polos.ativo,
      poloPassivo: polos.passivo,
      error: false,
      latency,
      attempts: attempt
    };
  } catch (e: any) {
    const latency = Date.now() - startTime;
    const isTimeout =
      e?.name === 'AbortError' ||
      e?.name === 'TimeoutError' ||
      String(e?.message || '').toLowerCase().includes('timeout');

    if (isTimeout && attempt < maxAttempts) {
      await sleep(700 * attempt);
      return fetchDataJudUncached(cnj, attempt + 1, options);
    }

    return {
      numeroProcesso: cnjLimpo,
      movimentos: [],
      error: true,
      message: isTimeout ? "Tempo esgotado no tribunal." : "Falha técnica DataJud.",
      latency,
      attempts: attempt
    };
  }
}
