/**
 * Registro de notificação extrajudicial real (não “só para constar”).
 */

export type ProtocoloExtrajudicial = {
  dataEnvio?: string | null;
  canal?: "email" | "procon" | "consumidor_gov" | "carta" | "outro" | null;
  numeroProtocolo?: string | null;
  bancoRespondeu?: boolean | null;
  dataResposta?: string | null;
  resumoResposta?: string | null;
  urlComprovante?: string | null;
  updatedAt?: string;
};

export function emptyProtocoloExtra(): ProtocoloExtrajudicial {
  return {
    dataEnvio: null,
    canal: null,
    numeroProtocolo: null,
    bancoRespondeu: null,
    dataResposta: null,
    resumoResposta: null,
    urlComprovante: null,
  };
}

export function protocoloExtraDocumentado(p: ProtocoloExtrajudicial | null | undefined): boolean {
  if (!p) return false;
  return !!(p.dataEnvio && (p.numeroProtocolo || p.urlComprovante || p.canal));
}

export function resumoProtocoloExtra(p: ProtocoloExtrajudicial): string {
  if (!protocoloExtraDocumentado(p)) return "Extrajudicial ainda não documentado.";
  const partes = [
    p.dataEnvio ? `Enviado em ${p.dataEnvio}` : null,
    p.canal ? `canal ${p.canal}` : null,
    p.numeroProtocolo ? `protocolo ${p.numeroProtocolo}` : null,
    p.bancoRespondeu === true
      ? `Banco respondeu${p.dataResposta ? ` em ${p.dataResposta}` : ""}`
      : p.bancoRespondeu === false
        ? "Banco não respondeu até o momento"
        : null,
  ].filter(Boolean);
  return partes.join(" · ");
}
