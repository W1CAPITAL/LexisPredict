import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin, getUserContext } from "@/lib/server-db";
import { sheetsPing, sheetsServerPost } from "@/lib/hybrid/sheets-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_BATCH = 500;
const MAX_BATCH = 500;
const WEBHOOK_ACTION = "upsert_batch";

function env(name: string) {
  return String(process.env[name] || "").trim();
}

function jsonError(message: string, status = 500) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

async function resolveEmpresaId() {
  const configured = env("LEXIS_HYBRID_EMPRESA_ID");
  if (configured) return configured;
  const ctx = await getUserContext();
  if (!ctx.empresa_id) {
    throw new Error(
      "Não foi possível identificar a empresa pela sessão do Lexis. Configure LEXIS_HYBRID_EMPRESA_ID se necessário.",
    );
  }
  return String(ctx.empresa_id);
}

function normalizeRows(rows: Record<string, any>[]) {
  return rows.map((row) => {
    const d = row?.dados && typeof row.dados === "object" ? row.dados : {};
    return {
      ...row,
      protocolo: row.protocolo_ref ?? row.protocolo ?? d.protocolo ?? d.PROTOCOLO ?? "",
      cliente: row.cliente ?? d.cliente ?? d.CLIENTE ?? "",
      telefone: row.telefone ?? d.telefone ?? d.phone ?? "",
      advogado: row.advogado ?? d.advogado ?? d.ADVOGADO ?? "",
      escritorio: row.escritorio ?? d.escritorio ?? d.ESCRITORIO ?? "",
      tribunal: row.tribunal ?? d.tribunal ?? d.TRIBUNAL ?? "",
      status: row.status ?? d.status ?? "",
      situacao: row.status_interno ?? d.situacao ?? d.status_interno ?? "",
      ultimoRetorno: row.ultimo_retorno ?? d.ultimoRetorno ?? d.ultimo_retorno ?? "",
      proximoRetorno: row.proximo_retorno ?? d.proximoRetorno ?? d.proximo_retorno ?? "",
      criado_por: row.created_by ?? d.created_by ?? "",
      AtendidoPor: row.atendido_por ?? d.atendido_por ?? d.AtendidoPor ?? "",
      Observacao: row.observacoes ?? row.observacao ?? d.observacoes ?? d.observacao ?? "",
      andamento: d.ultimoAndamento ?? d.andamento ?? row.ultimo_movimento ?? "",
      evento_tipo: d.evento_tipo ?? d.Evento_Tipo ?? "",
    };
  });
}

function toMatrix(rows: Record<string, any>[]) {
  const preferred = [
    "id",
    "protocolo",
    "protocolo_ref",
    "cliente",
    "telefone",
    "advogado",
    "escritorio",
    "tribunal",
    "status",
    "status_interno",
    "situacao",
    "ultimoRetorno",
    "ultimo_retorno",
    "proximoRetorno",
    "proximo_retorno",
    "created_by",
    "criado_por",
    "atendido_por",
    "AtendidoPor",
    "observacoes",
    "Observacao",
    "andamento",
    "evento_tipo",
    "empresa_id",
    "created_at",
    "updated_at",
  ];

  const keys = Array.from(
    new Set(rows.flatMap((r) => Object.keys(r)).filter((key) => key !== "dados")),
  );
  const headers = [
    ...preferred.filter((k) => keys.includes(k)),
    ...keys.filter((k) => !preferred.includes(k)),
  ];
  const matrix = rows.map((r) =>
    headers.map((k) => {
      const v = r[k];
      if (v == null) return "";
      if (typeof v === "object") return JSON.stringify(v);
      return String(v);
    }),
  );
  return { headers, matrix };
}

export async function GET() {
  try {
    const empresaId = await resolveEmpresaId();
    const admin = await getSupabaseAdmin();
    const [{ count, error: countError }, sheet] = await Promise.all([
      admin
        .from("processos")
        .select("id", { count: "exact", head: true })
        .eq("empresa_id", empresaId),
      sheetsPing(),
    ]);

    if (countError) throw new Error(countError.message);

    return NextResponse.json({
      ok: true,
      mode: env("LEXIS_HYBRID_MODE") || "sheets_carteira_scan",
      supabase: "ok",
      webhook: sheet.ok ? "ok" : "fail",
      total: count ?? 0,
      empresaId,
      webhookError: sheet.ok ? undefined : sheet.error,
    });
  } catch (error: any) {
    return jsonError(error?.message || String(error), 500);
  }
}

export async function POST(req: NextRequest) {
  const started = Date.now();
  try {
    const body = await req.json();
    if (body?.action !== "seed_batch") return jsonError("Ação inválida.", 400);

    const empresaId = await resolveEmpresaId();
    const admin = await getSupabaseAdmin();
    const batchSize = Math.min(
      MAX_BATCH,
      Math.max(1, Number(body?.batchSize || DEFAULT_BATCH)),
    );

    const countResult = await admin
      .from("processos")
      .select("id", { count: "exact", head: true })
      .eq("empresa_id", empresaId);
    if (countResult.error) {
      throw new Error(`Contagem da carteira falhou: ${countResult.error.message}`);
    }

    // Cursor por id: evita OFFSET e permite retomar sem reler lotes concluídos.
    let query = admin
      .from("processos")
      .select("*")
      .eq("empresa_id", empresaId)
      .order("id", { ascending: true })
      .limit(batchSize);

    if (body?.cursor) query = query.gt("id", body.cursor);

    const { data, error } = await query;
    if (error) throw new Error(`Leitura da carteira falhou: ${error.message}`);

    const rawRows = (data || []) as Record<string, any>[];
    const rows = normalizeRows(rawRows);
    const { headers, matrix } = toMatrix(rows);
    const nextCursor = rawRows.length ? String(rawRows[rawRows.length - 1]?.id ?? "") || null : null;
    const hasMore = rawRows.length === batchSize;

    if (rows.length) {
      const result = await sheetsServerPost({
        action: WEBHOOK_ACTION,
        source: "LexisPredict",
        mode: "sheets_carteira_scan",
        empresa_id: empresaId,
        batch_size: rows.length,
        cursor: body?.cursor ?? null,
        next_cursor: hasMore ? nextCursor : null,
        has_more: hasMore,
        headers,
        matrix,
        rows,
      });

      if (!result.ok) {
        throw new Error(result.error || "Apps Script recusou o lote.");
      }

      const written = Number(result.json?.written ?? result.json?.updated ?? result.json?.added ?? rows.length);

      return NextResponse.json({
        ok: true,
        total: countResult.count ?? 0,
        processed: rows.length,
        accepted: written,
        nextCursor: hasMore ? nextCursor : null,
        hasMore,
        elapsedMs: Date.now() - started,
        sheetUpdated: Number(result.json?.updated ?? 0),
        sheetAdded: Number(result.json?.added ?? 0),
        sheetWritten: written,
      });
    }

    return NextResponse.json({
      ok: true,
      total: countResult.count ?? 0,
      processed: 0,
      accepted: 0,
      nextCursor: null,
      hasMore: false,
      elapsedMs: Date.now() - started,
      sheetUpdated: 0,
      sheetAdded: 0,
      sheetWritten: 0,
    });
  } catch (error: any) {
    return jsonError(error?.message || String(error), 500);
  }
}
