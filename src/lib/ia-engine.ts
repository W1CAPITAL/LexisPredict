/**
 * Motor Sincronia IA — DataJud + DJEN integrados.
 * Extração determinística de evento, prazo e minuta de peça a partir das fontes
 * oficiais. Usado como fallback e como "esqueleto" antes da camada de IA.
 *
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * @license Proprietary - All rights reserved.
 */

import { plainTextFromDjen, classifyEventFromText, summarizeDjenKeywords } from '@/lib/djen';
import { extrairPolos } from '@/lib/datajud';
import { cpfValido, cnpjValido } from '@/lib/cpf-cnpj';

export type EventoDetectado = {
  evento_tipo: string;
  evento_resumo: string | null;
  evento_data: string | null;
  evento_fonte: 'datajud' | 'djen' | 'ambos';
};

export type SincroniaMeta = {
  protocolo: string;
  cliente?: string;
  parte_passiva?: string;
  parte_passiva_cnpj?: string;
  advogado?: string;
  advogado_passivo?: string;
  classe_acao?: string;
  tribunal?: string;
  orgao_julgador?: string;
  cpf?: string;
  email?: string;
  telefone?: string;
  dataDistribuicao?: string | null;
  ultimoMovimento?: string | null;
  ultimaMovimentacao?: string | null;
  proximoPrazo?: string | null;
  resumo?: string | null;
  risco?: 'Crítico' | 'Atenção' | 'Normal';
  sugestao?: string | null;
  pecaSugerida?: 'informacoes' | 'juntada' | 'urgente' | 'atualizacao';
  fonte?: string;
};

export type PecaIAInput = {
  tipo: 'informacoes' | 'juntada' | 'urgente' | 'atualizacao';
  protocolo: string;
  cliente?: string;
  parte_passiva?: string;
  advogado?: string;
  classe_acao?: string;
  tribunal?: string;
  orgao_julgador?: string;
  resumo?: string | null;
};

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

/** Ordena desc por data e devolve o movimento mais recente. */
export function ultimoMovimentoDataJud(movimentos: any[]): {
  nome: string;
  complemento: string;
  data: string | null;
} | null {
  const lista = (movimentos || [])
    .filter((m: any) => m)
    .sort((a: any, b: any) => {
      const da = new Date(a.dataHora || a.data || 0).getTime();
      const db = new Date(b.dataHora || b.data || 0).getTime();
      return db - da;
    });
  const m = lista[0];
  if (!m) return null;
  return {
    nome: String(m.nome || m.fonte || 'Movimento'),
    complemento: String(m.complemento || m.descricao || '').slice(0, 220),
    data: String(m.dataHora || m.data || ''),
  };
}

/** Detector determinístico de evento unificado (DataJud + DJEN). */
export function detectarEventoIA(movimentos: any[], comunicacoes: any[]): EventoDetectado {
  const ultDJ = ultimoMovimentoDataJud(movimentos);
  const coms = (comunicacoes || []).filter(Boolean).sort((a: any, b: any) => {
    const da = new Date(a.data_disponibilizacao || 0).getTime();
    const db = new Date(b.data_disponibilizacao || 0).getTime();
    return db - da;
  });
  const c = coms[0];

  const dataDJ = ultDJ?.data ? String(ultDJ.data).slice(0, 10) : null;
  const dataDJEN = c?.data_disponibilizacao ? String(c.data_disponibilizacao).slice(0, 10) : null;

  if (c?.texto) {
    const txt = String(c.texto);
    const cls = classifyEventFromText(txt);
    const label = summarizeDjenKeywords(txt);
    const eventoData = dataDJEN || dataDJ;
    return {
      evento_tipo: cls.tipo,
      evento_resumo: label,
      evento_data: eventoData,
      evento_fonte: dataDJEN && dataDJ ? 'ambos' : 'djen',
    };
  }

  if (ultDJ) {
    const txt = `${ultDJ.nome} ${ultDJ.complemento}`;
    const cls = classifyEventFromText(txt);
    return {
      evento_tipo: cls.tipo === 'rotina' ? 'novo_andamento_relevante' : cls.tipo,
      evento_resumo: cls.label !== 'Rotina' ? cls.label : ultDJ.complemento || ultDJ.nome,
      evento_data: dataDJ,
      evento_fonte: 'datajud',
    };
  }

  return {
    evento_tipo: 'rotina',
    evento_resumo: null,
    evento_data: null,
    evento_fonte: 'datajud',
  };
}

function parseDataBR(s: string): Date | null {
  const m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (!m) return null;
  let [, d, mo, y] = m;
  let ano = y.length === 2 ? (Number(y) > 50 ? `19${y}` : `20${y}`) : y;
  const dt = new Date(Number(ano), Number(mo) - 1, Number(d), 12);
  if (isNaN(dt.getTime())) return null;
  return dt;
}

