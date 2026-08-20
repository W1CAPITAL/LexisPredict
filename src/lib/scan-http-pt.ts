/** Mensagens de rede do scanner — o operador lê, não o stack. */

export function mensagemScanHttp(raw: unknown): string {
  const s = String(raw || "");
  if (/429|taxa excedida|rate.?limit/i.test(s)) {
    return "O tribunal pediu pausa (muitas consultas). Esperando um minuto e seguindo.";
  }
  if (/403|geo/i.test(s)) {
    return "DJEN recusou o servidor (403). No Vercel a região precisa ser gru1 (São Paulo).";
  }
  if (/timeout|timed out|aborted/i.test(s)) {
    return "O tribunal não respondeu a tempo. O CNJ entra de novo no próximo ciclo.";
  }
  if (/502|503|504/i.test(s)) {
    return "Tribunal instável agora. Pulando este CNJ e tentando o próximo.";
  }
  return s.slice(0, 180) || "Falha no scanner.";
}
