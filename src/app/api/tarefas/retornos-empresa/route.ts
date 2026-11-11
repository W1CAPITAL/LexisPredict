import { NextResponse } from 'next/server';
import { getSupabaseAdmin, getUserContext } from '@/lib/server-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

function todayInSaoPaulo(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return \`\${values.year}-\${values.month}-\${values.day}\`;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function firstValue(...values: unknown[]): unknown {
  return values.find((value) => value !== null && value !== undefined && String(value).trim() !== '');
}

export async function GET(request: Request) {
  try {
    const ctx = await getUserContext();
    if (!ctx?.empresa_id) {
      return NextResponse.json({ ok: false, error: 'Empresa não identificada.' }, { status: 401 });
    }

    const url = new URL(request.url);
    const ate = String(url.searchParams.get('ate') || todayInSaoPaulo()).trim();
    if (!/^20\d{2}-\d{2}-\d{2}$/.test(ate) || Number.isNaN(Date.parse(\`\${ate}T00:00:00.000Z\`))) {
      return NextResponse.json({ ok: false, error: 'Data de referência inválida.' }, { status: 400 });
    }

    const offset = Math.max(0, Math.min(500_000, Number.parseInt(url.searchParams.get('offset') || '0', 10) || 0));
    const limit = Math.max(1, Math.min(1000, Number.parseInt(url.searchParams.get('limit') || '1000', 10) || 1000));
    const admin = getSupabaseAdmin();
    const { data, error, count } = await admin
      .from('processos')
      .select('id,empresa_id,cliente,protocolo_ref,advogado,escritorio,tribunal,status,status_interno,proximo_retorno,ultimo_retorno,created_by,dados', { count: 'exact' })
      .eq('empresa_id', ctx.empresa_id)
      .not('proximo_retorno', 'is', null)
      .lte('proximo_retorno', ate)
      .order('proximo_retorno', { ascending: true, nullsFirst: false })
      .order('id', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('[Tarefas empresa] consulta de retornos', error.message);
      return NextResponse.json({ ok: false, error: 'Não foi possível consultar os retornos da empresa.' }, { status: 503 });
    }

    const cases = (data || []).map((row: Record<string, unknown>) => {
      const dados = asRecord(row.dados);
      return {
        ...dados,
        id: String(row.id),
        db_id: String(row.id),
        empresa_id: row.empresa_id,
        created_by: row.created_by ?? null,
        cliente: firstValue(row.cliente, dados.cliente, dados.cliente_nome, dados.nomeCliente) ?? 'Cliente não identificado',
        protocolo: firstValue(row.protocolo_ref, dados.protocolo, dados.numeroProcesso) ?? '',
        advogado: firstValue(row.advogado, dados.advogado) ?? '',
        escritorio: firstValue(row.escritorio, dados.escritorio) ?? '',
        tribunal: firstValue(row.tribunal, dados.tribunal) ?? '',
        status: firstValue(row.status, dados.status) ?? '',
        status_interno: firstValue(row.status_interno, dados.status_interno) ?? '',
        situacao: firstValue(row.status_interno, dados.situacao) ?? 'EM ANDAMENTO',
        statusManual: firstValue(dados.statusManual, dados.status_manual) ?? 'Automatico',
        proximoPrazo: firstValue(row.proximo_retorno, dados.proximoPrazo, dados.proximo_retorno) ?? null,
        ultimoRetorno: firstValue(row.ultimo_retorno, dados.ultimoRetorno, dados.ultimo_retorno) ?? null,
      };
    });

    const totalCount = count ?? cases.length;
    return NextResponse.json({
      ok: true,
      scope: 'empresa',
      ate,
      cases,
      offset,
      limit,
      totalCount,
      hasMore: offset + cases.length < totalCount,
      consultadoEm: new Date().toISOString(),
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('[Tarefas empresa] erro inesperado', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ ok: false, error: 'Falha ao carregar os retornos da empresa.' }, { status: 500 });
  }
}