function isoDo(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function somaDiasUteis(from: Date, dias: number): Date {
  const d = new Date(from);
  let added = 0;
  while (added < dias) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return d;
}

/**
 * Detecta um próximo prazo/audiência a partir do texto das publicações DJEN.
 * Prioriza datas futuras explícitas; senão, "prazo de N dias" contado da
 * data da publicação. Retorna ISO (YYYY-MM-DD) ou null.
 */
export function detectarProximoPrazoIA(comunicacoes: any[]): string | null {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const coms = (comunicacoes || [])
    .filter((c: any) => c)
    .sort((a: any, b: any) => {
      const da = new Date(a.data_disponibilizacao || 0).getTime();
      const db = new Date(b.data_disponibilizacao || 0).getTime();
      return db - da;
    });

  const datasCandidatas: Date[] = [];

  for (const c of coms) {
    const texto = plainTextFromDjen(String(c.texto || ''));
    if (!texto) continue;

    // datas explícitas no corpo (padrão DD/MM/AAAA)
    for (const m of texto.matchAll(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/g)) {
      const dt = parseDataBR(m[0]);
      if (dt && dt.getTime() >= hoje.getTime()) datasCandidatas.push(dt);
    }

    // audiência: "às 13:30" + alguma data já capturada → mantém
    if (/AUDI[EÊ]NCIA|DILIG[EÊ]NCIA|ATA\s+DE\s+REUNI|OITIVA|SOLENIDADE/i.test(texto)) {
      const m = texto.match(/\((\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
      if (m) {
        const dt = parseDataBR(`${m[1]}/${m[2]}/${m[3]}`);
        if (dt && dt.getTime() >= hoje.getTime()) datasCandidatas.push(dt);
      }
    }

    // "prazo de N dias" contado da publicação
    const pub = c.data_disponibilizacao ? new Date(String(c.data_disponibilizacao).slice(0, 10) + 'T12:00:00') : null;
    if (pub) {
      const prazoRe = texto.match(/prazo\s+(?:de\s+|legal\s+de\s+|m[aá]ximo\s+de\s+)?(\d{1,3})\s+dias/i);
      if (prazoRe) {
        const n = Number(prazoRe[1]);
        const alvo = somaDiasUteis(pub, n);
        if (alvo.getTime() >= hoje.getTime()) datasCandidatas.push(alvo);
      }
    }
  }

  if (!datasCandidatas.length) return null;
  datasCandidatas.sort((a, b) => a.getTime() - b.getTime());
  return isoDo(datasCandidatas[0]);
}

/** Monta os polos a partir dos dois DataJud (movimentos/partes). */
export function extrairPolosCombinados(dj: any): {
  ativo: string[];
  passivo: string[];
  outros: string[];
} {
  const partes = Array.isArray(dj?.partes)
    ? dj.partes
    : Array.isArray(dj?.source?.partes)
      ? dj.source.partes
      : [];
  return extrairPolos(partes);
}

function limparNome(raw: string): string {
  return String(raw || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
    .slice(0, 100);
}

function ehBanco(nome: string): boolean {
  return /BANCO|S\.?\s*A\.?|LTDA|FINANCEIRA|CREDITO|CRÉDITO|SEGURADORA|COOPERATIVA|NUBANK|\bINTER\b|SAFRA|BRADESCO|ITA[UÚ]|SANTANDER|CAIXA|NEXPE|LOSANGO|CONSIGNADO|PAGBANK|MERCADO\s+PAGO|PICPAY|WILL\s+BANK|BANRISUL|MERCANTIL|BMG|\bPAN\b|C6\s*BANK|DAYCOVAL|ORIGINAL|VOTORANTIM|AGIBANK|MASTER|MODAL|RENDIMENTO|CITIBANK|HSBC|GOLDMAN/.test(
    nome.toUpperCase()
  );
}

/** Fallback determinístico de polos quando a IA está offline. */
export function polosDeterministicos(dj: any, comunicacoes: any[]): {
  cliente: string;
  parte_passiva: string;
} {
  const polos = extrairPolosCombinados(dj);
  let cliente = polos.ativo.find((n) => !ehBanco(n)) || polos.ativo[0] || '';
  let parte_passiva = polos.passivo.find((n) => ehBanco(n)) || polos.passivo[0] || '';

  if (!cliente || !parte_passiva) {
    for (const c of comunicacoes || []) {
      for (const d of c.destinatarios || []) {
        const nome = limparNome(d.nome || '');
        if (!nome || nome.length < 4) continue;
        const polo = String(d.polo || '').toUpperCase();
        if (/ATIVO|AUTOR|REQUERENTE/.test(polo) && !ehBanco(nome)) {
          if (!cliente) cliente = nome;
        } else if (/PASSIVO|R[EÉ]U|REQUERID/.test(polo) || ehBanco(nome)) {
          if (!parte_passiva) parte_passiva = nome;
        }
      }
    }
  }
  if (!cliente && polos.ativo[0]) cliente = polos.ativo[0];
  if (!parte_passiva && polos.passivo[0]) parte_passiva = polos.passivo[0];
  return { cliente: limparNome(cliente), parte_passiva: limparNome(parte_passiva) };
}

/** CPF/CNPJ a partir das partes DataJud e destinatários DJEN. */
export function documentosDetectados(dj: any, comunicacoes: any[]): {
  cpf: string;
  parte_passiva_cnpj: string;
} {
  let cpf = '';
  let cnpj = '';
  const partes = Array.isArray(dj?.partes)
    ? dj.partes
    : Array.isArray(dj?.source?.partes)
      ? dj.source.partes
      : [];
  for (const p of partes) {
    const doc = String(p?.numeroDocumentoPrincipal || p?.cpf || p?.cnpj || '').replace(/\D/g, '');
    if (!cpf && doc.length === 11 && cpfValido(doc)) cpf = doc;
    if (!cnpj && doc.length === 14 && cnpjValido(doc)) cnpj = doc;
  }
  if (!cpf || !cnpj) {
    for (const c of comunicacoes || []) {
      for (const d of c.destinatarios || []) {
        const doc = String(
          d.numeroDocumentoPrincipal || d.numeroDocumento || d.cpf || d.cnpj || d.documento || ''
        ).replace(/\D/g, '');
        if (!cpf && doc.length === 11 && cpfValido(doc)) cpf = doc;
        if (!cnpj && doc.length === 14 && cnpjValido(doc)) cnpj = doc;
      }
    }
  }
  return { cpf, parte_passiva_cnpj: cnpj };
}

export function formatCnpjBruto(cnpj: string): string {
  const d = String(cnpj || '').replace(/\D/g, '');
  if (d.length !== 14) return cnpj || '';
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

const PECA_PROMPTS: Record<PecaIAInput['tipo'], { titulo: string; corpo: (m: PecaIAInput) => string }> = {
  informacoes: {
    titulo: 'PETIÇÃO DE INFORMAÇÕES',
    corpo: (m) =>
      `Requer, respeitosamente, que Vossa Excelência determine à serventia a expedição de certidão atualizada de andamento processual e cópia dos atos disponíveis, de modo a permitir o pleno acompanhamento e a adoção das providências cabíveis.`,
  },
  juntada: {
    titulo: 'PETIÇÃO DE JUNTADA',
    corpo: (m) =>
      `Requer a juntada da procuração e documentos de habilitação do patrono do polo ativo, com fundamento nos arts. 103 e 287 do CPC, bem como a sua posterior intimação nos autos para todos os atos do processo.`,
  },
  urgente: {
    titulo: 'PETIÇÃO DE URGÊNCIA',
    corpo: (m) =>
      `Requer, com fundamento no art. 300 do CPC, a concessão de tutela de urgência, ante a probabilidade do direito e o perigo de dano demonstrados nos autos, com o fim de evitar dano irreparável ou de difícil reparação à parte autora.`,
  },
  atualizacao: {
    titulo: 'PETIÇÃO DE ATUALIZAÇÃO CADASTRAL',
    corpo: (m) =>
      `Requer a juntada da atualização cadastral da parte autora (endereço, telefone e e-mail), bem como o registro dos novos dados nos autos, para os fins do art. 77, V, do CPC, e a intimação da parte contrária para os atos processuais pertinentes.`,
  },
};

/** Minuta de petição a partir dos dados sincronizados. */
export function buildPecaIA(m: PecaIAInput): string {
  const hoje = new Date().toLocaleDateString('pt-BR');
  const def = PECA_PROMPTS[m.tipo] || PECA_PROMPTS.informacoes;
  const linhas = [
    'EXCELENTÍSSIMO(A) SENHOR(A) DOUTOR(A) JUIZ(A) DE DIREITO',
    '',
    `Processo nº: ${m.protocolo}`,
    `Classe: ${m.classe_acao || '—'}`,
    `Órgão: ${m.orgao_julgador || '—'}`,
    m.cliente ? `Autor: ${m.cliente}` : '',
    m.parte_passiva ? `Réu: ${m.parte_passiva}` : '',
    m.advogado ? `Advogado(a): ${m.advogado}` : '',
    '',
    def.titulo,
    '',
    ...(m.resumo
      ? [`Conforme consta dos autos: ${m.resumo}`, '', '']
      : []),
    def.corpo(m),
    '',
    'Termos em que pede deferimento.',
    hoje,
    m.advogado ? m.advogado.toUpperCase() : 'NOME DO(A) ADVOGADO(A)',
    'OAB/UF Nº ______',
  ];
  return linhas.filter((l) => l !== null && l !== undefined && l !== '').join('\n');
}

export const PECA_LABELS: Record<PecaIAInput['tipo'], string> = {
  informacoes: 'Pedido de informações / certidão',
  juntada: 'Juntada de procuração',
  urgente: 'Tutela de urgência',
  atualizacao: 'Atualização cadastral',
};

export function sanitizeProximoPrazo(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let s = String(raw).trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const dt = parseDataBR(s);
    if (!dt) return null;
    s = isoDo(dt);
  }
  return s;
}

export function hojeISODate() {
  return hojeISO();
}
