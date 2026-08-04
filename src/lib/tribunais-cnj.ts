export const TRIBUNAIS_CNJ: Record<
  string,
  { nome: string; sistema: string; consultaUrl: (cnj: string) => string }
> = {
  "01": { nome: "TJAC", sistema: "esaj", consultaUrl: () => "https://esaj.tjac.jus.br/cpopg/open.do" },
  "02": { nome: "TJAL", sistema: "esaj", consultaUrl: () => "https://www2.tjal.jus.br/cpopg/open.do" },
  "03": { nome: "TJAP", sistema: "pje", consultaUrl: () => "https://pje.tjap.jus.br/consultapublica" },
  "04": { nome: "TJAM", sistema: "esaj", consultaUrl: () => "https://consultasaj.tjam.jus.br/cpopg/open.do" },
  "05": { nome: "TJBA", sistema: "esaj", consultaUrl: () => "https://esaj.tjba.jus.br/cpopg/open.do" },
  "06": { nome: "TJCE", sistema: "esaj", consultaUrl: () => "https://esaj.tjce.jus.br/cpopg/open.do" },
  "07": { nome: "TJDFT", sistema: "pje", consultaUrl: () => "https://pje.tjdft.jus.br/consultaprocessual" },
  "08": { nome: "TJES", sistema: "pje", consultaUrl: () => "https://pje.tjes.jus.br" },
  "09": { nome: "TJGO", sistema: "projudi", consultaUrl: () => "https://projudi.tjgo.jus.br" },
  "10": { nome: "TJMA", sistema: "pje", consultaUrl: () => "https://pje.tjma.jus.br" },
  "11": { nome: "TJMT", sistema: "pje", consultaUrl: () => "https://pje.tjmt.jus.br" },
  "12": { nome: "TJMS", sistema: "esaj", consultaUrl: () => "https://esaj.tjms.jus.br/cpopg5/open.do" },
  "13": { nome: "TJMG", sistema: "pje", consultaUrl: () => "https://pje.tjmg.jus.br" },
  "14": { nome: "TJPA", sistema: "pje", consultaUrl: () => "https://pje.tjpa.jus.br" },
  "15": { nome: "TJPB", sistema: "pje", consultaUrl: () => "https://pje.tjpb.jus.br" },
  "16": { nome: "TJPR", sistema: "projudi", consultaUrl: () => "https://projudi.tjpr.jus.br" },
  "17": { nome: "TJPE", sistema: "pje", consultaUrl: () => "https://pje.tjpe.jus.br" },
  "18": { nome: "TJPI", sistema: "pje", consultaUrl: () => "https://pje.tjpi.jus.br" },
  "19": { nome: "TJRJ", sistema: "pje", consultaUrl: () => "https://tjrj.pje.jus.br/consultaprocessual" },
  "20": { nome: "TJRN", sistema: "pje", consultaUrl: () => "https://pje.tjrn.jus.br" },
  "21": { nome: "TJRS", sistema: "eproc", consultaUrl: () => "https://www.tjrs.jus.br/site_php/consulta" },
  "22": { nome: "TJRO", sistema: "pje", consultaUrl: () => "https://pje.tjro.jus.br" },
  "23": { nome: "TJRR", sistema: "pje", consultaUrl: () => "https://pje.tjrr.jus.br" },
  "24": { nome: "TJSC", sistema: "eproc", consultaUrl: () => "https://eproc1g.tjsc.jus.br" },
  "25": { nome: "TJSE", sistema: "pje", consultaUrl: () => "https://pje.tjse.jus.br" },
  "26": {
    nome: "TJSP",
    sistema: "eproc",
    consultaUrl: () =>
      "https://eproc-consulta.tjsp.jus.br/consulta_1g/externo_controlador.php?acao=tjsp@consulta_unificada_publica/consultar",
  },
  "27": { nome: "TJTO", sistema: "eproc", consultaUrl: () => "https://eproc.tjto.jus.br" },
};

export function getTribunalFromCnj(cnj: string) {
  const clean = cnj.replace(/\D/g, "");
  if (clean.length !== 20) return null;
  const code = clean.substring(14, 16);
  return TRIBUNAIS_CNJ[code] || null;
}
