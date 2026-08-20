/** Fonte única: notas, changelog e próximas. */

export const RELEASE_VERSION = "9.65.0";

export const RELEASE_CHANGELOG: string[] = [
  "9.65 — Lote F: CPF/CNPJ reais, banco omitido sem placeholder, habilitação sem réu vazio.",
  "9.64 — Lote E: régua com totais, forma de pagamento e visão admin.",
  "9.63 — Lote D: atendimento em Processos entra no dashboard/fila/relatório; admin vê empresa; operador vê o que atendeu.",
  "9.62 — Lote C: pular CNJ 8h, 429/403 em português, log+CSV, backoff no scanner.",
  "9.61 — Lote B: filtro de fase na carteira, dono/próximo passo no painel, dias desde o ato do tribunal.",
  "9.60 — Lote A: flags confiáveis (BA, mérito exclusivo, cumprimento, novidade, classe).",
  "9.59 — B.A. só com classe + mandado; dono e próximo passo nas listas; régua do supervisor.",
  "9.58 — Filtro de fase na carteira e dono/último ato na visão da empresa.",
  "9.57 — Notas e avisos de atualização em tempo real; README da operação atual.",
  "9.56 — Carteira com fase honesta, log de scan em Processos/Fila, caminho do dia.",
  "9.55 — Fase + o que falta; régua só atrasados; log de scan.",
  "Parados: filtro de fase, XLSX, scanner com pause/resume.",
  "Pacotes por empresa (Máximo = todos).",
];

export const RELEASE_NOTES: { id: string; titulo: string; corpo: string }[] = [
  {
    id: "n1",
    titulo: "Filtro de fase",
    corpo: "Em Processos, os mesmos chips de Parados: sem contestação, sem sentença, sem réplica.",
  },
  {
    id: "n2",
    titulo: "Dono do caso",
    corpo: "Quem atendeu e o último ato aparecem na carteira e na visão da empresa.",
  },
];

export const RELEASE_PROXIMAS: { id: string; titulo: string; corpo: string }[] = [
  {
    id: "p1",
    titulo: "Log no worker DataJud",
    corpo: "Scan em nuvem entra no mesmo log CNJ · motor · hora.",
  },
];
