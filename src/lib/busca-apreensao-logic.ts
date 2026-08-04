/**
 * Lógica BA — tipos claros + filtro geográfico (UF carteira × UF do mandado).
 */
export type BaTipo =
  | 'VEICULO'
  | 'PRISAO'
  | 'PENHORA_BENS'
  | 'IMOVEL'
  | 'GENERICO'
  | null;

export type BaDeteccao = {
  hit: boolean;
  motivo: string | null;
  tipo: BaTipo;
  /** Se false, não deve disparar alerta operacional forte */
  alertarOperacional: boolean;
  geo: {
    ufCarteira: string | null;
    ufMandado: string | null;
    mesmaUf: boolean;
    mesmaRegiao: boolean;
    distante: boolean;
    motivoGeo: string;
  };
};

const UF_BY_TR: Record<string, string> = {
  '01': 'AC', '02': 'AL', '03': 'AP', '04': 'AM', '05': 'BA', '06': 'CE',
  '07': 'DF', '08': 'ES', '09': 'GO', '10': 'MA', '11': 'MT', '12': 'MS',
  '13': 'MG', '14': 'PA', '15': 'PB', '16': 'PR', '17': 'PE', '18': 'PI',
  '19': 'RJ', '20': 'RN', '21': 'RS', '22': 'RO', '23': 'RR', '24': 'SC',
  '25': 'SE', '26': 'SP', '27': 'TO',
};

const REGIAO: Record<string, string> = {
  AC: 'N', AP: 'N', AM: 'N', PA: 'N', RO: 'N', RR: 'N', TO: 'N',
  AL: 'NE', BA: 'NE', CE: 'NE', MA: 'NE', PB: 'NE', PE: 'NE', PI: 'NE', RN: 'NE', SE: 'NE',
  DF: 'CO', GO: 'CO', MT: 'CO', MS: 'CO',
  ES: 'SE', MG: 'SE', RJ: 'SE', SP: 'SE',
  PR: 'S', SC: 'S', RS: 'S',
};

const UF_FROM_SIGLA: Record<string, string> = {
  TJAC: 'AC', TJAL: 'AL', TJAP: 'AP', TJAM: 'AM', TJBA: 'BA', TJCE: 'CE',
  TJDFT: 'DF', TJES: 'ES', TJGO: 'GO', TJMA: 'MA', TJMT: 'MT', TJMS: 'MS',
  TJMG: 'MG', TJPA: 'PA', TJPB: 'PB', TJPR: 'PR', TJPE: 'PE', TJPI: 'PI',
  TJRJ: 'RJ', TJRN: 'RN', TJRS: 'RS', TJRO: 'RO', TJRR: 'RR', TJSC: 'SC',
  TJSE: 'SE', TJSP: 'SP', TJTO: 'TO',
};

export function digitsOnly(s: string | null | undefined): string {
  return String(s || '').replace(/\D/g, '');
}

