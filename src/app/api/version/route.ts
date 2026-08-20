import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const LEXIS_APP_VERSION = "9.51.0";

export const LEXIS_CHANGELOG: string[] = [
  "Nova versão 9.51 — fila operacional (Lote B).",
  "Atendimento recente (36h) reduz prioridade automaticamente — não fica no topo sem necessidade.",
  "Listas Blacklist e Crítico em tratamento pesam menos na sequência prioritária.",
  "Oportunidade de instaurar cumprimento sobe na fila quando elegível (score comercial).",
  "Sub-abas Tarefas: Toda a fila · Em tratamento · Blacklist (já disponíveis no filtro).",
  "Ao registrar atendimento, use as opções: normal / em tratamento / blacklist.",
  "KPI e resumo único de status (lote 9.50) mantidos.",
  "Cálculos Price/SAC + Bacen e banner de versão em tempo real.",
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
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      },
    }
  );
}
