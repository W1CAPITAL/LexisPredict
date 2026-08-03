/**
 * Catálogo de consulta pública por tribunal (J=8.xx / TRF=4.xx).
 * Preferência: eproc > PJe consulta > e-SAJ/Projudi.
 * Uso: links de saída (Automação / Veredito / scanner UI) — NÃO faz scrape.
 * Seguro: só URLs públicas; não altera DataJud/DJEN.
 */

export type TribunalSistema = 'eproc' | 'pje' | 'esaj' | 'projudi' | 'outro';

export interface TribunalLink {
  codigo: string; // 8.26, 4.01...
  sigla: string;
  nome: string;
  /** URL principal (preferência eproc quando existir) */
  url: string;
  sistema: TribunalSistema;
  /** Alternativas (e-SAJ, PJe etc.) */
  alternativos?: { url: string; sistema: TribunalSistema; label?: string }[];
}

/**
 * TJSP: eproc 1º grau é o alvo preferencial quando disponível publicamente.
 * Consulta pública eproc SP (quando o tribunal expõe):
 * https://eproc.tjsp.jus.br/ — nem sempre há consulta pública aberta igual e-SAJ.
 * Mantemos e-SAJ como fallback estável de consulta pública CNJ-style.
 * Preferência declarada: tentar eproc primeiro na UI; fallback esaj.
 */
