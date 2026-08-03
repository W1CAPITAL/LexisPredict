"use server";

import { consultarOabCna, type OabConsultaResult } from "@/lib/oab-consulta";

export async function consultarOabAction(uf: string, numero: string): Promise<OabConsultaResult> {
  try {
    return await consultarOabCna(uf, numero);
  } catch (e: any) {
    return {
      success: false,
      source: "validacao",
      oabNumero: String(numero || "").replace(/\D/g, ""),
      oabUf: String(uf || "").toUpperCase(),
      error: e?.message || "Erro na consulta OAB",
      consultaUrl: `https://cna.oab.org.br/`,
    };
  }
}
