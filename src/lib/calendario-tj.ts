/**
 * Calendário judiciário nacional + feriados por UF (TJs).
 * Complementa prazos-cpc. Não substitui o calendário oficial publicado pelo tribunal.
 * @copyright 2026 W1 / LexisPredict
 */

import {
  isDiaUtil as isDiaUtilNacional,
  proximoDiaUtil as proximoDiaUtilNacional,
  addDiasUteis,
  descreverPrazo,
  type PrazoBadge,
} from './prazos-cpc';

export type UfCode =
  | 'AC' | 'AL' | 'AP' | 'AM' | 'BA' | 'CE' | 'DF' | 'ES' | 'GO' | 'MA'
  | 'MT' | 'MS' | 'MG' | 'PA' | 'PB' | 'PR' | 'PE' | 'PI' | 'RJ' | 'RN'
  | 'RS' | 'RO' | 'RR' | 'SC' | 'SP' | 'SE' | 'TO';

/** Feriados estaduais fixos (MM-DD) por UF — principais TJs */
const FERIADOS_UF: Partial<Record<UfCode, string[]>> = {
  SP: ['07-09'], // Revolução Constitucionalista
  RJ: ['01-20', '04-23', '11-20'], // S. Sebastião, S. Jorge, Consciência Negra (estadual reforçado)
  MG: ['04-21'], // já nacional Tiradentes — reforço
  RS: ['09-20'], // Revolução Farroupilha
  PR: ['12-19'], // Emancipação do Paraná
  SC: ['08-11'], // Criação da capitania (comum em calendários SC)
  BA: ['07-02'], // Independência da Bahia
  PE: ['03-06', '06-24'], // Revolução Pernambucana / S. João (práticas locais variam)
  CE: ['03-25'], // Abolição no Ceará
  DF: ['04-21'], // Fundação de Brasília (com Tiradentes)
  GO: ['10-24'], // Pedra Fundamental de Goiânia
  MT: ['08-20'], // Estado
  MS: ['10-11'], // Criação de MS
  ES: ['05-23'], // Colonização do solo espírito-santense (referência comum)
  PA: ['08-15'], // Adesão do Pará à independência
  AM: ['09-05'], // Elevação à categoria de província
  MA: ['07-28'], // Adesão à independência
  PB: ['07-26'], // N. Sra. das Neves / referências locais
  RN: ['10-03'], // Mártires de Cunhaú e Uruaçu (lei estadual)
  AL: ['09-16'], // Emancipação de Alagoas
  SE: ['07-08'], // Emancipação política
  PI: ['10-19'], // Dia do Piauí
  TO: ['03-13'], // Criação do Estado
  RO: ['01-04'], // Instalação do Estado
  AC: ['06-15'], // Aniversário do Estado
  RR: ['10-05'], // Criação do Estado
  AP: ['03-13'], // Criação do Estado
};

/** Mapa tribunal → UF */
const TRIBUNAL_UF: Record<string, UfCode> = {
  TJAC: 'AC', TJAL: 'AL', TJAP: 'AP', TJAM: 'AM', TJBA: 'BA', TJCE: 'CE',
  TJDFT: 'DF', TJDF: 'DF', TJES: 'ES', TJGO: 'GO', TJMA: 'MA', TJMT: 'MT',
  TJMS: 'MS', TJMG: 'MG', TJPA: 'PA', TJPB: 'PB', TJPR: 'PR', TJPE: 'PE',
  TJPI: 'PI', TJRJ: 'RJ', TJRN: 'RN', TJRS: 'RS', TJRO: 'RO', TJRR: 'RR',
  TJSC: 'SC', TJSP: 'SP', TJSE: 'SE', TJTO: 'TO',
};

export function ufFromTribunal(tribunal?: string | null): UfCode | null {
  if (!tribunal) return null;
  const t = String(tribunal).toUpperCase().replace(/\s+/g, '');
  if (TRIBUNAL_UF[t]) return TRIBUNAL_UF[t];
  // CNJ segmento: 8.26 = SP, 8.19 = RJ, etc.
  const m = t.match(/8\.(\d{2})/);
  if (m) {
    const map: Record<string, UfCode> = {
      '01': 'AC', '02': 'AL', '03': 'AP', '04': 'AM', '05': 'BA', '06': 'CE',
      '07': 'DF', '08': 'ES', '09': 'GO', '10': 'MA', '11': 'MT', '12': 'MS',
      '13': 'MG', '14': 'PA', '15': 'PB', '16': 'PR', '17': 'PE', '18': 'PI',
      '19': 'RJ', '20': 'RN', '21': 'RS', '22': 'RO', '23': 'RR', '24': 'SC',
      '25': 'SE', '26': 'SP', '27': 'TO',
    };
    return map[m[1]] || null;
  }
  if (t.includes('SAO PAULO') || t.includes('SÃO PAULO')) return 'SP';
  if (t.includes('RIO DE JANEIRO')) return 'RJ';
  return null;
}

