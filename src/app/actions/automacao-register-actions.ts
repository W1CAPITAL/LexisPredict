/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * Cadastro de processo → carteira + enriquecimento CNJ exclusivo via DJEN (rápido).
 * REGRA Next.js: neste arquivo só export async function (+ types/interfaces).
 */
'use server';

import {
  getStoredCasesForEmpresa,
  saveStoredCasesForEmpresa,
  getUserContext,
} from '@/lib/server-db';
import { processarCaso, type LegalCase, extrairTribunal } from '@/lib/case-logic';
import {
  digitsOnly,
  formatCnj,
  extractCnjFromText,
} from '@/lib/cnj-extract';
import { cpfValido, cnpjValido } from '@/lib/cpf-cnpj';
import { fetchDjenComunicacoes, plainTextFromDjen } from '@/lib/djen';

export interface AutomacaoCadastroInput {
  protocolo: string;
  cliente: string;
  telefone?: string;
  tribunal?: string;
  classificacao?: string;
  ofensor?: string;
  observacao?: string;
  textoTribunal?: string;
  /** Campos estilo Astrea */
  cpf?: string;
  email?: string;
  estado_civil?: string;
  emprego?: string;
  nacionalidade?: string;
  parte_passiva?: string;
  parte_passiva_cnpj?: string;
  classe_acao?: string;
  orgao_julgador?: string;
  advogado?: string;
  advogado_passivo?: string;
  escritorio?: string;
  proximoPrazo?: string;
  situacao?: string;
}

export interface CadastroEnrichResult {
  success: boolean;
  error?: string;
  protocolo?: string;
  cliente?: string;
  parte_passiva?: string;
  parte_passiva_cnpj?: string;
  /** Advogado mais recente do polo ATIVO (cliente) */
  advogado?: string;
  /** Advogado mais recente do polo PASSIVO (réu/banco) */
  advogado_passivo?: string;
  classe_acao?: string;
  tribunal?: string;
  orgao_julgador?: string;
  dataAjuizamento?: string | null;
  poloAtivo?: string[];
  poloPassivo?: string[];
  djenCount?: number;
  djenResumo?: string | null;
  movimentosResumo?: string | null;
  fonte?: string;
  cpf?: string;
  email?: string;
  telefone?: string;
}


function pickAdvogadoFromPartes(partes: any[]): string {
  for (const p of partes || []) {
    const reps = p?.representantes || p?.advogados || p?.advogado || p?.representanteProcessual || [];
    const list = Array.isArray(reps) ? reps : [reps];
    for (const r of list) {
      if (!r) continue;
      const nome = String(r?.nome || r?.nomeAdvogado || (typeof r === 'string' ? r : '')).trim();
      if (nome && nome.length > 3 && !/BANCO|S\.?A\.?|LTDA/.test(nome.toUpperCase())) {
        return nome.toUpperCase();
      }
    }
    const tipo = String(p?.tipo || p?.tipoParte || '').toUpperCase();
    if (/ADVOGADO|OAB/.test(tipo)) {
      const nome = String(p?.nome || '').trim();
      if (nome) return nome.toUpperCase();
    }
  }
  return '';
}

function extractCnpjFromText(text: string): string | null {
  const matches = text.matchAll(/\b(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})\b/g);
  for (const m of matches) {
    const d = m[1].replace(/\D/g, '');
    if (d.length === 14 && cnpjValido(d)) return d;
  }
  return null;
}

function extractCpfFromText(text: string): string | null {
  const matches = text.matchAll(/\b(\d{3}\.?\d{3}\.?\d{3}-?\d{2})\b/g);
  for (const m of matches) {
    const d = m[1].replace(/\D/g, '');
    if (d.length === 11 && cpfValido(d)) return d;
  }
  return null;
}

function extractEmailFromText(text: string): string | null {
  const m = text.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
  return m ? m[0].toLowerCase() : null;
}

function extractPhoneFromText(text: string): string | null {
  const m = text.match(/(?:\(\d{2}\)\s?)?\d?[\s.-]?\d{4,5}[\s-]?\d{4}(?!\d)/);
  return m ? m[0].replace(/[^\d+]/g, '') : null;
}


