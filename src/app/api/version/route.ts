import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Bump este número a cada lote visível — dispara o banner “Nova versão”. */
export const LEXIS_APP_VERSION = "9.61.1";

export const LEXIS_CHANGELOG: string[] = [
  "Carteira: Cases/Tarefas = só os meus; Processos da Empresa = todos (sem trocar dono no atendimento).",
  "UI: contraste sólido + cores de letras na personalização.",
  "Changelog compacto no menu (sem histórico antigo).",
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