export function normalizeName(s: string): string {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function mesmoCnj(a: string | null | undefined, b: string | null | undefined): boolean {
  const da = digitsOnly(a);
  const db = digitsOnly(b);
  if (da.length < 15 || db.length < 15) return false;
  return da === db || da.slice(-20) === db.slice(-20);
}

/** Extrai UF a partir do CNJ (segmento TR). */
export function ufFromCnj(cnj: string | null | undefined): string | null {
  const d = digitsOnly(cnj);
  if (d.length >= 16) {
    const tr = d.slice(14, 16);
    return UF_BY_TR[tr] || null;
  }
  return null;
}

export function ufFromTribunalSigla(sigla: string | null | undefined): string | null {
  if (!sigla) return null;
  const s = String(sigla).toUpperCase().replace(/\s/g, '');
  if (UF_FROM_SIGLA[s]) return UF_FROM_SIGLA[s];
  if (s.startsWith('TJ') && s.length === 4) {
    const guess = s.slice(2);
    // TJSP → SP
    if (guess.length === 2) return guess;
  }
  return null;
}

export function avaliarGeo(opts: {
  protocolosCarteira: string[];
  processoDjen: string | null;
  tribunalSigla: string | null;
}): BaDeteccao['geo'] {
  let ufCarteira: string | null = null;
  for (const p of opts.protocolosCarteira || []) {
    ufCarteira = ufFromCnj(p);
    if (ufCarteira) break;
  }
  let ufMandado =
    ufFromCnj(opts.processoDjen) || ufFromTribunalSigla(opts.tribunalSigla);

  const mesmaUf = !!(ufCarteira && ufMandado && ufCarteira === ufMandado);
  const regC = ufCarteira ? REGIAO[ufCarteira] : null;
  const regM = ufMandado ? REGIAO[ufMandado] : null;
  const mesmaRegiao = !!(regC && regM && regC === regM);
  const distante = !!(ufCarteira && ufMandado && !mesmaUf && !mesmaRegiao);

  let motivoGeo = 'UF não comparável';
  if (mesmaUf) motivoGeo = `Mesma UF (${ufCarteira})`;
  else if (mesmaRegiao) motivoGeo = `Mesma região (${regC}): ${ufCarteira} × ${ufMandado}`;
  else if (distante)
    motivoGeo = `Distante: carteira ${ufCarteira} × mandado ${ufMandado} — alerta reduzido`;
  else if (ufCarteira || ufMandado)
    motivoGeo = `Carteira ${ufCarteira || '—'} · mandado ${ufMandado || '—'}`;

  return { ufCarteira, ufMandado, mesmaUf, mesmaRegiao, distante, motivoGeo };
}

/** Classifica tipo de BA / medida coercitiva no teor. */
export function classificarTipoBa(texto: string): { tipo: BaTipo; motivo: string | null } {
  const upper = normalizeName(texto);

  // Prisão (não confundir com BA de bem)
  if (
    /MANDADO\s+DE\s+PRISAO|CUMPRA[- ]SE\s+MANDADO\s+DE\s+PRISAO|ORDEM\s+DE\s+PRISAO|PRISAO\s+PREVENTIVA|RECOLHIMENTO\s+A\s+PRISAO/.test(
      upper
    )
  ) {
    return { tipo: 'PRISAO', motivo: 'MANDADO / ORDEM DE PRISÃO' };
  }

  // Veículo
  if (
    /BUSCA\s+E\s+APREENSAO.{0,40}(VEICULO|AUTOMOVEL|MOTOCICLETA|CAMINHAO)|APREENSAO\s+DO\s+VEICULO|REINTEGRA[CÇ]AO\s+DE\s+POSSE.{0,30}VEICULO|ALIENA[CÇ]AO\s+FIDUCIARIA.{0,40}(BUSCA|APREENSAO|VEICULO)|MANDADO\s+DE\s+BUSCA\s+E\s+APREENSAO.{0,30}(VEICULO|BEM)/.test(
      upper
    ) ||
    (/BUSCA\s+E\s+APREENSAO/.test(upper) &&
      /(VEICULO|AUTOMOVEL|MOTOCICLETA|PLACA|RENAVAM)/.test(upper))
  ) {
    return { tipo: 'VEICULO', motivo: 'BUSCA E APREENSÃO DE VEÍCULO' };
  }

  // Imóvel
  if (
    /PENHORA\s+DE\s+IMOVEL|PENHORA\s+IMOBILIARIA|IMISSAO\s+NA\s+POSSE|BUSCA\s+E\s+APREENSAO.{0,40}IMOVEL|ARREMATACAO\s+DE\s+IMOVEL|CONSTITUICAO\s+DE\s+HIPOTECA\s+JUDICIAL/.test(
      upper
    )
  ) {
    return { tipo: 'IMOVEL', motivo: 'PENHORA / MEDIDA SOBRE IMÓVEL' };
  }

  // Penhora de bens (genérica / online)
  if (
    /PENHORA\s+ONLINE|PENHORA\s+DE\s+ATIVOS|BLOQUEIO\s+DE\s+VALORES|PENHORA\s+NO\s+ROSTO|BACENJUD|SISBAJUD|PENHORA\s+DE\s+BENS|AVALIACAO\s+DE\s+BENS\s+PENHORADOS/.test(
      upper
    )
  ) {
    return { tipo: 'PENHORA_BENS', motivo: 'PENHORA / BLOQUEIO DE BENS OU ATIVOS' };
  }

  // BA genérico forte (mandado)
  if (
    /MANDADO\s+DE\s+BUSCA\s+E\s+APREENSAO|CUMPRA[- ]SE\s+O\s+MANDADO\s+DE\s+BUSCA|ORDEM\s+DE\s+BUSCA\s+E\s+APREENSAO|DEFIRO\s+A\s+BUSCA\s+E\s+APREENSAO/.test(
      upper
    )
  ) {
    return { tipo: 'GENERICO', motivo: 'MANDADO DE BUSCA E APREENSÃO' };
  }

  // Fraco: só nome de classe — não hit
  if (/ACAO\s+DE\s+BUSCA\s+E\s+APREENSAO/.test(upper) && !/MANDADO|DEFIRO|CUMPRA/.test(upper)) {
    return { tipo: null, motivo: null };
  }

  if (/BUSCA\s+E\s+APREENSAO/.test(upper)) {
    return { tipo: 'GENERICO', motivo: 'BUSCA E APREENSÃO (teor)' };
  }

  return { tipo: null, motivo: null };
}

export function textoIndicaBuscaApreensao(texto: string): {
  hit: boolean;
  motivo: string | null;
  tipo: BaTipo;
} {
  const c = classificarTipoBa(texto);
  return { hit: !!c.tipo, motivo: c.motivo, tipo: c.tipo };
}

/**
 * Detecção completa: tipo + geo + se deve alertar.
 * Prisão / BA em UF distante da carteira → alertarOperacional=false (ainda registra).
 */
export function detectarBaCompleto(opts: {
  texto: string;
  processoDjen: string | null;
  tribunalSigla: string | null;
  protocolosCarteira: string[];
}): BaDeteccao {
  const det = textoIndicaBuscaApreensao(opts.texto);
  const geo = avaliarGeo({
    protocolosCarteira: opts.protocolosCarteira,
    processoDjen: opts.processoDjen,
    tribunalSigla: opts.tribunalSigla,
  });

  let alertarOperacional = det.hit;
  if (det.hit && geo.distante) {
    // Mandado longe do estado do processo da carteira: não alarmar como BA local
    alertarOperacional = false;
  }
  // Prisão em outro estado: ainda mais restrito
  if (det.tipo === 'PRISAO' && geo.distante) {
    alertarOperacional = false;
  }

  return {
    hit: det.hit,
    motivo: det.motivo,
    tipo: det.tipo,
    alertarOperacional,
    geo,
  };
}

export function nomeApareceNoTexto(texto: string, nome: string): boolean {
  const t = normalizeName(texto);
  const n = normalizeName(nome);
  if (!t || !n || n.length < 6) return false;
  if (t.includes(n)) return true;
  const tokens = n.split(' ').filter((w) => w.length >= 3);
  if (tokens.length < 2) return t.includes(n);
  let ok = 0;
  for (const tok of tokens) if (t.includes(tok)) ok++;
  return ok >= Math.min(2, tokens.length) && ok >= Math.ceil(tokens.length * 0.6);
}

export function oabApareceNoTexto(texto: string, oab: string): boolean {
  const t = normalizeName(texto);
  const digits = String(oab || '').replace(/\D/g, '');
  if (digits.length < 4) return false;
  if (t.includes(digits)) return true;
  const pretty = digits.replace(/(\d)(?=(\d{3})+$)/g, '$1.');
  return t.includes(normalizeName(pretty));
}

export function publicacaoBateComCarteira(opts: {
  texto: string;
  processoDjen: string | null;
  protocolosCarteira: string[];
  clienteNome: string;
}): { ok: boolean; motivoMatch: string } {
  const { texto, processoDjen, protocolosCarteira, clienteNome } = opts;

  for (const p of protocolosCarteira || []) {
    if (mesmoCnj(processoDjen, p)) {
      return { ok: true, motivoMatch: `CNJ carteira ${p}` };
    }
    const dig = digitsOnly(p);
    if (dig.length >= 15 && digitsOnly(texto).includes(dig)) {
      return { ok: true, motivoMatch: `CNJ no teor ${p}` };
    }
  }

  if (nomeApareceNoTexto(texto, clienteNome)) {
    return { ok: true, motivoMatch: 'Nome do cliente no teor' };
  }

  if ((protocolosCarteira || []).length === 1 && textoIndicaBuscaApreensao(texto).hit) {
    return { ok: true, motivoMatch: 'Único CNJ da carteira + teor BA' };
  }

  return { ok: false, motivoMatch: 'Sem vínculo cliente/CNJ' };
}

export function labelTipoBa(tipo: BaTipo): string {
  switch (tipo) {
    case 'VEICULO':
      return 'Veículo';
    case 'PRISAO':
      return 'Prisão';
    case 'PENHORA_BENS':
      return 'Penhora de bens';
    case 'IMOVEL':
      return 'Imóvel';
    case 'GENERICO':
      return 'BA genérico';
    default:
      return '—';
  }
}

export function corTipoBa(tipo: BaTipo): string {
  switch (tipo) {
    case 'VEICULO':
      return 'bg-orange-600';
    case 'PRISAO':
      return 'bg-red-800';
    case 'PENHORA_BENS':
      return 'bg-amber-700';
    case 'IMOVEL':
      return 'bg-purple-700';
    case 'GENERICO':
      return 'bg-red-600';
    default:
      return 'bg-muted';
  }
}
