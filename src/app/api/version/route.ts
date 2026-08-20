import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const LEXIS_APP_VERSION = "9.53.0";

export const LEXIS_CHANGELOG: string[] = [
  "Nova versão 9.53 — Lote D (mérito / cumprimento / export).",
  "KPI executivo unificado: procedentes, cumprimento ativo/encerrado, falta instaurar, sucumbência.",
  "Dashboard e aba Ações Procedentes usam a mesma regra de contagem.",
  "Fila: bônus para sucumbência e oportunidade de honorários.",
  "Export: colunas executivas legíveis (sem id / empresa_id / created_by).",
  "Lotes B e C mantidos (fila + comunicação 2ª pessoa + âncora DJEN).",
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