export const TRIBUNAIS_TJ: TribunalLink[] = [
  {
    codigo: '8.01',
    sigla: 'TJAC',
    nome: 'Acre',
    url: 'https://eproc.tjac.jus.br/eprocV2/externo_controlador.php?acao=processo_consulta_publica',
    sistema: 'eproc',
    alternativos: [{ url: 'https://esaj.tjac.jus.br/cpopg/open.do', sistema: 'esaj', label: 'e-SAJ' }],
  },
  {
    codigo: '8.02',
    sigla: 'TJAL',
    nome: 'Alagoas',
    url: 'https://www2.tjal.jus.br/cpopg/open.do',
    sistema: 'esaj',
  },
  {
    codigo: '8.03',
    sigla: 'TJAP',
    nome: 'Amapá',
    url: 'https://pje.tjap.jus.br/1g/ConsultaPublica/listView.seam',
    sistema: 'pje',
  },
  {
    codigo: '8.04',
    sigla: 'TJAM',
    nome: 'Amazonas',
    url: 'https://consultasaj.tjam.jus.br/cpopg/open.do',
    sistema: 'esaj',
  },
  {
    codigo: '8.05',
    sigla: 'TJBA',
    nome: 'Bahia',
    url: 'https://consultapublicapje.tjba.jus.br/pje/ConsultaPublica/listView.seam',
    sistema: 'pje',
  },
  {
    codigo: '8.06',
    sigla: 'TJCE',
    nome: 'Ceará',
    url: 'https://esaj.tjce.jus.br/cpopg/open.do',
    sistema: 'esaj',
    alternativos: [
      {
        url: 'https://pje-consulta.tjce.jus.br/pje1grau/ConsultaPublica/listView.seam',
        sistema: 'pje',
        label: 'PJe',
      },
    ],
  },
  {
    codigo: '8.07',
    sigla: 'TJDFT',
    nome: 'DF',
    url: 'https://pje-consultapublica.tjdft.jus.br/consultapublica/ConsultaPublica/listView.seam',
    sistema: 'pje',
  },
  {
    codigo: '8.08',
    sigla: 'TJES',
    nome: 'Espírito Santo',
    url: 'https://pje.tjes.jus.br/pje/ConsultaPublica/listView.seam',
    sistema: 'pje',
  },
  {
    codigo: '8.09',
    sigla: 'TJGO',
    nome: 'Goiás',
    url: 'https://projudi.tjgo.jus.br/BuscaProcesso',
    sistema: 'projudi',
  },
  {
    codigo: '8.10',
    sigla: 'TJMA',
    nome: 'Maranhão',
    url: 'https://pje.tjma.jus.br/pje/ConsultaPublica/listView.seam',
    sistema: 'pje',
  },
  {
    codigo: '8.11',
    sigla: 'TJMT',
    nome: 'Mato Grosso',
    url: 'https://pje.tjmt.jus.br/pje/ConsultaPublica/listView.seam',
    sistema: 'pje',
    alternativos: [
      { url: 'https://consultaprocessual.tjmt.jus.br/', sistema: 'outro', label: 'Consulta processal' },
    ],
  },
  {
    codigo: '8.12',
    sigla: 'TJMS',
    nome: 'Mato Grosso do Sul',
    url: 'https://esaj.tjms.jus.br/cpopg5/open.do',
    sistema: 'esaj',
  },
  {
    codigo: '8.13',
    sigla: 'TJMG',
    nome: 'Minas Gerais',
    url: 'https://pje-consulta-publica.tjmg.jus.br/',
    sistema: 'pje',
  },
  {
    codigo: '8.14',
    sigla: 'TJPA',
    nome: 'Pará',
    url: 'https://consultas.tjpa.jus.br/consultaunificada/consulta/principal',
    sistema: 'outro',
  },
  {
    codigo: '8.15',
    sigla: 'TJPB',
    nome: 'Paraíba',
    url: 'https://consultapublica.tjpb.jus.br/pje/ConsultaPublica/listView.seam',
    sistema: 'pje',
  },
  {
    codigo: '8.16',
    sigla: 'TJPR',
    nome: 'Paraná',
    url: 'https://consulta.tjpr.jus.br/projudi_consulta/',
    sistema: 'projudi',
  },
  {
    codigo: '8.17',
    sigla: 'TJPE',
    nome: 'Pernambuco',
    url: 'https://srv01.tjpe.jus.br/consultaprocessualunificada/',
    sistema: 'outro',
  },
  {
    codigo: '8.18',
    sigla: 'TJPI',
    nome: 'Piauí',
    url: 'https://pje.tjpi.jus.br/1g/ConsultaPublica/listView.seam',
    sistema: 'pje',
  },
  {
    codigo: '8.19',
    sigla: 'TJRJ',
    nome: 'Rio de Janeiro',
    url: 'https://tjrj.pje.jus.br/1g/ConsultaPublica/listView.seam',
    sistema: 'pje',
  },
  {
    codigo: '8.20',
    sigla: 'TJRN',
    nome: 'Rio Grande do Norte',
    url: 'https://pje1gconsulta.tjrn.jus.br/consultapublica/ConsultaPublica/listView.seam',
    sistema: 'pje',
  },
  {
    codigo: '8.21',
    sigla: 'TJRS',
    nome: 'Rio Grande do Sul',
    url: 'https://www.tjrs.jus.br/novo/busca/?return=proc&client=wp_index',
    sistema: 'outro',
    alternativos: [
      {
        url: 'https://eproc1g.tjrs.jus.br/eproc/externo_controlador.php?acao=processo_consulta_publica',
        sistema: 'eproc',
        label: 'eproc 1G',
      },
    ],
  },
  {
    codigo: '8.22',
    sigla: 'TJRO',
    nome: 'Rondônia',
    url: 'https://pjepg.tjro.jus.br/consulta/ConsultaPublica/listView.seam',
    sistema: 'pje',
  },
  {
    codigo: '8.23',
    sigla: 'TJRR',
    nome: 'Roraima',
    url: 'https://projudi.tjrr.jus.br/projudi/',
    sistema: 'projudi',
  },
  {
    codigo: '8.24',
    sigla: 'TJSC',
    nome: 'Santa Catarina',
    url: 'https://eprocwebcon.tjsc.jus.br/consulta1g/externo_controlador.php?acao=processo_consulta_publica',
    sistema: 'eproc',
  },
  {
    codigo: '8.25',
    sigla: 'TJSE',
    nome: 'Sergipe',
    url: 'https://www.tjse.jus.br/portal/consultas/consulta-processual',
    sistema: 'outro',
  },
  {
    codigo: '8.26',
    sigla: 'TJSP',
    nome: 'São Paulo',
    // Preferência eproc (portal); consulta pública estável continua e-SAJ como fallback
    url: 'https://eproc.tjsp.jus.br/eproc/externo_controlador.php?acao=processo_consulta_publica',
    sistema: 'eproc',
    alternativos: [
      { url: 'https://esaj.tjsp.jus.br/cpopg/open.do', sistema: 'esaj', label: 'e-SAJ CPOPG' },
      { url: 'https://esaj.tjsp.jus.br/cposg/open.do', sistema: 'esaj', label: 'e-SAJ 2º grau' },
    ],
  },
  {
    codigo: '8.27',
    sigla: 'TJTO',
    nome: 'Tocantins',
    url: 'https://eproc1.tjto.jus.br/eprocV2_prod_1grau/externo_controlador.php?acao=processo_consulta_publica',
    sistema: 'eproc',
  },
];

