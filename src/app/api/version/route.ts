import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Atualize a cada release — aparece no banner de nova versão. */
export const LEXIS_CHANGELOG = [
  "Cálculos judiciais mais simples: cole a sentença ou informe tarifa/seguro e datas — estimativa do que o cliente pode receber.",
  "Leitura de dicas da decisão (juros, honorários %, Tabela TJSP, valores R$).",
  "Fluxo em 3 passos alinhado a liquidação de devolução (correção + juros desde citação + honorários).",
];

export async function GET() {
  const buildId =
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.NEXT_PUBLIC_BUILD_ID ||
    process.env.VERCEL_DEPLOYMENT_ID ||
    process.env.NEXT_BUILD_ID ||
    "dev";

  return NextResponse.json(
    {
      buildId: String(buildId).slice(0, 48),
      env: process.env.VERCEL_ENV || process.env.NODE_ENV || "development",
      ts: Date.now(),
      changelog: LEXIS_CHANGELOG,
      whatsNew: LEXIS_CHANGELOG.join(" "),
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      },
    }
  );
}
