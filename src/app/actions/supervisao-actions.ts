'use server';

/**
 * Supervisão — snapshot operacional da empresa inteira.
 * Processos agrupados por usuário (created_by → nome do perfil).
 */

import { getUserContext, getStoredCasesForEmpresa, getSupabaseAdmin } from '@/lib/server-db';
import { parseUltimoAtendimento, weekBounds, periodBounds, labelPeriodo, type PeriodoRelatorio } from '@/lib/atendimento-semana';
import { countAuditadosNestaSemana, countAuditadosHoje, countAuditadosTribunalSemana, countEditadosAppSemana } from '@/lib/processos-auditados';
import { isCasoEncerrado, isBaixaTribunal } from '@/lib/status-encerrado';

export type SupervisaoProcessoResumo = {
  id: string;
  protocolo: string;
  cliente: string;
  status: string;
  ultimoRetorno: string;
  advogado: string;
  tribunal: string;
  encerrado: boolean;
  novidade: boolean;
};

export type SupervisaoUsuarioGrupo = {
  key: string;
  nome: string;
  total: number;
  ativos: number;
  encerrados: number;
  /** Baixa/trânsito DataJud/DJEN */
  baixasTribunal: number;
  vencidos: number;
  novidades: number;
  atendimentos: number;
  atendidosSemana: number;
  semRetorno: number;
  ba: number;
  processos: SupervisaoProcessoResumo[];
};

export type SupervisaoSnapshot = {
  periodo?: string;
  periodoLabel?: string;
  total: number;
  ativos: number;
  encerrados: number;
  /** Baixa/trânsito DataJud/DJEN (ativos + encerrados) */
  baixasTribunal: number;
  vencidos: number;
  novidades: number;
  ba: number;
  cumprimento: number;
  atendimentosTotais: number;
  atendidosSemana: number;
  auditadosSemana: number;
  auditadosHoje: number;
  auditadosTribunalSemana: number;
  editadosAppSemana: number;
  semRetorno: number;
  operadores: {
    nome: string;
    total: number;
    ativos: number;
    encerrados: number;
    vencidos: number;
    novidades: number;
    atendimentos: number;
    atendidosSemana: number;
    semRetorno: number;
    ba: number;
  }[];
  /** Carteira separada por usuário do sistema (created_by) */
  porUsuario: SupervisaoUsuarioGrupo[];
  timelineSemanal: { label: string; atendidos: number }[];
  porTribunal: { label: string; value: number }[];
  porStatus: { label: string; value: number }[];
  porEscritorio: { label: string; value: number }[];
};

function emptySnapshot(periodoLabel = "Esta semana"): SupervisaoSnapshot {
  return {
    total: 0,
    ativos: 0,
    encerrados: 0,
    baixasTribunal: 0,
    vencidos: 0,
    novidades: 0,
    ba: 0,
    cumprimento: 0,
    atendimentosTotais: 0,
    atendidosSemana: 0,
    auditadosSemana: 0,
    auditadosHoje: 0,
    auditadosTribunalSemana: 0,
    editadosAppSemana: 0,
    semRetorno: 0,
    operadores: [],
    porUsuario: [],
    timelineSemanal: [],
    porTribunal: [],
    porStatus: [],
    porEscritorio: [],
  };
}