/** Limpa nome de parte: corta lixo processual colado pelo DJEN. */
function cleanParteNome(raw: string): string {
  let s = String(raw || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
  if (!s) return '';

  // corta em ruído típico de intimação
  s = s.split(
    /\s+(?:ATO\s+ORDINAT|EM\s+CUMPRIMENTO|PROVIMENTO|DISPONIBILIZ|INTIMA[CÇ][AÃ]O|PUBLICA[CÇ][AÃ]O|CERTID[AÃ]O|DESPACHO|DECIS[AÃ]O|SENTEN[CÇ]A|AO\s+DISPOSTO|NOS\s+TERMOS|FICA\s+INTIMAD|PARA\s+CI[EÊ]NCIA)/i
  )[0].trim();

  // razão social de banco no início
  const bank = s.match(
    /^(BANCO\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ0-9\s\.\&\-]+?(?:S\.?\s*A\.?|S\/A|LTDA\.?)?)/
  );
  if (bank) return bank[1].replace(/\s+/g, ' ').trim().slice(0, 90);

  // pessoa física: até 6–8 palavras antes de ruído
  const words = s.split(' ').filter(Boolean);
  if (words.length > 8 && !/BANCO|S\/A|LTDA/.test(s)) {
    s = words.slice(0, 7).join(' ');
  }
  return s.slice(0, 100).trim();
}

function extractPossibleBankName(text: string): string | null {
  const upper = text.toUpperCase();
  const banks = [
    'BANCO DO BRASIL', 'BANCO ITAÚ', 'BANCO ITAU', 'ITAÚ UNIBANCO', 'ITAU UNIBANCO',
    'BANCO BRADESCO', 'BANCO SANTANDER', 'CAIXA ECONÔMICA', 'CAIXA ECONOMICA',
    'NUBANK', 'BANCO INTER', 'BANCO PAN', 'BANCO BMG', 'BANCO C6', 'BANCO SAFRA',
    'BANCO ORIGINAL', 'BANCO DAYCOVAL', 'BANCO VOTORANTIM', 'BANCO MERCANTIL',
    'CREFISA', 'LOSANGO', 'FINASA', 'BANCO AGIBANK', 'BANCO MASTER',
  ];
  for (const b of banks) {
    if (upper.includes(b)) return b;
  }
  // razão social genérica
  const m = upper.match(
    /\b((?:BANCO|FINANCEIRA|CREDITO|CRÉDITO|SEGURADORA)[A-ZÁÉÍÓÚÂÊÔÃÕÇ0-9\s\.\,\&\-]{3,60}(?:S\.?\s*A\.?|LTDA\.?|S\/A)?)/
  );
  if (m) return m[1].trim().replace(/\s+/g, ' ');
  return null;
}

