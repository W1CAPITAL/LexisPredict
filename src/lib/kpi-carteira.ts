/**
 * Fonte única de KPIs de carteira — Dashboard / Cases / Tarefas / Supervisão / Report
 * Atendido = ultimo_retorno na semana (Brasília). Não misturar com edição app nem tribunal.
 */
import {
  countAtendidosNestaSemana,
  countAtendidosSemanaDoUsuario,
  countAtendidosHojeDoUsuario,
  isAtendidoHoje,
  casoAtendidoNestaSemana,
  labelSemanaAtual,
  pickUltimoRetorno,
} from '@/lib/atendimento-semana';
import {
  countEditadosAppSemana,
  countEditadosAppHoje,
  countAuditadosTribunalSemana,
} from '@/lib/processos-auditados';

export type KpiCarteira = {
  atendidosSemana: number;
  atendidosHoje: number;
  editadosSemana: number;
  editadosHoje: number;
  tribunalSemana: number;
  semanaLabel: string;
  /** Só para perfil individual — usa atendido_por (legado: created_by) */
  atendidosSemanaUsuario: number;
  atendidosHojeUsuario: number;
};

export function computeKpiCarteira(
  cases: any[],
  opts?: { userId?: string | null; ref?: Date }
): KpiCarteira {
  const ref = opts?.ref ?? new Date();
  const list = cases || [];
  return {
    atendidosSemana: countAtendidosNestaSemana(list, ref),
    atendidosHoje: list.filter((c) => isAtendidoHoje(pickUltimoRetorno(c), ref)).length,
    editadosSemana: countEditadosAppSemana(list, ref),
    editadosHoje: countEditadosAppHoje(list, ref),
    tribunalSemana: countAuditadosTribunalSemana(list, ref),
    semanaLabel: labelSemanaAtual(ref),
    atendidosSemanaUsuario: countAtendidosSemanaDoUsuario(list, opts?.userId, ref),
    atendidosHojeUsuario: countAtendidosHojeDoUsuario(list, opts?.userId, ref),
  };
}

export { casoAtendidoNestaSemana, countAtendidosNestaSemana, labelSemanaAtual };
