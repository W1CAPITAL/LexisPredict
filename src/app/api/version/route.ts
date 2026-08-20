import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const LEXIS_APP_VERSION = "9.52.0";

export const LEXIS_CHANGELOG: string[] = [
  "Nova versão 9.52 — Lote C (comunicação).",
  "Rascunhos ao cliente em 2ª pessoa (você) — remove 'o autor / parte autora'.",
  "Âncora DJEN: textos ordenados pela data de disponibilização (ato mais recente manda).",
  "Sugerir resposta (Tarefas / Processos / WhatsApp) usa a mesma âncora DJEN.",
  "WhatsApp: canal=whatsapp no motor; atendimento com próximo retorno, observação e encerrar.",
  "Histórico WA: busca por variantes de telefone (55, 9º dígito, remote_jid).",
  "Lote B (fila): atendimento recente e listas tratamento/blacklist mantidos.",
];

export async function GET() {
  const sha =
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.VERCEL_DEPLOYMENT_ID ||
    process.env.NEXT_PUBLIC_BUILD_ID ||
    "dev";
  const buildId = `${LEXIS_APP_VERSION}-${String(sha).slice(0, 12)}`;

  return NextResponse.json(
    {
      version: LEXIS_APP_VERSION,
      buildId,
      env: process.env.VERCEL_ENV || process.env.NODE_ENV || "development",
      ts: Date.now(),
      changelog: LEXIS_CHANGELOG,
      whatsNew: LEXIS_CHANGELOG[0],
      title: "Nova versão do LexisPredict",
      subtitle: "O app foi atualizado. Recarregue para usar as novidades abaixo.",
    },
    { headers: { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" } }
  );
}
