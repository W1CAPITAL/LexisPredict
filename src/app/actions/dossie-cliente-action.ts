export async function exportClienteDossieAction(
  protocolo: string,
  options?: { previewOnly?: boolean; editedContent?: any }
) {
  try {
    const ctx = await getUserContext();
    if (!ctx.empresa_id) return { success: false as const, error: "Sessão expirada" };

    const cnj = String(protocolo || "").trim();
    if (!cnj) return { success: false as const, error: "Protocolo inválido" };

    const cases = await getStoredCasesForEmpresa(ctx.empresa_id, false);
    const target =
      (cases || []).find(
        (c: any) =>
          String(c.protocolo || "").replace(/\D/g, "") === cnj.replace(/\D/g, "") ||
          String(c.protocolo || "") === cnj
      ) || null;

    if (!target) {
      return { success: false as const, error: "Processo não encontrado na carteira visível" };
    }

    // ... (mantenha o resto do código de scan e scoreRiscoProcesso igual)

    // Depois de calcular o risco:
    const risco = scoreRiscoProcesso(target as any, { movimentos, djenTexts });

    // Se for só preview → retorna os dados para o modal
    if (options?.previewOnly) {
      return {
        success: true as const,
        preview: {
          resumoProcesso: [
            `O processo de ${target.cliente || "cliente"} (${target.protocolo || cnj}) encontra-se na fase de ${risco.faseAtual}.`,
            risco.resumo,
            `O índice de risco é ${risco.score}/100 (${risco.nivel}).`,
          ].join(" "),
          risco,
        },
      };
    }

    // Se tiver conteúdo editado, sobrescreve
    const edited = options?.editedContent;
    const pontosFortes = edited?.pontosFortes
      ? edited.pontosFortes.split("\n").map((l: string) => l.replace(/^•\s*/, "").trim()).filter(Boolean)
      : risco.pontosFortes;

    const pontosAtencao = edited?.pontosAtencao
      ? edited.pontosAtencao.split("\n").map((l: string) => l.replace(/^•\s*/, "").trim()).filter(Boolean)
      : risco.pontosAtencao;

    const planoAcao = edited?.planoAcao
      ? edited.planoAcao.split("\n").map((l: string) => l.replace(/^•\s*/, "").trim()).filter(Boolean)
      : risco.planoAcao;

    const pdfData = {
      // ... (mantenha os campos que já existiam)
      resumoProcesso: edited?.resumo || resumoExec,
      risco: {
        ...risco,
        pontosFortes,
        pontosAtencao,
        planoAcao,
        leituraEstrategica: edited?.leituraEstrategica || risco.leituraEstrategica,
      },
      // ...
    };

    // Gera o PDF normalmente
    // ...
  } catch (e: any) {
    // ...
  }
}
