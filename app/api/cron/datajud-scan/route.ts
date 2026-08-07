/**
 * @fileOverview Rota de Automação de Varredura DataJud v2.0
 * Executa auditoria programada via agendadores externos (Vercel Cron / GitHub Actions).
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 */

import { NextResponse } from 'next/server';
import { runDataJudScanAction } from '@/app/actions/case-actions';
import { listAllEmpresasSystem } from '@/lib/server-db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const targetId = searchParams.get('empresa_id');
  
  // 1. Validação de Token de Segurança (CRON_SECRET)
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized: Token Inválido', { status: 401 });
  }

  try {
    const start = Date.now();
    let totalProcessados = 0;
    let totalAlertas = 0;
    const logs: any[] = [];

    // 2. Definição do Escopo de Varredura
    const empresas = targetId ? [{ id: targetId, nome: 'Alvo Específico' }] : await listAllEmpresasSystem();

    // 3. Execução em Lote por Empresa (Modo Sistema)
    // Nota: Limitamos a execução para não exceder o timeout do servidor (geralmente 60s)
    // Recomenda-se rodar uma empresa por chamada se a carteira for muito grande
    for (const emp of empresas) {
      const result = await runDataJudScanAction(emp.id);
      if (result.success) {
        totalProcessados += result.scanned || 0;
        totalAlertas += result.updated || 0;
        logs.push({ empresa: emp.nome, status: 'SUCCESS', count: result.scanned });
      } else {
        logs.push({ empresa: emp.nome, status: 'FAIL', error: result.error });
      }
      
      // Se estivermos perto do timeout (45s), interrompemos e retornamos o progresso
      if (Date.now() - start > 45000) break;
    }

    return NextResponse.json({ 
      success: true, 
      processados: totalProcessados,
      alertas: totalAlertas,
      duration: `${Date.now() - start}ms`,
      logs
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}