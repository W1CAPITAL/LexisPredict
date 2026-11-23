'use server';

import { getSupabaseAdmin, getUserContext } from '@/lib/server-db';
import { cnjDigits, formatCnj } from '@/lib/processos-timeline';

export type AtendimentoProcessoItem = {
  id: string;
  data: string;
  titulo: string;
  descricao: string;
  responsavel: string;
  origem: 'registro' | 'auditoria';
  contatoConfirmado: boolean | null;
  proximoRetorno?: string;
};

export type HistoricoAtendimentoProcessoResultado = {
  ok: boolean;
  items: AtendimentoProcessoItem[];
  partial: boolean;
  message: string;
};

const empty = (message: string): HistoricoAtendimentoProcessoResultado =>
  ({ ok: false, items: [], partial: false, message });

/**
 * Histórico operacional sob demanda. Nunca lista eventos de outra empresa.
 * Não substitui consulta judicial nem presume contato a partir de auditoria.
 */
export async function getHistoricoAtendimentoProcessoAction(
  processId: string,
  cnj: string,
): Promise<HistoricoAtendimentoProcessoResultado> {
  const id = String(processId || '').trim();
  const numero = cnjDigits(cnj);
  if (!id || !/^[0-9a-f-]{1,72}$/i.test(id) || !numero) {
    return empty('Processo inválido.');
  }

  try {
    const ctx = await getUserContext();
    if (!ctx.auth_id || !ctx.empresa_id) return empty('Sessão expirada.');
    const db = await getSupabaseAdmin();

    // O identificador vindo da interface é apenas candidato; confirmar o
    // processo e o CNJ dentro do tenant antes de ler eventos privados.
    const { data: processRow, error: processError } = await db.from('processos')
      .select('id,protocolo_ref')
      .eq('empresa_id', ctx.empresa_id)
      .eq('id', processId)
      .maybeSingle();
    if (processError) return empty('Falha ao conferir a carteira.');
    if (!processRow || cnjDigits(processRow.protocolo_ref) !== numero) {
      return empty('Processo não encontrado na empresa autorizada.');
    }

    const variants = [...new Set([String(processRow.protocolo_ref), numero, formatCnj(numero)])];
    const [activitiesResult, auditResult] = await Promise.allSettled([
      db.from('tarefas_realizadas')
        .select('id,titulo,descricao,data_realizacao,created_at,responsavel_auth_user_id,contato_cliente_confirmado')
        .eq('empresa_id', ctx.empresa_id)
        .eq('processo_id', processRow.id)
        .eq('categoria', 'atendimento')
        .order('created_at', { ascending: false })
        .limit(30),
      db.from('auditoria_logs_app')
        .select('id,action,created_at,user_nome,auth_user_id,detalhes')
        .eq('empresa_id', ctx.empresa_id)
        .in('protocolo_ref', variants)
        .in('action', ['atendimento', 'encerramento'])
        .order('created_at', { ascending: false })
        .limit(30),
    ]);

    const errors: string[] = [];
    const rows = (result: PromiseSettledResult<any>, label: string): any[] => {
      if (result.status === 'rejected' || result.value?.error) {
        errors.push(label);
        return [];
      }
      return result.value?.data || [];
    };
    const activityRows = rows(activitiesResult, 'Registros manuais');
    const auditRows = rows(auditResult, 'Atendimentos do Lexis');

    // Os nomes são associados somente a usuários da mesma empresa.
    const userIds = [...new Set(activityRows.map(row => String(row.responsavel_auth_user_id || '')).filter(Boolean))];
    const names = new Map<string, string>();
    if (userIds.length) {
      const { data: people, error: usersError } = await db.from('usuarios')
        .select('auth_user_id,nome')
        .eq('empresa_id', ctx.empresa_id)
        .in('auth_user_id', userIds);
      if (usersError) errors.push('Nomes dos responsáveis');
      for (const person of people || []) names.set(String(person.auth_user_id), String(person.nome || '').trim());
    }

    const items: AtendimentoProcessoItem[] = [
      ...activityRows.map(row => ({
        id: 'registro:' + String(row.id),
        data: String(row.data_realizacao || row.created_at || ''),
        titulo: String(row.titulo || 'Atendimento registrado'),
        descricao: String(row.descricao || ''),
        responsavel: names.get(String(row.responsavel_auth_user_id || '')) || 'Responsável não informado',
        origem: 'registro' as const,
        contatoConfirmado: row.contato_cliente_confirmado === true,
      })),
      ...auditRows.map(row => {
        const details = row.detalhes && typeof row.detalhes === 'object' ? row.detalhes as Record<string, unknown> : {};
        return {
          id: 'auditoria:' + String(row.id),
          data: String(row.created_at || ''),
          titulo: row.action === 'encerramento' ? 'Atendimento e encerramento' : 'Atendimento registrado',
          descricao: String(details.observacao || ''),
          responsavel: String(row.user_nome || '').trim() || 'Responsável não informado',
          origem: 'auditoria' as const,
          contatoConfirmado: null,
          proximoRetorno: typeof details.proximoPrazo === 'string' ? details.proximoPrazo : undefined,
        };
      }),
    ].sort((a, b) => b.data.localeCompare(a.data)).slice(0, 30);

    return {
      ok: errors.length < 2 || items.length > 0,
      items,
      partial: errors.length > 0,
      message: errors.length ? 'Histórico parcial: ' + errors.join(' e ') + ' indisponível.' :
        items.length ? '' : 'Nenhum atendimento registrado nas fontes consultadas para este processo.',
    };
  } catch (error) {
    console.error('[historico-atendimento-processo]', error);
    return empty('Não foi possível consultar o histórico agora.');
  }
}
