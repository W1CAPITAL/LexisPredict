import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Endpoint legado mantido apenas para não quebrar links antigos.
 * NÃO importa case-actions, NÃO executa DataJud e NÃO é usado por Vercel Cron.
 * O scanner DataJud deve ser disparado somente por fluxo manual/administrado.
 */
export async function GET() {
  return NextResponse.json(
    {
      ok: false,
      disabled: true,
      scanner: "datajud",
      message: "Scanner automático desativado. Vercel Cron não é utilizado.",
    },
    { status: 410 },
  );
}
