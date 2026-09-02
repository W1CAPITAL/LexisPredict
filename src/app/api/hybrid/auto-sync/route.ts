import { NextRequest, NextResponse } from "next/server";
import { getUserContext } from "@/lib/server-db";
import { sheetsServerPost, sheetsWebhookConfigured } from "@/lib/hybrid/sheets-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_ROWS_PER_REQUEST = 100;

/**
 * Sincronização automática de entrada:
 * - não lê a carteira do Supabase;
 * - recebe o snapshot que já está no cache do navegador;
 * - envia para Sheets em lotes pequenos;
 * - responde mesmo quando a sincronização falhar, sem travar a abertura do app.
 */
export async function POST(req: NextRequest) {
  try {
    const ctx = await getUserContext();
    if (!ctx?.empresa_id) {
      return NextResponse.json({ ok: false, synced: 0, reason: "empresa-nao-identificada" }, { status: 200 });
    }

    if (!sheetsWebhookConfigured()) {
      return NextResponse.json({ ok: false, synced: 0, reason: "sheets-nao-configurado" }, { status: 200 });
    }

    const body = await req.json().catch(() => ({}));
    const rawRows = Array.isArray(body?.rows) ? body.rows : [];
    const empresaId = String(ctx.empresa_id);

    if (!rawRows.length) {
      return NextResponse.json({ ok: true, synced: 0, batches: 0, background: true });
    }

    let synced = 0;
    let batches = 0;

    for (let i = 0; i < rawRows.length; i += MAX_ROWS_PER_REQUEST) {
      const chunk = rawRows.slice(i, i + MAX_ROWS_PER_REQUEST).map((row: any) => ({
        ...(row && typeof row === "object" ? row : {}),
        empresa_id: row?.empresa_id || empresaId,
        EmpresaId: row?.EmpresaId || row?.empresa_id || empresaId,
        source: "LexisPredict-entry-sync",
      }));

      const result = await sheetsServerPost({
        action: "write",
        rows: chunk,
        empresa_id: empresaId,
        source: "LexisPredict-entry-sync",
      });

      if (!result.ok) {
        return NextResponse.json({
          ok: false,
          synced,
          batches,
          error: result.error || `Falha ao sincronizar lote ${batches + 1}`,
        }, { status: 200 });
      }

      synced += Number(result.json?.updated ?? result.json?.inserted ?? chunk.length);
      batches += 1;
    }

    return NextResponse.json({ ok: true, synced, batches, background: true });
  } catch (error: any) {
    return NextResponse.json({
      ok: false,
      synced: 0,
      error: error?.message || "sync indisponivel",
    }, { status: 200 });
  }
}
