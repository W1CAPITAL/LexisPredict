import { uniqueCases } from './case-identity';
import { resolveTemNovoAndamento } from './novidade';
import { temBaCarteira } from './flags-operacionais';
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
  return resolveTemNovoAndamento(c);
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
  const ba = Math.min(Math.max(0, opts.ba), n);
  const venc = Math.min(Math.max(0, opts.vencidos), n);
  const hoje = Math.min(Math.max(0, opts.hoje), n);
  const atencao = Math.min(Math.max(0, opts.atencao), n);
  const nov = Math.min(Math.max(0, opts.novidades), n);
  // Fração da carteira ATIVA — não soma baixa de tribunal nem hit órfão.
  const peso = venc * 0.55 + hoje * 0.12 + atencao * 0.18 + ba * 0.28 + nov * 0.08;
  return Math.min(92, Math.round((peso / n) * 100));
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
  const list = uniqueCases(cases || []);
  const ref = opts?.ref ?? new Date();
  const kpis = computeCarteiraKpis(list);
  const ativosList = list.filter((c) => !isCasoEncerrado(c));
  const activeTotal = ativosList.length;

  const countVencido = ativosList.filter(isVencidoAtivo).length;
  const countHoje = ativosList.filter((c) => statusEfetivo(c) === "É Hoje").length;
  const countAtencao = ativosList.filter((c) => statusEfetivo(c) === "Atenção").length;
  const countSaudavel = ativosList.filter((c) => statusEfetivo(c) === "No Prazo").length;
  const countSemPrazo = ativosList.filter((c) => statusEfetivo(c) === "Sem Prazo").length;
  const countNovoAndamento = ativosList.filter(temNovidadeCnj).length;

  const baSet = new Set((opts?.baHitDigits || []).map((x) => String(x).replace(/\D/g, "")).filter(Boolean));
  const countBA = countBaFromCases(ativosList as any, baSet.size ? baSet : undefined);

  const caseScores = ativosList.map(c => {
    const status = statusEfetivo(c);
    return Math.max(
      isVencidoAtivo(c) ? 100 : status === 'É Hoje' ? 70 : status === 'Atenção' ? 40 : status === 'Sem Prazo' ? 15 : 0,
      temBaCarteira(c, baSet) ? 90 : 0,
      temNovidadeCnj(c) ? 25 : 0,
    );
  });
  const riskScore = activeTotal ? Math.round(caseScores.reduce((sum, score) => sum + score, 0) / activeTotal) : 0;
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
    pendentes: ativosList.filter(c => temNovidadeCnj(c) || statusEfetivo(c) === "É Hoje").length,
    caseScores,
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
