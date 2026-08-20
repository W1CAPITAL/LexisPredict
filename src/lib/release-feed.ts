/** Fonte única: notas, changelog e próximas. Usado por /api/version e o menu. */

export const RELEASE_VERSION = "9.57.0";

export const RELEASE_CHANGELOG: string[] = [
  "9.57 — Notas e avisos de atualização em tempo real; README da operação atual.",
  "9.56 — Carteira com fase honesta (sem alerta BA genérico), log de scan em Processos/Fila, caminho do dia no treinamento.",
  "9.55 — Fase + o que falta + dono/último ato; régua só atrasados + marcar pago; log de scan.",
  "WhatsApp: Evolution acorda só no Enviar; antiban; próximo vencido.",
  "Parados: filtro de fase, XLSX, scanner com pause/resume.",
  "Pacotes por empresa (Máximo = todos).",
  "Peças no padrão Ad Judicia; sidebar com busca.",
  "Next 16 + Node 24; lint sem typescript-eslint (TS 7).",
];

export const RELEASE_NOTES: { id: string; titulo: string; corpo: string }[] = [
  {
    id: "n1",
    titulo: "Fase honesta",
    corpo: "O card mostra a fase e o que falta (réplica, cumprimento, silêncio). B.A. só quando o rito é B.A.",
  },
  {
    id: "n2",
    titulo: "Parados",
    corpo: "Filtre por fase e exporte XLSX. Recarregou no lote? Retomar fila.",
  },
  {
    id: "n3",
    titulo: "Régua",
    corpo: "CRM → Cobrança: só atrasados. Marcar pago depois do comprovante.",
  },
];

export const RELEASE_PROXIMAS: { id: string; titulo: string; corpo: string }[] = [
  {
    id: "p1",
    titulo: "Filtro de fase na carteira",
    corpo: "Mesmos chips de Parados em Processos.",
  },
  {
    id: "p2",
    titulo: "Log de scan no worker",
    corpo: "DataJud em nuvem entra no mesmo log CNJ · motor · hora.",
  },
  {
    id: "p3",
    titulo: "Dono na visão da empresa",
    corpo: "Quem atendeu e último ato na lista /processos.",
  },
];
