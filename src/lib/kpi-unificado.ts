/**
 * KPIs únicos — Painel e Dossiê operacional leem daqui.
 * Sem isso o risco e as novidades divergem (fórmulas diferentes).
 */
import { computeCarteiraKpis } from "@/lib/carteira-kpis";
import { isCasoEncerrado } from "@/lib/status-encerrado";
import { statusEfetivo } from "@/lib/prazo-status";
import { countAtendidosNestaSemana, labelSemanaAtual } from "@/lib/atendimento-semana";
import {
  countEditadosAppSemana,
  countEditadosAppHoje,
  countAuditadosTribunalSemana,
  countAuditadosNestaSemana,
} from "@/lib/processos-auditados";
import { countBaFromCases } from "@/lib/flags-operacionais";

export function temNovidadeCnj(c: any): boolean {
  return !!(
    c?.tem_novo_andamento ||
    c?.tem_atualizacao_pos_retorno ||
    c?.djen_nova_comunicacao
  );
}

export function isVencidoAtivo(c: any): boolean {
  const s = statusEfetivo(c);
  return s === "Vencido" || c?.status === "Caso Crítico" || c?.statusManual === "Caso Crítico";
}

/** Risco 0–100 — mesma conta no Painel e no Dossiê. */
export function riscoCarteiraUnificado(opts: {
  ativos: number;
  vencidos: number;
  hoje: number;
  atencao: number;
  ba: number;
  novidades: number;
}): number {
  const n = Math.max(1, opts.ativos);
  const peso =
    opts.vencidos * 1 +
    opts.hoje * 0.8 +
    opts.atencao * 0.45 +
    opts.ba * 1.5 +
    opts.novidades * 0.35;
  return Math.min(100, Math.round((peso / n) * 100));
}

export function riskLabelFromScore(score: number): {
  riskLabel: string;
  riskLevel: string;
  riskColor: string;
} {
  if (score >= 60) return { riskLabel: "CRÍTICO", riskLevel: "CRÍTICO", riskColor: "text-red-600" };
  if (score >= 40) return { riskLabel: "ALTO", riskLevel: "ALTO", riskColor: "text-orange-600" };
  if (score >= 22) return { riskLabel: "MODERADO", riskLevel: "MODERADO", riskColor: "text-amber-600" };
  return { riskLabel: "SAUDÁVEL", riskLevel: "SAUDÁVEL", riskColor: "text-emerald-600" };
}

export function computeKpiUnificado(cases: any[], opts?: { baHitDigits?: string[]; ref?: Date }) {
  const list = cases || [];
  const ref = opts?.ref ?? new Date();
  const kpis = computeCarteiraKpis(list);
  const ativosList = list.filter((c) => !isCasoEncerrado(c));
  const activeTotal = ativosList.length;

  const countVencido = ativosList.filter(isVencidoAtivo).length;
  const countHoje = ativosList.filter((c) => statusEfetivo(c) === "É Hoje").length;
  const countAtencao = ativosList.filter((c) => statusEfetivo(c) === "Atenção").length;
  const countSaudavel = ativosList.filter((c) => statusEfetivo(c) === "No Prazo").length;
  const countSemPrazo = ativosList.filter((c) => statusEfetivo(c) === "Sem Prazo" || c?.status === "Sem Prazo").length;
  const countNovoAndamento = ativosList.filter(temNovidadeCnj).length;

  const baSet = new Set((opts?.baHitDigits || []).map((x) => String(x).replace(/\D/g, "")).filter(Boolean));
  const countBA = countBaFromCases(ativosList as any, baSet.size ? baSet : undefined);

  const riskScore = riscoCarteiraUnificado({
    ativos: activeTotal,
    vencidos: countVencido,
    hoje: countHoje,
    atencao: countAtencao,
    ba: countBA,
    novidades: countNovoAndamento,
  });
  const risk = riskLabelFromScore(riskScore);

  return {
    total: kpis.total,
    activeTotal,
    countEncerradoCarteira: kpis.encerradosCarteira,
    countEncerradoTribunal: kpis.baixasTribunal,
    baixasTribunalAindaAtivos: kpis.baixasTribunalAindaAtivos,
    countVencido,
    countHoje,
    countAtencao,
    countSaudavel,
    countSemPrazo,
    countNovoAndamento,
    pendentes: countNovoAndamento + countHoje,
    countBA,
    riskScore,
    riskLabel: risk.riskLabel,
    riskLevel: risk.riskLevel,
    riskColor: risk.riskColor,
    rateAndamento: activeTotal > 0 ? Math.round((countNovoAndamento / activeTotal) * 100) : 0,
    countAtendidosSemana: countAtendidosNestaSemana(list, ref),
    countEditadosApp: countEditadosAppSemana(list, ref),
    countAuditadosTribunal: countAuditadosTribunalSemana(list, ref),
    countAuditadosHoje: countEditadosAppHoje(list, ref),
    countAuditadosSemana: countAuditadosNestaSemana(list, ref),
    semanaLabel: labelSemanaAtual(ref),
    ativosList,
  };
}