export async function getSupervisaoSnapshotAction(
  periodo: 'esta_semana' | 'semana_passada' | 'mes' = 'esta_semana'
): Promise<{
  success: boolean;
  snapshot?: SupervisaoSnapshot;
  error?: string;
}> {
  try {
    const ctx = await getUserContext();
    if (!ctx.empresa_id) return { success: false, error: 'Sessão expirada.' };

    const cases = await getStoredCasesForEmpresa(ctx.empresa_id, false);
    if (!cases || !cases.length) {
      return { success: true, snapshot: { ...emptySnapshot(), periodo: periodo || "esta_semana", periodoLabel: labelPeriodo((periodo || "esta_semana") as any) } };
    }

    // Nomes dos usuários da empresa (created_by = auth_user_id)
    const nomeByAuth = new Map<string, string>();
    try {
      const admin = await getSupabaseAdmin();
      const { data: users } = await admin
        .from('usuarios')
        .select('auth_user_id, nome, email')
        .eq('empresa_id', ctx.empresa_id);
      for (const u of users || []) {
        const id = String((u as any).auth_user_id || '').trim();
        if (id) {
          nomeByAuth.set(id, String((u as any).nome || (u as any).email || 'Usuário').toUpperCase());
        }
      }
    } catch (e) {
      console.warn('[supervisao] users lookup', e);
    }

    const now = new Date();
    const periodoKey = (periodo || 'esta_semana') as PeriodoRelatorio;
    const semana = periodBounds(periodoKey, now);
    const periodoLabel = labelPeriodo(periodoKey, now);

    let ativos = 0,
      encerrados = 0,
      baixasTribunal = 0,
      vencidos = 0,
      novidades = 0,
      ba = 0,
      cumprimento = 0,
      atendimentosTotais = 0,
      atendidosSemana = 0,
      semRetorno = 0;

    const opMap = new Map<string, SupervisaoSnapshot['operadores'][number]>();
    const userMap = new Map<string, SupervisaoUsuarioGrupo>();
    const tjMap = new Map<string, number>();
    const statusMap = new Map<string, number>();
    const escMap = new Map<string, number>();

    const weekBuckets: { start: Date; end: Date; atendidos: number; label: string }[] = [];
    for (let w = 7; w >= 0; w--) {
      const start = new Date(now);
      const dow = (start.getDay() + 6) % 7;
      start.setDate(start.getDate() - dow - w * 7);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      const from = `${start.getDate()}/${start.getMonth() + 1}`;
      const to = `${end.getDate()}/${end.getMonth() + 1}`;
      weekBuckets.push({ start, end, atendidos: 0, label: `${from}–${to}` });
    }

    for (const c of cases as any[]) {
      const encerrado = isCasoEncerrado(c);
      if (encerrado) encerrados++;
      else ativos++;
      if (isBaixaTribunal(c)) {
        baixasTribunal++;
      }

      const status = String(c.status || 'Sem Prazo');
      if (/vencido|cr[ií]tico/i.test(status)) vencidos++;
      const isNov =
        !!(c.tem_novo_andamento || c.tem_atualizacao_pos_retorno || c.djen_nova_comunicacao);
      if (isNov) novidades++;
      if (c.indicio_busca_apreensao || c.evento_tipo === 'ba') ba++;
      if (c.em_cumprimento_sentenca || c.evento_tipo === 'cumprimento_sentenca') cumprimento++;

      const retorno = String(c.ultimoRetorno || c.ultimo_retorno || '').trim();
      const retornoDate = retorno ? parseUltimoAtendimento(retorno) : null;
      if (retornoDate) {
        atendimentosTotais++;
        if (retornoDate >= semana.start && retornoDate <= semana.end) atendidosSemana++;
        for (const wk of weekBuckets) {
          if (retornoDate >= wk.start && retornoDate <= wk.end) wk.atendidos++;
        }
      } else {
        semRetorno++;
      }

      // KPI por assistente (campo livre)
      const opNome = String(c.assistente || c.atendente || '').trim() || 'Sem responsável';
      let op = opMap.get(opNome);
      if (!op) {
        op = {
          nome: opNome,
          total: 0,
          ativos: 0,
          encerrados: 0,
          vencidos: 0,
          novidades: 0,
          atendimentos: 0,
          atendidosSemana: 0,
          semRetorno: 0,
          ba: 0,
        };
        opMap.set(opNome, op);
      }
      op.total++;
      if (encerrado) op.encerrados++;
      else op.ativos++;
      if (/vencido|cr[ií]tico/i.test(status)) op.vencidos++;
      if (isNov) op.novidades++;
      if (c.indicio_busca_apreensao) op.ba++;
      if (retornoDate) {
        op.atendimentos++;
        if (retornoDate >= semana.start && retornoDate <= semana.end) op.atendidosSemana++;
      } else {
        op.semRetorno++;
      }

      // Agrupamento por USUÁRIO do sistema (created_by)
      const authId = String(c.created_by || c.auth_user_id || '').trim();
      const userKey = authId || 'sem-usuario';
      const userNome =
        (authId && nomeByAuth.get(authId)) ||
        String(c.assistente || c.atendente || '').trim() ||
        (authId ? `Usuário ${authId.slice(0, 8)}` : 'Sem usuário atribuído');

      let ug = userMap.get(userKey);
      if (!ug) {
        ug = {
          key: userKey,
          nome: userNome,
          total: 0,
          ativos: 0,
          encerrados: 0,
          baixasTribunal: 0,
          vencidos: 0,
          novidades: 0,
          atendimentos: 0,
          atendidosSemana: 0,
          semRetorno: 0,
          ba: 0,
          processos: [],
        };
        userMap.set(userKey, ug);
      }
      ug = userMap.get(userKey)!;
      ug.total++;
      if (encerrado) ug.encerrados++;
      else ug.ativos++;
      if (isBaixaTribunal(c)) {
        ug.baixasTribunal++;
      }
      if (/vencido|cr[ií]tico/i.test(status)) ug.vencidos++;
      if (isNov) ug.novidades++;
      if (c.indicio_busca_apreensao) ug.ba++;
      if (retornoDate) {
        ug.atendimentos++;
        if (retornoDate >= semana.start && retornoDate <= semana.end) ug.atendidosSemana++;
      } else {
        ug.semRetorno++;
      }
      ug.processos.push({
        id: String(c.id || c.protocolo || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()))),
        protocolo: String(c.protocolo || ''),
        cliente: String(c.cliente || '—'),
        status,
        ultimoRetorno: retorno || '—',
        advogado: String(c.advogado || '—'),
        tribunal: String(c.tribunal || '—'),
        encerrado,
        novidade: isNov,
      });

      const tj = String(c.tribunal || '—');
      tjMap.set(tj, (tjMap.get(tj) || 0) + 1);
      statusMap.set(status, (statusMap.get(status) || 0) + 1);
      const esc = String(c.escritorio || 'Sem escritório');
      escMap.set(esc, (escMap.get(esc) || 0) + 1);
    }

    // Ordenar processos de cada usuário por cliente
    for (const ug of userMap.values()) {
      ug.processos.sort((a, b) => a.cliente.localeCompare(b.cliente, 'pt-BR'));
    }

    const toLabelVal = (m: Map<string, number>) =>
      [...m.entries()]
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 12);

    return {
      success: true,
      snapshot: {
        periodo: periodoKey,
        periodoLabel,
        total: cases.length,
        ativos,
        encerrados,
        baixasTribunal,
        vencidos,
        novidades,
        ba,
        cumprimento,
        atendimentosTotais,
        atendidosSemana,
      auditadosSemana: countAuditadosNestaSemana(cases as any),
      auditadosHoje: countAuditadosHoje(cases as any),
      auditadosTribunalSemana: countAuditadosTribunalSemana(cases as any),
      editadosAppSemana: countEditadosAppSemana(cases as any),
      
        semRetorno,
        operadores: [...opMap.values()].sort((a, b) => b.total - a.total),
        porUsuario: [...userMap.values()].sort((a, b) => b.total - a.total),
        timelineSemanal: weekBuckets.map((w) => ({ label: w.label, atendidos: w.atendidos })),
        porTribunal: toLabelVal(tjMap),
        porStatus: toLabelVal(statusMap),
        porEscritorio: toLabelVal(escMap),
      },
    };
  } catch (e: any) {
    console.error('[supervisao]', e);
    return { success: false, error: e?.message || 'Falha ao carregar supervisão.' };
  }
}
