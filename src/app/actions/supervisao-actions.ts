'use server';

/**
 * Supervisão — snapshot operacional da empresa inteira.
 * Processos agrupados por usuário (created_by → nome do perfil).
 */

import { getUserContext, getStoredCasesForEmpresa, getSupabaseAdmin } from '@/lib/server-db';
import { parseUltimoAtendimento, humanWorkEvents, hojeBrasilYmd, periodBounds, labelPeriodo, type PeriodoRelatorio } from '@/lib/atendimento-semana';
import { countAuditadosNestaSemana, countAuditadosHoje, countAuditadosTribunalSemana, countEditadosAppSemana } from '@/lib/processos-auditados';
import { isCasoEncerrado, isBaixaTribunal } from '@/lib/status-encerrado';
import { getHistoricoAtendimentosEmpresa,emptyHistorico,type AtendimentosHistorico } from '@/lib/historico-atendimentos';
import { getResumoAnalisesDaEmpresa, EMPTY_ANALISES, type AnalisesResumo } from '@/lib/analises-internas';

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
  historicoAtendimentos:AtendimentosHistorico;
  analisesInternas: AnalisesResumo;
  /** Horário UTC em que a consulta foi executada */
  geradoEm?: string;
  /** Última alteração registrada na carteira consultada */
  ultimaAlteracaoEm?: string;
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
  /** % processos com ao menos um retorno (0–100) */
  taxaRetornoPct: number;
  /** % ativos com retorno no período selecionado */
  taxaRetornoPeriodoPct: number;
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
    historicoAtendimentos:emptyHistorico(),
    analisesInternas: EMPTY_ANALISES,
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
    taxaRetornoPct: 0,
    taxaRetornoPeriodoPct: 0,
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
    if (!ctx.isSupervisor && !ctx.isSuperAdmin) {
      return { success: false, error: 'Acesso restrito a Supervisor ou Superadmin.' };
    }

    const cases = await getStoredCasesForEmpresa(ctx.empresa_id, false);
    if (!cases || !cases.length) {
      return { success: true, snapshot: { ...emptySnapshot(), periodo: periodo || "esta_semana", periodoLabel: labelPeriodo((periodo || "esta_semana") as any) } };
    }

    // Nomes dos usuários da empresa (created_by = auth_user_id)
    const nomeByAuth = new Map<string, string>();
    const ownerCanonico = new Map<string, string>();
    try {
      const admin = await getSupabaseAdmin();
      const { data: users } = await admin
        .from('usuarios')
        .select('id, auth_user_id, nome, email')
        .eq('empresa_id', ctx.empresa_id);
      for (const u of users || []) {
        const authId = String((u as any).auth_user_id || '').trim();
        const perfilId = String((u as any).id || '').trim();
        const canonico = authId || perfilId;
        const nome = String((u as any).nome || (u as any).email || 'Usuário').toUpperCase();
        // created_by tem registros legados com usuarios.id E registros com auth_user_id.
        for (const key of [authId, perfilId]) {
          if (key) {
            nomeByAuth.set(key, nome);
            ownerCanonico.set(key, canonico);
          }
        }
      }
    } catch (e) {
      console.warn('[supervisao] users lookup', e);
    }

    const now = new Date();
    const hojeBR = parseUltimoAtendimento(hojeBrasilYmd(now)) || now;
    let ultimaAlteracaoMs = 0;
    const periodoKey = (periodo || 'esta_semana') as PeriodoRelatorio;
    const semana = periodBounds(periodoKey, now);
    const periodoLabel = labelPeriodo(periodoKey, now);
    const toYmd=(d:Date)=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
    let historicoAtendimentos=emptyHistorico(periodoKey);
    try {historicoAtendimentos=await getHistoricoAtendimentosEmpresa(ctx.empresa_id,periodoKey);}catch(e){console.warn('[supervisao] historico atendimento',e);}
    let analisesInternas:AnalisesResumo=EMPTY_ANALISES;
    try { analisesInternas=await getResumoAnalisesDaEmpresa(ctx.empresa_id,toYmd(semana.start),toYmd(semana.end)); }
    catch(e){console.warn('[supervisao] resumo de analises internas indisponivel',e);}

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
      const start = new Date(hojeBR);
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
      const alteracaoMs = Date.parse(String(c.updated_at || c.created_at || ''));
      if (Number.isFinite(alteracaoMs) && alteracaoMs > ultimaAlteracaoMs) ultimaAlteracaoMs = alteracaoMs;
      const encerrado = isCasoEncerrado(c);
      if (encerrado) encerrados++;
      else ativos++;
      if (isBaixaTribunal(c)) {
        baixasTribunal++;
      }

      const status = String(c.status || 'Sem Prazo');
      // Regra canônica de /processos, /report e RPC lexis_portfolio_snapshot:
      // Vencido é o status explicitamente registrado, não qualquer data antiga.
      // Prazos antigos com status 'No Prazo', 'Atenção' ou 'É Hoje' são
      // acompanhamentos separados; não somar como vencidos no KPI.
      const vencidoAtual = !encerrado && (status === 'Vencido' || status === 'Caso Crítico');
      if (vencidoAtual) vencidos++;
      const isNov =
        !!(c.tem_novo_andamento || c.tem_atualizacao_pos_retorno || c.djen_nova_comunicacao);
      if (isNov) novidades++;
      if (c.indicio_busca_apreensao || c.evento_tipo === 'ba') ba++;
      if (c.em_cumprimento_sentenca || c.evento_tipo === 'cumprimento_sentenca') cumprimento++;

      const retorno = String(
        c.ultimoRetorno || c.ultimo_retorno || (c as any).dados?.ultimoRetorno || ''
      ).trim();
      const temTextoRetorno = !!retorno && retorno !== '-' && retorno.toLowerCase() !== 'null' && retorno !== '0';
      // Retorno no cadastro NÃO é prova de atendimento humano no período:
      // scanner e WhatsApp automático podem avançar a data de retorno.
      const diasTrabalho = humanWorkEvents(c)
        .map((e) => parseUltimoAtendimento(e.date))
        .filter((d): d is Date => !!d);
      const atendidoNoPeriodo = diasTrabalho.some((d) => d >= semana.start && d <= semana.end);
      if (temTextoRetorno) atendimentosTotais++;
      else semRetorno++;
      if (atendidoNoPeriodo) atendidosSemana++;
      for (const wk of weekBuckets) {
        if (diasTrabalho.some((d) => d >= wk.start && d <= wk.end)) wk.atendidos++;
      }

      const ownerRef = String(c.created_by || c.auth_user_id || '').trim();
      const ownerKey = ownerCanonico.get(ownerRef) || ownerRef || 'sem-usuario';
      const ownerNome = nomeByAuth.get(ownerRef) || '';
      // KPI por assistente (campo livre)
      const opNome = ownerNome || String(c.assistente || c.atendente || '').trim() || 'Sem responsável identificado';
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
      if (vencidoAtual) op.vencidos++;
      if (isNov) op.novidades++;
      if (c.indicio_busca_apreensao) op.ba++;
      if (temTextoRetorno) op.atendimentos++;
      else op.semRetorno++;
      // Edição manual também conta como atividade da equipe, mesmo sem retorno ao cliente.
      if (atendidoNoPeriodo) op.atendidosSemana++;

      // IDs legados e atuais do MESMO usuário se unem no mesmo grupo.
      const userKey = ownerKey;
      const userNome =
        ownerNome ||
        String(c.assistente || c.atendente || '').trim() ||
        (ownerRef ? `Usuário ${ownerRef.slice(0, 8)}` : 'Sem usuário atribuído');

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
      if (vencidoAtual) ug.vencidos++;
      if (isNov) ug.novidades++;
      if (c.indicio_busca_apreensao) ug.ba++;
      if (temTextoRetorno) ug.atendimentos++;
      else ug.semRetorno++;
      if (atendidoNoPeriodo) ug.atendidosSemana++;
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

    // Crédito de atendimento pertence ao executor autenticado, não ao dono da carteira.
    const atendimentoPorAuth=new Map(historicoAtendimentos.porUsuario.map(u=>[u.userId,u.processos]));
    for (const ug of userMap.values()) {
      ug.atendidosSemana=atendimentoPorAuth.get(ug.key)||0;
    }
    for (const op of opMap.values()) {
      const user=historicoAtendimentos.porUsuario.find(u=>u.nome.toUpperCase()===op.nome.toUpperCase());
      op.atendidosSemana=user?.processos||0;
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
        analisesInternas,
        historicoAtendimentos,
        geradoEm: now.toISOString(),
        ultimaAlteracaoEm: ultimaAlteracaoMs ? new Date(ultimaAlteracaoMs).toISOString() : undefined,
        total: cases.length,
        ativos,
        encerrados,
        baixasTribunal,
        vencidos,
        novidades,
        ba,
        cumprimento,
        atendimentosTotais,
        atendidosSemana:historicoAtendimentos.atualizadoEm?historicoAtendimentos.processos:atendidosSemana,
      auditadosSemana: countAuditadosNestaSemana(cases as any),
      auditadosHoje: countAuditadosHoje(cases as any),
      auditadosTribunalSemana: countAuditadosTribunalSemana(cases as any),
      editadosAppSemana: countEditadosAppSemana(cases as any),
      
        semRetorno,
        taxaRetornoPct:
          cases.length > 0
            ? Math.min(100, Math.round((atendimentosTotais / cases.length) * 100))
            : 0,
        taxaRetornoPeriodoPct: (() => {
          const base = Math.max(1, cases.filter((c: any) => !isCasoEncerrado(c)).length || cases.length);
          return Math.min(100, Math.round(((historicoAtendimentos.atualizadoEm?historicoAtendimentos.processos:atendidosSemana) / base) * 100));
        })(),
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
