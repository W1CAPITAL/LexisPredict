/**
 * Cron 24h — varredura DataJud/DJEN por empresa.
 * auditCaseCoreSystem já aplica motor parados + falta instaurar.
 */
import { NextResponse } from "next/server";
import { runDataJudScanAction } from "@/app/actions/case-actions";
import { listAllEmpresasSystem } from "@/lib/server-db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const targetId = searchParams.get("empresa_id");

  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized: Token Inválido", { status: 401 });
  }

  try {
    const start = Date.now();
    let totalProcessados = 0;
    let totalAlertas = 0;
    const logs: any[] = [];

    const empresas = targetId
      ? [{ id: targetId, nome: "Alvo Específico" }]
      : await listAllEmpresasSystem();

    for (const emp of empresas) {
      const result = await runDataJudScanAction(emp.id);
      if (result.success) {
        totalProcessados += result.scanned || 0;
        totalAlertas += result.updated || 0;
        logs.push({
          empresa: emp.nome,
          status: "SUCCESS",
          count: result.scanned,
          motor: "parados+instaurar via auditCaseCoreSystem",
        });
      } else {
        logs.push({ empresa: emp.nome, status: "FAIL", error: result.error });
      }
      if (Date.now() - start > 45000) break;
    }

    return NextResponse.json({
      success: true,
      processados: totalProcessados,
      alertas: totalAlertas,
      duration: `${Date.now() - start}ms`,
      motor: "parados_instaurar",
      logs,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