export const TRIBUNAIS_TRF: TribunalLink[] = [
  {
    codigo: '4.01',
    sigla: 'TRF1',
    nome: 'TRF 1ª Região',
    url: 'https://pje1g.trf1.jus.br/consultapublica/ConsultaPublica/listView.seam',
    sistema: 'pje',
  },
  {
    codigo: '4.02',
    sigla: 'TRF2',
    nome: 'TRF 2ª Região',
    url: 'https://eproc.jfrj.jus.br/eproc/externo_controlador.php?acao=processo_consulta_publica',
    sistema: 'eproc',
  },
  {
    codigo: '4.04',
    sigla: 'TRF4',
    nome: 'TRF 4ª Região',
    url: 'https://consulta.trf4.jus.br/trf4/controlador.php?acao=consulta_processual_pesquisa',
    sistema: 'outro',
  },
  {
    codigo: '4.06',
    sigla: 'TRF6',
    nome: 'TRF 6ª Região',
    url: 'https://eproc1g.trf6.jus.br/eproc/externo_controlador.php?acao=processo_consulta_publica',
    sistema: 'eproc',
  },
];

export const TODOS_TRIBUNAIS = [...TRIBUNAIS_TJ, ...TRIBUNAIS_TRF];

/** Extrai J=8.26 do CNJ */
export function codigoJusticaFromCnj(cnj: string): string | null {
  const d = String(cnj || '').replace(/\D/g, '');
  if (d.length < 14) return null;
  // CNJ: NNNNNNN-DD.AAAA.J.TR.OOOO → J is 1 digit at position after year
  // digits only: 7 + 2 + 4 + 1 + 2 + 4 = 20
  if (d.length >= 20) {
    const j = d[13]; // 0-index: positions 0-6 num, 7-8 dig, 9-12 year, 13 segment
    const tr = d.slice(14, 16);
    return `${j}.${tr}`;
  }
  // fallback regex on formatted
  const m = String(cnj).match(/\.(\d)\.(\d{2})\./);
  return m ? `${m[1]}.${m[2]}` : null;
}

export function getTribunalByCnj(cnj: string): TribunalLink | null {
  const code = codigoJusticaFromCnj(cnj);
  if (!code) return null;
  return TODOS_TRIBUNAIS.find((t) => t.codigo === code) || null;
}

/** URL preferencial (eproc se listado como principal) */
export function getConsultaUrlForCnj(cnj: string): string | null {
  const t = getTribunalByCnj(cnj);
  return t?.url || null;
}

/**
 * Se eproc principal falhar na prática (login), UI pode oferecer fallback e-SAJ.
 */
export function getFallbacksForCnj(cnj: string) {
  const t = getTribunalByCnj(cnj);
  return t?.alternativos || [];
}