/** Extrai autor/réu de texto de intimação / publicação */
function parsePartesFromTexto(text: string): {
  ativo: string[];
  passivo: string[];
  advogados: string[];
  advogadosAtivo: string[];
  advogadosPassivo: string[];
} {
  const ativo: string[] = [];
  const passivo: string[] = [];
  const advogados: string[] = [];
  const advogadosAtivo: string[] = [];
  const advogadosPassivo: string[] = [];
  if (!text) return { ativo, passivo, advogados, advogadosAtivo, advogadosPassivo };

  const lines = text.replace(/\r/g, '\n').split('\n').map((l) => l.trim()).filter(Boolean);
  const blob = text.replace(/\s+/g, ' ');

  const pushUnique = (arr: string[], v: string) => {
    const n = cleanParteNome(v);
    if (n.length < 5 || n.length > 120) return;
    if (/ADVOGADO|OAB|DR\.|DRA\./.test(n) && !/BANCO/.test(n)) return;
    if (/ATO ORDINAT|CUMPRIMENTO AO|PROVIMENTO DO CONSELHO/.test(n)) return;
    if (!arr.includes(n)) arr.push(n);
  };

  const pushAdv = (arr: string[], v: string) => {
    const n = v.replace(/\s+/g, ' ').trim().toUpperCase();
    if (n.length < 5 || n.length > 90) return;
    if (/BANCO|TRIBUNAL|JUIZO|VARA|CARTORIO|MINIST[EÉ]RIO/.test(n)) return;
    if (!arr.includes(n)) arr.push(n);
  };

  // Padrões rotulados de partes
  const patternsAtivo = [
    /(?:AUTOR(?:A|ES)?|REQUERENTE|EXEQUENTE|RECLAMANTE|APELANTE|AGRAVANTE|IMPETRANTE)\s*[:\-–]\s*([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇa-záéíóúâêôãõç\s\.]+?)(?:\s*[-–,;]|\s+CPF|\s+RG|\s+OAB|\s+e\s|\s+x\s|\s+versus)/i,
    /(?:AUTOR(?:A|ES)?|REQUERENTE)\s*[:\-–]\s*([^\n\r;]{5,80})/i,
    // Estilo DJEN / cabeçalho CNJ: "AUTOR : FULANO DE TAL ADVOGADO(A) :"
    /\bAUTOR(?:A)?\s*:\s*([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇa-záéíóúâêôãõç\s]{4,70}?)(?:\s+ADVOGAD|\s+CPF|\s+RG|\s+R[EÉ]U|\s+REQUERID|$)/i,
    /\bREQUERENTE\s*:\s*([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇa-záéíóúâêôãõç\s]{4,70}?)(?:\s+ADVOGAD|\s+CPF|\s+R[EÉ]U|$)/i,
    // "em face de BANCO..." → o que vem antes pode ser autor em frases curtas
    /(?:promovida\s+por|proposta\s+por|ajuizada\s+por)\s+([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇa-záéíóúâêôãõç\s]{4,60}?)(?:\s+em\s+face|\s+contra|\s+x\s)/i,
  ];
  const patternsPassivo = [
    /(?:R[EÉ]U|REQUERID[OA]|EXECUTAD[OA]|RECLAMAD[OA]|APELAD[OA]|AGRAVAD[OA]|IMPETRAD[OA])\s*[:\-–]\s*([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇa-záéíóúâêôãõç0-9\s\.\&\-]+?)(?:\s*[-–,;]|\s+CNPJ|\s+CPF|\s+OAB|\s+e\s)/i,
    /(?:R[EÉ]U|REQUERID[OA])\s*[:\-–]\s*([^\n\r;]{5,90})/i,
  ];

  for (const re of patternsAtivo) {
    const m = blob.match(re);
    if (m?.[1]) pushUnique(ativo, m[1]);
  }
  for (const re of patternsPassivo) {
    const m = blob.match(re);
    if (m?.[1]) pushUnique(passivo, m[1]);
  }

  // "FULANO x BANCO..."
  const vs = blob.match(
    /([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇ\s]{4,50}?)\s+(?:x|versus|vs\.?|contra)\s+([A-ZÁÉÍÓÚÂÊÔÃÕÇ0-9][A-ZÁÉÍÓÚÂÊÔÃÕÇ0-9\s\.\&\-]{3,60})/i
  );
  if (vs) {
    pushUnique(ativo, vs[1]);
    pushUnique(passivo, vs[2]);
  }

  // Advogado do AUTOR / polo ativo
  const advAtivoRes = [
    /(?:ADVOGAD[OA]\s+d[oa]\s+(?:AUTOR|REQUERENTE|EXEQUENTE|RECLAMANTE)|PELO\s+AUTOR|PELA\s+AUTORA)\s*[:\-–,]?\s*(?:Dr\.?a?\s*)?([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇa-záéíóúâêôãõç\s]{4,55}?)(?:\s*[-–,]\s*)?(?:OAB|CPF|,|\.|$)/gi,
    /(?:AUTOR(?:A)?|REQUERENTE)[^\n]{0,40}?ADVOGAD[OA]\s*[:\-–]?\s*(?:Dr\.?a?\s*)?([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇa-záéíóúâêôãõç\s]{4,55}?)(?:\s*OAB|\s*[-–,])/gi,
  ];
  for (const re of advAtivoRes) {
    let om: RegExpExecArray | null;
    while ((om = re.exec(blob)) !== null) pushAdv(advogadosAtivo, om[1]);
  }

  // Advogado do RÉU / polo passivo
  const advPassRes = [
    /(?:ADVOGAD[OA]\s+d[oa]\s+(?:R[EÉ]U|REQUERID[OA]|EXECUTAD[OA]|RECLAMAD[OA])|PELO\s+R[EÉ]U|PELA\s+R[EÉ])\s*[:\-–,]?\s*(?:Dr\.?a?\s*)?([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇa-záéíóúâêôãõç\s]{4,55}?)(?:\s*[-–,]\s*)?(?:OAB|CPF|,|\.|$)/gi,
    /(?:R[EÉ]U|REQUERID[OA])[^\n]{0,40}?ADVOGAD[OA]\s*[:\-–]?\s*(?:Dr\.?a?\s*)?([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇa-záéíóúâêôãõç\s]{4,55}?)(?:\s*OAB|\s*[-–,])/gi,
  ];
  for (const re of advPassRes) {
    let om: RegExpExecArray | null;
    while ((om = re.exec(blob)) !== null) pushAdv(advogadosPassivo, om[1]);
  }

  // OAB genérico (ordem = aparição; mais recente se corpus estiver do mais novo ao mais antigo)
  const oabRe = /(?:Dr\.?a?|Advogad[oa])\s+([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇa-záéíóúâêôãõç\s]{4,50}?)(?:\s*[-–,]\s*)?OAB/gi;
  let om: RegExpExecArray | null;
  while ((om = oabRe.exec(blob)) !== null) {
    pushAdv(advogados, om[1]);
  }
  const oab2 = blob.matchAll(
    /([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇ\s]{5,45})\s*[-–,]?\s*OAB\s*[/:]?\s*[A-Z]{2}\s*\d{3,7}/gi
  );
  for (const m of oab2) {
    pushAdv(advogados, m[1]);
  }

  const bank = extractPossibleBankName(text);
  if (bank) pushUnique(passivo, bank);

  return { ativo, passivo, advogados, advogadosAtivo, advogadosPassivo };
}

