/**
 * Extração de PDF para preenchimento automático dos campos de Modelos & Peças.
 * Client-only: usa pdfjs-dist (mesmo padrão da página OCR) + legal-ner.
 * Não inventa: só entidades/heurísticas presentes no texto do PDF.
 */

import * as pdfjsLib from "pdfjs-dist";
import { extractLegalEntities } from "@/lib/legal-ner";
import { BANCOS_COBERTOS } from "@/lib/pecas-modelos";
import type { PecaMeta } from "@/lib/pecas-modelos";

/** Texto puro (camada de texto digital) de todas as páginas do PDF. */
export async function extrairTextoDePdf(data: ArrayBuffer): Promise<string> {
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const parts: string[] = [];
  try {
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const tc = await page.getTextContent();
      const text = tc.items
        .map((it: any) => (typeof it?.str === "string" ? it.str : ""))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      if (text) parts.push(text);
    }
  } finally {
    await pdf.destroy();
  }
  return parts.join("\n");
}

/** Nomes dos bancos do legal-ner (EM CAPS) → nomes do BANCOS_COBERTOS. */
const NOME_BANCO_COBERTO: Record<string, string> = {
  "BANCO DO BRASIL": "Banco do Brasil",
  "ITAÚ UNIBANCO": "Banco Itaú Unibanco",
  "ITAÚ": "Banco Itaú Unibanco",
  "ITAU": "Banco Itaú Unibanco",
  "BANCO ITAÚ": "Banco Itaú Unibanco",
  "BANCO ITAU": "Banco Itaú Unibanco",
  "BANCO BRADESCO": "Banco Bradesco",
  "BRADESCO": "Banco Bradesco",
  "BANCO SANTANDER": "Banco Santander",
  "SANTANDER": "Banco Santander",
  "CAIXA ECONÔMICA": "Caixa Econômica Federal",
  "CAIXA ECONOMICA": "Caixa Econômica Federal",
  "NUBANK": "Nubank",
  "BANCO INTER": "Banco Inter",
  "PAN": "Banco Pan",
  "BANCO PAN": "Banco Pan",
  "BMG": "Banco BMG",
  "C6 BANK": "Banco C6 Bank",
  "SAFRA": "Banco Safra",
  "BANCO DAYCOVAL": "Banco Daycoval",
  "DAYCOVAL": "Banco Daycoval",
  "BANCO VOTORANTIM": "Banco Votorantim",
  "VOTORANTIM": "Banco Votorantim",
  "LOSANGO": "Losango",
  "BANRISUL": "Banrisul",
  "SICOOB": "Sicoob",
  "SICREDI": "Sicredi",
};

function bancoCoberto(rotulo: string): string | undefined {
  const key = rotulo.toUpperCase();
  return NOME_BANCO_COBERTO[key] ?? undefined;
}

function parseOab(rotulo: string): { numero: string; uf: string } | null {
  const compacto = rotulo.match(/^([A-Z]{2})(\d+)$/);
  if (compacto) return { numero: compacto[2], uf: compacto[1] };
  const m = rotulo.match(/OAB\s*\/?\s*(\d+)(?:\s*\/\s*([A-Z]{2}))?/i);
  if (!m) return null;
  return { numero: m[1], uf: (m[2] || "").toUpperCase() };
}

/** Mapeia o texto extraído do PDF para os campos de PecaMeta. */
export function extrairCamposDoTexto(text: string): Partial<PecaMeta> {
  const ner = extractLegalEntities(text);
  const by = ner.byKind;
  const campos: Partial<PecaMeta> = {};

  const cpf = by.cpf?.[0];
  const cnpj = by.cnpj?.[0];
  if (cpf) campos.cpfCliente = cpf;
  if (by.cpf?.[1]) campos.cpfParteContraria = by.cpf[1];
  if (cnpj) campos.cnpjBanco = cnpj;

  const rg = by.rg?.[0];
  if (rg) {
    const d = rg.replace(/\D/g, "");
    campos.rgCliente = d.length >= 5 ? d : rg;
  }

  if (by.email?.[0]) campos.emailCliente = by.email[0].toLowerCase();
  if (by.telefone?.[0]) campos.telefoneCliente = by.telefone[0];
  if (by.endereco?.[0]) campos.enderecoCliente = by.endereco[0];

  const banco = ner.bancos.map(bancoCoberto).find(Boolean);
  if (banco) campos.banco = banco;

  const oab = by.oab?.[0];
  if (oab) {
    const p = parseOab(oab);
    if (p) {
      campos.oab = p.numero;
      campos.uf = p.uf;
    }
  }
  const oab2 = by.oab?.[1];
  if (oab2) {
    const p = parseOab(oab2);
    if (p) {
      campos.oab2 = p.numero;
      campos.uf2 = p.uf;
    }
  }

  const protocolo =
    by.contrato?.[0] || by.cnj?.[0] || by.id_pje?.[0];
  if (protocolo) campos.protocolo = protocolo;

  if (by.valor_brl?.[0]) campos.valorContrato = by.valor_brl[0];

  const datas = by.data || [];
  if (datas.length) campos.data = datas[datas.length - 1];

  if (by.tribunal?.[0]) campos.tribunal = by.tribunal[0];

  const nomes = by.nome || [];
  if (nomes[0]) campos.cliente = nomes[0];
  if (nomes[1]) campos.advogado = nomes[1];

  return campos;
}