import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * LEXIS_APP_VERSION — incremente a cada release para o banner aparecer.
 * O buildId mistura SHA do Vercel + esta versão.
 */
export const LEXIS_APP_VERSION = "9.50.0";

/** O que foi adicionado/melhorado nesta versão (banner em tempo real). */
export const LEXIS_CHANGELOG: string[] = [
  "Nova versão 9.50 — lote de estabilidade, KPI, fila e cálculos.",
  "KPI unificado: Dashboard, Top Atendentes e Relatório usam a mesma semana (Brasília, com data fim).",
  "Atendimento conta para quem registrou (não o dono do processo); SUPERVISÃO credita o perfil principal.",
  "Editar com retorno = hoje passa a contar como atendimento.",
  "Cache de sessão nas abas: lista rápida; KPI só com dados da rede (sem somar cache+nuvem).",
  "Scanner: retoma progresso da sessão; replace da carteira sem duplicar fila.",
  "Resumo único no card do processo (menos flags repetidas).",
  "Webhook Evolution com autenticação por secret.",
  "Cálculos: Price/SAC + média Bacen (API pública) + limiar 1,5× (triagem).",
  "Headers de segurança reforçados (CSP, HSTS, XFO, nosniff).",
  "Banner de atualização: lista o que mudou e pede recarregar.",
  "Filtros de lista persistem na sessão ao trocar de aba.",
  "DJEN: texto de decisão limpo (entities HTML) para rascunhos.",
  "Avisos éticos OAB na área de cálculos (não é consulta jurídica automatizada).",
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