function toDate(d: Date | string): Date {
  if (d instanceof Date) return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const s = String(d).trim();
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    const [dd, mm, yyyy] = s.split('/').map(Number);
    return new Date(yyyy, mm - 1, dd);
  }
  const x = new Date(s);
  return new Date(x.getFullYear(), x.getMonth(), x.getDate());
}

function mmdd(d: Date): string {
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isoDay(d: Date): string {
  return `${d.getFullYear()}-${mmdd(d)}`;
}

/** Recesso forense típico (20/dez–20/jan) */
export function isRecessoForense(date: Date | string): boolean {
  const d = toDate(date);
  const m = d.getMonth();
  const day = d.getDate();
  if (m === 11 && day >= 20) return true;
  if (m === 0 && day <= 20) return true;
  return false;
}

export function isFeriadoUf(date: Date | string, uf?: UfCode | null): boolean {
  if (!uf) return false;
  const list = FERIADOS_UF[uf] || [];
  return list.includes(mmdd(toDate(date)));
}

/** Dia útil nacional + UF (se informada) */
export function isDiaUtil(
  date: Date | string,
  opts?: { uf?: UfCode | null; tribunal?: string | null }
): boolean {
  if (!isDiaUtilNacional(date)) return false;
  const uf = opts?.uf || ufFromTribunal(opts?.tribunal);
  if (uf && isFeriadoUf(date, uf)) return false;
  return true;
}

export function isDiaUtilForense(
  date: Date | string,
  opts?: { uf?: UfCode | null; tribunal?: string | null }
): boolean {
  if (!isDiaUtil(date, opts)) return false;
  if (isRecessoForense(date)) return false;
  return true;
}

export function proximoDiaUtil(
  date: Date | string,
  opts?: { uf?: UfCode | null; tribunal?: string | null }
): Date {
  let d = toDate(date);
  let guard = 0;
  while (!isDiaUtil(d, opts) && guard < 45) {
    d.setDate(d.getDate() + 1);
    guard++;
  }
  return d;
}

export function proximoDiaUtilForense(
  date: Date | string,
  opts?: { uf?: UfCode | null; tribunal?: string | null }
): Date {
  let d = toDate(date);
  let guard = 0;
  while (!isDiaUtilForense(d, opts) && guard < 45) {
    d.setDate(d.getDate() + 1);
    guard++;
  }
  return d;
}

export type CalendarioDia = {
  date: Date;
  iso: string;
  diaUtil: boolean;
  diaUtilForense: boolean;
  recesso: boolean;
  feriadoUf: boolean;
  label: string;
  uf?: UfCode | null;
};

export function gradeCalendario(
  anchor: Date,
  dias = 14,
  opts?: { uf?: UfCode | null; tribunal?: string | null }
): CalendarioDia[] {
  const uf = opts?.uf || ufFromTribunal(opts?.tribunal);
  const start = toDate(anchor);
  const out: CalendarioDia[] = [];
  for (let i = 0; i < dias; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const utilNac = isDiaUtilNacional(d);
    const ferUf = !!(uf && isFeriadoUf(d, uf));
    const util = utilNac && !ferUf;
    const recesso = isRecessoForense(d);
    const forense = util && !recesso;
    let label = forense ? 'Útil' : recesso ? 'Recesso' : ferUf ? `Feriado ${uf}` : 'Não útil';
    out.push({
      date: d,
      iso: isoDay(d),
      diaUtil: util,
      diaUtilForense: forense,
      recesso,
      feriadoUf: ferUf,
      label,
      uf,
    });
  }
  return out;
}

export function descreverPrazoForense(
  prazo: string | null | undefined,
  hoje: Date = new Date(),
  opts?: { uf?: UfCode | null; tribunal?: string | null }
): PrazoBadge & { recessoAviso?: string } {
  const base = descreverPrazo(prazo, hoje);
  if (!prazo) return base;
  try {
    const p = toDate(prazo);
    const uf = opts?.uf || ufFromTribunal(opts?.tribunal);
    if (isRecessoForense(p)) {
      return {
        ...base,
        label: `${base.label} · recesso forense`,
        recessoAviso:
          'Data no recesso forense (≈20/dez–20/jan). Confirme a contagem no tribunal.',
      };
    }
    if (uf && isFeriadoUf(p, uf)) {
      return {
        ...base,
        label: `${base.label} · feriado ${uf}`,
        recessoAviso: `Feriado estadual (${uf}). Próximo dia útil forense: ${isoDay(proximoDiaUtilForense(p, { uf }))}.`,
      };
    }
    if (!isDiaUtilNacional(p)) {
      const next = proximoDiaUtilForense(p, { uf });
      return {
        ...base,
        recessoAviso: `Dia não útil. Próximo dia útil forense: ${isoDay(next)}.`,
      };
    }
  } catch {
    /* */
  }
  return base;
}

export { addDiasUteis, descreverPrazo, proximoDiaUtilNacional, isDiaUtilNacional };
