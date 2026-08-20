"use server";

import { consultarProcessoJusbr, isJusbrConfigured } from "@/lib/jusbr-client";
import { getUserContext } from "@/lib/server-db";

export async function consultarJusbrAction(cnj: string) {
  const { empresa_id } = await getUserContext();
  if (!empresa_id) return { success: false as const, error: "Sem sessão" };
  if (!isJusbrConfigured()) {
    return {
      success: false as const,
      error:
        "API JusBR/Jusbrasil não configurada. Defina JUSBRASIL_API_KEY (ou DIGESTO_API_TOKEN) nas env da Vercel. DataJud/DJEN continuam ativos.",
    };
  }
  const data = await consultarProcessoJusbr(cnj);
  if (data.erro && data.fonte === "indisponivel") {
    return { success: false as const, error: data.erro };
  }
  if (data.erro) return { success: false as const, error: data.erro, data };
  return { success: true as const, data };
}

export async function jusbrStatusAction() {
  return { configured: isJusbrConfigured() };
}
