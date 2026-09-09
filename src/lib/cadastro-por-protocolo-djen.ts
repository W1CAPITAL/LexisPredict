/**
 * Cadastro enriquecido SÓ via DJEN (API Comunica PJe).
 * Entrada: protocolo CNJ. Saída: campos de processo a partir das comunicações.
 * Não usa DataJud neste fluxo (pedido do produto).
 */

import { formatCnj, digitsOnly } from "@/lib/cnj-extract";

export type CadastroDjenResult = {
  ok: boolean;
  protocolo: string;
  error?: string;
  htmlBlocked?: boolean;
  items: number;
  campos: {
    protocolo_ref: string;
    cliente: string;
    parte_passiva: string;
    tribunal: string;
    orgao_julgador: string;
    classe_acao: string;
    observacoes: string;
    djen_ultimo_resumo: string;
    djen_ultima_data: string;
    djen_count: number;
  };
  raw_destinatarios: Array<{ nome?: string; polo?: string }>;
};

function tribunalFromCnj(cnj: string): string {
  const d = digitsOnly(cnj);
  if (d.length !== 20) return "";
  const tr = d.slice(14, 16);
  const map: Record<string, string> = {
    "01": "TJAC", "02": "TJAL", "03": "TJAP", "04": "TJAM", "05": "TJBA",
    "06": "TJCE", "07": "TJDF", "08": "TJES", "09": "TJGO", "10": "TJMA",
    "11": "TJMT", "12": "TJMS", "13": "TJMG", "14": "TJPA", "15": "TJPB",
    "16": "TJPR", "17": "TJPE", "18": "TJPI", "19": "TJRJ", "20": "TJRN",
    "21": "TJRS", "22": "TJRO", "23": "TJRR", "24": "TJSC", "25": "TJSP",
    "26": "TJSE", "27": "TJTO",
  };
  return d.slice(13, 14) === "8" ? map[tr] || "" : "";
}

function plain(html: string) {
  return String(html || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Consome o resultado já buscado do DJEN (client ou server).
 * items: lista da API comunicaapi.pje.jus.br
 */
export function montarCadastroDeItensDjen(
  protocoloRaw: string,
  items: any[],
  meta?: { htmlBlocked?: boolean; error?: string; ok?: boolean }
): CadastroDjenResult {
  const protocolo = formatCnj(protocoloRaw);
  const list = Array.isArray(items) ? items : [];

  if (meta?.htmlBlocked) {
    return {
      ok: false,
      protocolo,
      error: "DJEN retornou HTML (WAF/bloqueio). Tente do browser do usuário (client-side).",
      htmlBlocked: true,
      items: 0,
      campos: emptyCampos(protocolo),
      raw_destinatarios: [],
    };
  }

  if (!list.length) {
    return {
      ok: false,
      protocolo,
      error: meta?.error || "Nenhuma comunicação DJEN para este CNJ (processo novo pode ainda não ter publicação).",
      items: 0,
      campos: {
        ...emptyCampos(protocolo),
        tribunal: tribunalFromCnj(protocolo),
      },
      raw_destinatarios: [],
    };
  }

  const dest: Array<{ nome?: string; polo?: string }> = [];
  let orgao = "";
  let classe = "";
  let tribunal = tribunalFromCnj(protocolo);
  let ultimoResumo = "";
  let ultimaData = "";

  for (const it of list) {
    if (!orgao && (it.nomeOrgao || it.nome_orgao)) orgao = String(it.nomeOrgao || it.nome_orgao);
    if (!classe && (it.nomeClasse || it.nome_classe)) classe = String(it.nomeClasse || it.nome_classe);
    if (!tribunal && (it.siglaTribunal || it.sigla_tribunal))
      tribunal = String(it.siglaTribunal || it.sigla_tribunal);
    const ds = it.data_disponibilizacao || it.dataDisponibilizacao;
    if (ds && (!ultimaData || String(ds) > ultimaData)) {
      ultimaData = String(ds);
      ultimoResumo = plain(it.texto || it.tipoComunicacao || it.tipoDocumento || "").slice(0, 280);
    }
    const dlist = it.destinatarios || [];
    for (const d of dlist) {
      const nome = d.nome || d.nomeDestinatario;
      if (nome) dest.push({ nome: String(nome), polo: d.polo || d.tipoPolo || "" });
    }
  }

  // Heurística autor/réu pelos polos
  let autor = "";
  let reu = "";
  for (const d of dest) {
    const p = String(d.polo || "").toUpperCase();
    if (!autor && /ATIV|AUTOR|REQUERENTE|EXEQUENTE/i.test(p)) autor = d.nome || "";
    if (!reu && /PASSIV|R[EÉ]U|REQUERID|EXECUTAD/i.test(p)) reu = d.nome || "";
  }
  if (!autor && dest[0]?.nome) autor = dest[0].nome;
  if (!reu && dest[1]?.nome) reu = dest[1].nome;

  return {
    ok: true,
    protocolo,
    items: list.length,
    campos: {
      protocolo_ref: protocolo,
      cliente: autor,
      parte_passiva: reu,
      tribunal,
      orgao_julgador: orgao,
      classe_acao: classe,
      observacoes: [
        classe ? `Classe: ${classe}` : "",
        ultimoResumo ? `DJEN: ${ultimoResumo}` : "",
      ]
        .filter(Boolean)
        .join(" | "),
      djen_ultimo_resumo: ultimoResumo,
      djen_ultima_data: ultimaData,
      djen_count: list.length,
    },
    raw_destinatarios: dest,
  };
}

function emptyCampos(protocolo: string) {
  return {
    protocolo_ref: protocolo,
    cliente: "",
    parte_passiva: "",
    tribunal: "",
    orgao_julgador: "",
    classe_acao: "",
    observacoes: "",
    djen_ultimo_resumo: "",
    djen_ultima_data: "",
    djen_count: 0,
  };
}