/**
 * Enriquecimento por CNJ — EXCLUSIVO DJEN (sem DataJud).
 * Mais rápido; preenche polo ativo, passivo, classe, órgão, advogado, CPF/CNPJ quando o teor traz.
 */
export async function enrichCadastroByCnjAction(
  cnjInput: string
): Promise<CadastroEnrichResult> {
  try {
    const protocolo = formatCnj(cnjInput);
    const dig = digitsOnly(protocolo);
    if (dig.length !== 20) {
      return { success: false, error: 'CNJ inválido (20 dígitos).' };
    }

    const tribMeta = extrairTribunal(protocolo);
    // Janela ampla (24 meses) + tribunal: DJEN costuma não listar autor nas intimações recentes
    const djenOpts = {
      siglaTribunal: tribMeta.tribunal !== 'Outros' ? tribMeta.tribunal : undefined,
      dataInicio: new Date(Date.now() - 730 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      dataFim: new Date().toISOString().split('T')[0],
    };

    let djen = await fetchDjenComunicacoes(protocolo, djenOpts);

    let cliente = '';
    let parte_passiva = '';
    let parte_passiva_cnpj = '';
    let advogado = '';
    let advogado_passivo = '';
    const advsAtivoOrd: string[] = [];
    const advsPassivoOrd: string[] = [];
    let classe_acao = '';
    let orgao_julgador = '';
    let tribunal = tribMeta.tribunal;
    let dataAjuizamento: string | null = null;
    let poloAtivo: string[] = [];
    let poloPassivo: string[] = [];
    let cpfHint: string | null = null;
    let emailHint: string | null = null;
    let telefoneHint: string | null = null;
    let djenResumo: string | null = null;
    let djenCount = 0;

    if (!djen?.success || !djen.items?.length) {
      // 2ª tentativa: sem filtro de tribunal + janela 365 dias (só se vazio)
      const djen2 = await fetchDjenComunicacoes(protocolo, {
        dataInicio: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        dataFim: new Date().toISOString().split('T')[0],
      });
      if (!djen2?.success || !djen2.items?.length) {
        return {
          success: false,
          error:
            djen?.error ||
            djen2?.error ||
            'Sem publicações no DJEN para este CNJ. Preencha manualmente.',
          protocolo,
          fonte: 'DJEN',
        };
      }
      // usa a 2ª resposta
      djen = djen2;
    }

    // Mais recente primeiro (advogado "mais recente" = 1º encontrado)
    djen.items = [...djen.items].sort((a: any, b: any) => {
      const da = new Date(a.data_disponibilizacao || 0).getTime();
      const db = new Date(b.data_disponibilizacao || 0).getTime();
      return db - da;
    });
    djenCount = djen.count || djen.items.length;
    const first = djen.items[0];
    djenResumo =
      first.nomeClasse ||
      first.tipoComunicacao ||
      (first.texto ? String(plainTextFromDjen(String(first.texto))).slice(0, 160) : null);

    if (first.nomeClasse) classe_acao = String(first.nomeClasse).toUpperCase();
    if (first.siglaTribunal) tribunal = String(first.siglaTribunal).toUpperCase();
    if (first.nomeOrgao) orgao_julgador = String(first.nomeOrgao).toUpperCase();
    if (first.data_disponibilizacao) {
      // não é ajuizamento, mas ajuda como referência
      dataAjuizamento = first.data_disponibilizacao;
    }

    const pushUnique = (arr: string[], v: string) => {
      const n = v.replace(/\s+/g, ' ').trim().toUpperCase();
      if (n.length < 4 || n.length > 140) return;
      if (!arr.includes(n)) arr.push(n);
    };

    const isBanco = (n: string) =>
      /BANCO|S\.?\s*A\.?|LTDA|FINANCEIRA|CREDITO|CRÉDITO|SEGURADORA|COOPERATIVA|NUBANK|INTER\b|SAFRA|BRADESCO|ITA[UÚ]|SANTANDER|CAIXA/.test(
        n.toUpperCase()
      );

// 1) Destinatários estruturados de TODAS as comunicações
    for (const it of djen.items) {
      for (const d of it.destinatarios || []) {
        const nome = cleanParteNome(String(d.nome || ''));
        if (!nome || nome.length < 4) continue;
        const polo = String(d.polo || '').toUpperCase();

        // documentos estruturados do destinatário (CPF/CNPJ)
        const doc = String(
          d.numeroDocumentoPrincipal || d.numeroDocumento || d.cpf || d.cnpj || d.documento || ''
        ).replace(/\D/g, '');
        if (doc.length === 11 && cpfValido(doc) && !cpfHint) cpfHint = doc;
        if (doc.length === 14 && cnpjValido(doc) && !parte_passiva_cnpj) parte_passiva_cnpj = doc;

        if (/ATIVO|AUTOR|REQUERENTE|EXEQUENTE|RECLAMANTE|APELANTE|AGRAVANTE|IMPETRANTE/.test(polo)) {
          pushUnique(poloAtivo, nome);
          if (!cliente && !isBanco(nome)) cliente = nome;
        } else if (/PASSIVO|R[EÉ]U|REQUERID|EXECUTAD|RECLAMAD|APELAD|AGRAVAD|IMPETRAD/.test(polo)) {
          pushUnique(poloPassivo, nome);
          if (!parte_passiva) parte_passiva = nome;
        } else if (isBanco(nome)) {
          pushUnique(poloPassivo, nome);
          if (!parte_passiva) parte_passiva = nome;
        } else {
          // polo vazio: pessoa física tende a ser ativo em intimações
          if (!isBanco(nome)) {
            pushUnique(poloAtivo, nome);
            if (!cliente) cliente = nome;
          } else {
            pushUnique(poloPassivo, nome);
            if (!parte_passiva) parte_passiva = nome;
          }
        }

        const poloAtivoHit = /ATIVO|AUTOR|REQUERENTE|EXEQUENTE|RECLAMANTE|APELANTE|AGRAVANTE|IMPETRANTE/.test(polo);
        const poloPassivoHit = /PASSIVO|R[EÉ]U|REQUERID|EXECUTAD|RECLAMAD|APELAD|AGRAVAD|IMPETRAD/.test(polo) || isBanco(nome);

        for (const a of d.advogados || []) {
          const an = String(a || '').trim().toUpperCase();
          if (an.length < 5) continue;
          if (poloAtivoHit) {
            if (!advsAtivoOrd.includes(an)) advsAtivoOrd.push(an);
          } else if (poloPassivoHit) {
            if (!advsPassivoOrd.includes(an)) advsPassivoOrd.push(an);
          } else {
            // destinatário sem polo claro: se nome da parte é PF → ativo; banco → passivo
            if (isBanco(nome)) {
              if (!advsPassivoOrd.includes(an)) advsPassivoOrd.push(an);
            } else {
              if (!advsAtivoOrd.includes(an)) advsAtivoOrd.push(an);
            }
          }
        }
      }
    }

    // 2) Corpus textual (HTML → texto) — itens já ordenados do mais recente
    const corpus = djen.items
      .slice(0, 20)
      .map((i) => plainTextFromDjen(String(i.texto || '')))
      .filter(Boolean)
      .join('\n');

    const parsed = parsePartesFromTexto(corpus);
    for (const n of parsed.ativo) pushUnique(poloAtivo, n);
    for (const n of parsed.passivo) pushUnique(poloPassivo, n);
    if (!cliente && parsed.ativo[0]) cliente = parsed.ativo[0];
    if (!parte_passiva && parsed.passivo[0]) parte_passiva = parsed.passivo[0];
    for (const a of parsed.advogadosAtivo) {
      if (!advsAtivoOrd.includes(a)) advsAtivoOrd.push(a);
    }
    for (const a of parsed.advogadosPassivo) {
      if (!advsPassivoOrd.includes(a)) advsPassivoOrd.push(a);
    }
    // Genéricos OAB: se ainda não temos ativo, usa o 1º como ativo (mais comum = advogado do autor)
    if (!advsAtivoOrd.length && parsed.advogados[0]) advsAtivoOrd.push(parsed.advogados[0]);
    if (!advsPassivoOrd.length && parsed.advogados.length > 1) {
      for (const a of parsed.advogados.slice(1)) {
        if (!advsAtivoOrd.includes(a) && !advsPassivoOrd.includes(a)) advsPassivoOrd.push(a);
      }
    }

    // Mais recente = primeiro da lista (publicações DESC)
    advogado = advsAtivoOrd[0] || '';
    advogado_passivo = advsPassivoOrd[0] || '';

    // 3) CPF / CNPJ no teor
    if (!cpfHint) cpfHint = extractCpfFromText(corpus);
    if (!emailHint) emailHint = extractEmailFromText(corpus);
    if (!telefoneHint) telefoneHint = extractPhoneFromText(corpus);
    if (!parte_passiva_cnpj) {
      const cnpj = extractCnpjFromText(corpus);
      if (cnpj) parte_passiva_cnpj = cnpj;
    }
    if (!parte_passiva) {
      const bank = extractPossibleBankName(corpus);
      if (bank) {
        parte_passiva = bank;
        pushUnique(poloPassivo, bank);
      }
    }

    // 4) Heurística final: se só um nome “pessoa” e um “banco”
    if (!cliente && poloAtivo[0]) cliente = poloAtivo[0];
    if (!parte_passiva && poloPassivo[0]) parte_passiva = poloPassivo[0];
    // Se cliente caiu em banco, troca
    if (cliente && isBanco(cliente) && poloAtivo.find((n) => !isBanco(n))) {
      cliente = poloAtivo.find((n) => !isBanco(n)) || cliente;
    }

    // 5) Fallback DataJud: DJEN quase nunca traz o polo ativo (só intima o réu)
    if (!cliente || poloAtivo.length === 0) {
      try {
        const { fetchDataJud, extrairPolos } = await import('@/lib/datajud');
        const dj = await fetchDataJud(protocolo, 1, { fast: true });
        if (dj && !dj.error) {
          const partes = dj.partes || dj.source?.partes || [];
          const polos = extrairPolos(Array.isArray(partes) ? partes : []);
          for (const n of polos.ativo) {
            const c = cleanParteNome(n);
            if (c && !isBanco(c)) {
              pushUnique(poloAtivo, c);
              if (!cliente) cliente = c;
            }
          }
          for (const n of polos.passivo) {
            const c = cleanParteNome(n);
            if (c) {
              pushUnique(poloPassivo, c);
              if (!parte_passiva) parte_passiva = c;
            }
          }
          if (!classe_acao && (dj.classe || dj.classeProcessual || dj.source?.classe)) {
            const cl = dj.classe || dj.classeProcessual || dj.source?.classe;
            classe_acao = String(typeof cl === 'object' ? cl?.nome || cl?.descricao || '' : cl).toUpperCase();
          }
          if (!orgao_julgador && (dj.orgaoJulgador || dj.source?.orgaoJulgador)) {
            const oj = dj.orgaoJulgador || dj.source?.orgaoJulgador;
            orgao_julgador = String(typeof oj === 'object' ? oj?.nome || '' : oj).toUpperCase();
          }
          // CPF se DataJud expuser (raro)
          for (const p of partes || []) {
            const doc = String(p?.numeroDocumentoPrincipal || p?.cpf || p?.cnpj || '').replace(/\D/g, '');
            if (doc.length === 11 && cpfValido(doc) && !cpfHint) cpfHint = doc;
            if (doc.length === 14 && cnpjValido(doc) && !parte_passiva_cnpj) {
              parte_passiva_cnpj = doc.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
            }
          }
        }
      } catch (e) {
        console.warn('[enrichCadastro] DataJud fallback', e);
      }
    }



    if (!cliente && !parte_passiva && !classe_acao) {
      return {
        success: false,
        error:
          'DJEN/DataJud sem partes legíveis. Complete o formulário manualmente ou abra a consulta pública.',
        protocolo,
        djenCount,
        djenResumo,
        tribunal,
        fonte: 'DJEN',
      };
    }

    return {
      success: true,
      protocolo,
      cliente: cliente ? cliente.toUpperCase() : '',
      parte_passiva: parte_passiva ? parte_passiva.toUpperCase() : '',
      parte_passiva_cnpj: parte_passiva_cnpj || '',
      advogado: advogado || '',
      advogado_passivo: advogado_passivo || '',
      classe_acao: classe_acao || '',
      tribunal: tribunal || tribMeta.tribunal,
      orgao_julgador: orgao_julgador || '',
      dataAjuizamento,
      poloAtivo,
      poloPassivo,
      djenCount,
      djenResumo,
      movimentosResumo: null,
      fonte: cliente && parte_passiva ? 'DJEN+DataJud' : 'DJEN',
      cpf: cpfHint || undefined,
      email: emailHint || undefined,
      telefone: telefoneHint || undefined,
    } as CadastroEnrichResult;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Falha no enriquecimento DJEN.';
    console.error('[enrichCadastroByCnj]', e);
    return { success: false, error: msg };
  }
}

export async function registerCaseFromAutomacaoAction(
  input: AutomacaoCadastroInput
) {
  try {
    const ctx = await getUserContext();
    const empresa_id = ctx?.empresa_id;
    const user_id = (ctx as any)?.user_id ?? (ctx as any)?.userId ?? null;

    if (!empresa_id) {
      return { success: false as const, error: 'Sessão expirada.' };
    }

    const protocolo = formatCnj(input.protocolo);
    const dig = digitsOnly(protocolo);
    if (dig.length !== 20) {
      return { success: false as const, error: 'CNJ inválido (20 dígitos).' };
    }
    if (!input.cliente?.trim()) {
      return { success: false as const, error: 'Informe o nome do cliente.' };
    }

    const cases: LegalCase[] =
      (await getStoredCasesForEmpresa(empresa_id)) || [];
    const idx = cases.findIndex(
      (c) => digitsOnly(c.protocolo || '') === dig
    );

    const obsParts = [
      input.observacao?.trim(),
      input.classificacao
        ? `Classificação: ${input.classificacao.trim()}`
        : '',
      input.ofensor ? `Ofensor: ${input.ofensor.trim()}` : '',
      input.classe_acao ? `Classe/Ação: ${input.classe_acao.trim()}` : '',
      input.parte_passiva
        ? `Parte passiva: ${input.parte_passiva.trim()}${
            input.parte_passiva_cnpj
              ? ` (CNPJ ${input.parte_passiva_cnpj})`
              : ''
          }`
        : '',
      input.textoTribunal
        ? `Trecho tribunal:\n${input.textoTribunal.trim().slice(0, 2000)}`
        : '',
    ].filter(Boolean);

    const base: Record<string, any> = {
      protocolo,
      cliente: input.cliente.trim().toUpperCase(),
      telefone: input.telefone?.trim() || '',
      tribunal: input.tribunal?.trim() || '',
      observacao: obsParts.join('\n\n'),
      cpf: (input.cpf || '').replace(/\D/g, ''),
      email: (input.email || '').trim().toLowerCase(),
      estado_civil: (input.estado_civil || '').trim().toUpperCase(),
      emprego: (input.emprego || '').trim().toUpperCase(),
      nacionalidade: (input.nacionalidade || 'BRASILEIRA').trim().toUpperCase() || 'BRASILEIRA',
      parte_passiva: (input.parte_passiva || '').trim().toUpperCase(),
      parte_passiva_cnpj: (input.parte_passiva_cnpj || '').replace(/\D/g, ''),
      classe_acao: (input.classe_acao || input.classificacao || '').trim().toUpperCase(),
      orgao_julgador: (input.orgao_julgador || '').trim().toUpperCase(),
      advogado: (input.advogado || '').trim().toUpperCase(),
      advogado_passivo: (input.advogado_passivo || '').trim().toUpperCase(),
      escritorio: (input.escritorio || '').trim().toUpperCase(),
      proximoPrazo: input.proximoPrazo || '',
      situacao: (input.situacao || 'EM ANDAMENTO').toUpperCase(),
    };

    let next: LegalCase[];
    if (idx >= 0) {
      const merged = processarCaso({
        ...cases[idx],
        ...base,
      } as LegalCase);
      next = [...cases];
      next[idx] = merged;
    } else {
      const created = processarCaso({
        id: `cad-${dig}-${Date.now()}`,
        ...base,
        status: 'Sem Prazo',
        statusManual: 'Automatico',
        ...(user_id ? { created_by: user_id } : {}),
      } as LegalCase);
      next = [created, ...cases];
    }

    await saveStoredCasesForEmpresa(next, empresa_id);

    return {
      success: true as const,
      protocolo,
      created: idx < 0,
      message:
        idx >= 0
          ? 'Processo atualizado na carteira (aba Processos).'
          : 'Processo cadastrado na carteira (aba Processos).',
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Falha ao gravar na carteira.';
    console.error('[registerCaseFromAutomacao]', e);
    return { success: false as const, error: msg };
  }
}

export async function transcribeTribunalPrintAction(payload: {
  text?: string;
  imageBase64?: string;
  mimeType?: string;
}) {
  try {
    if (payload.text && payload.text.trim().length > 10) {
      const text = payload.text.trim();
      return {
        success: true as const,
        text,
        cnj: extractCnjFromText(text),
        engine: 'paste' as const,
      };
    }

    if (!payload.imageBase64) {
      return {
        success: false as const,
        error: 'Envie uma imagem (print) ou cole o texto do tribunal.',
      };
    }

    const mime = payload.mimeType || 'image/png';
    const b64 = payload.imageBase64.replace(/^data:[^;]+;base64,/, '');

    const gemini = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (gemini) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${gemini}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: 'Transcreva o texto legível deste print de processo judicial brasileiro. Extraia CNJ, partes, movimentações e datas. Responda só com o texto transcrito.',
                  },
                  { inline_data: { mime_type: mime, data: b64 } },
                ],
              },
            ],
          }),
          signal: AbortSignal.timeout(45000),
        });
        if (res.ok) {
          const data = await res.json();
          const text =
            data?.candidates?.[0]?.content?.parts
              ?.map((p: { text?: string }) => p.text)
              .filter(Boolean)
              .join('\n') || '';
          if (text.trim()) {
            return {
              success: true as const,
              text: text.trim(),
              cnj: extractCnjFromText(text),
              engine: 'gemini' as const,
            };
          }
        }
      } catch (e) {
        console.error('[OCR Gemini]', e);
      }
    }

    const xai =
      process.env.XAI_API_KEY ||
      process.env.XAI_GROK_PRESTIGE_API_KEY ||
      process.env.XAI_DOCUMENTS_API_KEY;
    if (xai) {
      try {
        const res = await fetch('https://api.x.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${xai}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'grok-2-vision-1212',
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'text',
                    text: 'Transcreva o texto deste print de processo judicial (CNJ, partes, movimentos). Só o texto.',
                  },
                  {
                    type: 'image_url',
                    image_url: { url: `data:${mime};base64,${b64}` },
                  },
                ],
              },
            ],
            max_tokens: 2048,
          }),
          signal: AbortSignal.timeout(45000),
        });
        if (res.ok) {
          const data = await res.json();
          const text = data?.choices?.[0]?.message?.content || '';
          if (text.trim()) {
            return {
              success: true as const,
              text: text.trim(),
              cnj: extractCnjFromText(text),
              engine: 'xai' as const,
            };
          }
        }
      } catch (e) {
        console.error('[OCR xAI]', e);
      }
    }

    return {
      success: false as const,
      error:
        'Não foi possível transcrever o print. Cole o texto ou configure GEMINI_API_KEY / XAI_API_KEY.',
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Falha na transcrição';
    return { success: false as const, error: msg };
  }
}
