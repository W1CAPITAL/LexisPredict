import React from 'react';
import { getUserContext } from '@/lib/server-db';
import { getSupervisaoSnapshotAction } from '@/app/actions/supervisao-actions';
import { SupervisaoPDF } from '@/components/pdf/supervisao-pdf';
import { RelatorioEquipePDF } from '@/components/pdf/relatorio-equipe-pdf';
import { montarRelatorioEquipe } from '@/lib/relatorio-equipe-narrativa';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const headers = { 'Cache-Control': 'private, no-store, max-age=0' };

export async function GET(request: Request) {
  try {
    const ctx = await getUserContext();
    if (!ctx.auth_id || !ctx.empresa_id) return Response.json({ error: 'Sessão necessária.' }, { status: 401, headers });
    if (!ctx.isSupervisor && !ctx.isSuperAdmin) return Response.json({ error: 'Exportação disponível para a supervisão da empresa.' }, { status: 403, headers });
    const params = new URL(request.url).searchParams;
    const raw = params.get('periodo');
    const period = raw === 'mes' || raw === 'semana_passada' ? raw : 'esta_semana';
    // The action resolves the company from the authenticated session again.
    const result = await getSupervisaoSnapshotAction(period);
    if (!result.success || !result.snapshot) return Response.json({ error: 'Não foi possível consultar os dados atuais da supervisão.' }, { status: 503, headers });
    const snapshot = result.snapshot;
    const team = params.get('tipo') === 'equipe';
    const element = team
      ? React.createElement(RelatorioEquipePDF, { data: montarRelatorioEquipe(snapshot) })
      : React.createElement(SupervisaoPDF, { data: snapshot, geradoEm: snapshot.geradoEm || new Date().toISOString(), auditor: ctx.nome || undefined });
    const { renderToBuffer } = await import('@react-pdf/renderer');
    const buffer = await renderToBuffer(element as unknown as React.ReactElement<import('@react-pdf/renderer').DocumentProps>);
    return new Response(new Uint8Array(buffer), { headers: { ...headers, 'Content-Type': 'application/pdf', 'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': `attachment; filename="LexisPredict-${team ? 'Equipe' : 'Supervisao'}-${period}.pdf"` } });
  } catch (error) {
    console.error('[supervisao/pdf]', error instanceof Error ? error.message : 'Falha de exportação');
    return Response.json({ error: 'Não foi possível gerar o relatório. Tente novamente.' }, { status: 500, headers });
  }
}
