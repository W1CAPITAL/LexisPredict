import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Bump este número a cada lote visível — dispara o banner “Nova versão”. */
export const LEXIS_APP_VERSION = "9.61.1";

export const LEXIS_CHANGELOG: string[] = [
  "9.58.2 — Fix PlanLockGate import no layout + typecheck (case-save, server-db, modelos, auth).",

  "9.58 — Painel Superadmin completo: liberar, bloquear, prazos e sem Pix por empresa.",

  "9.56 — Planos: só a empresa do usuário logado; Máximo não permite contratar plano inferior.",

  "9.55.1 — auth leve: não trava fila/sidebar; refresh só a cada 12+ min em background.",
  "SessionGuard não bloqueia a UI inteira em Validando sessão.",

  "9.55 — sessão estável: refresh ao focar a aba, anti-travamento e tela clara se o login expirar.",
  "Limpa cache da carteira no logout/expiração para não ficar só com dados velhos.",
  "Timeout de 15s no loading de auth — não trava a UI para sempre.",

  "9.54.1 — editar processo de outro usuário NÃO troca o dono (created_by).",
  "Lookup do processo no save usa service role (RLS não esconde mais o dono).",
  "Transferência de carteira só com force_transfer_owner + cargo autorizado.",

  "9.56 — Carteira com fase honesta (sem alerta BA genérico), log de scan em Processos/Fila, caminho do dia no treinamento.",
  "9.55 — Fase honesta no card (o que falta) + dono/último ato; régua só atrasados + marcar pago; log de scan CNJ/hora; README da operação de hoje.",
  "WhatsApp: wake completo da Evolution só no envio (connectionState + presença + abrir chat) — evita ter que clicar no Manager.",
  "Anti-ban Evolution: delay/composing, gap entre envios, teto diário e bloqueio de texto idêntico.",
  "Terminal WhatsApp: botões Mais vencido / Menos vencido no cabeçalho.",
  "Vercel/Next 16: Node 24.x, lint via eslint (acaba o erro da pasta /lint), região gru1 no lugar de preferredRegion.",
  "Peças: modelo Ad Judicia (qualificação + poderes art. 105) e validação de nomes/CPF/placeholders.",
  "Sidebar: grupos claros, busca e ícones distintos.",
  "Lotes 9.53 mantidos: mérito/cumprimento, KPI executivo, fila e export sem colunas internas.",
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
