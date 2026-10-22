/**
 * Contagens unificadas: Dashboard ↔ Ações Procedentes ↔ Report.
 * Uma regra só — evita "40 na aba e 12 no painel".
 */
import { isSentencaProcedente, isSentencaImprocedente } from '@/lib/merito-detect';
import { isCasoEncerrado } from '@/lib/status-encerrado';

function dadosOf(c: any): any {
  return c?.dados && typeof c.dados === 'object' ? c.dados : {};
}

export type CategoriaMeritoCadastrado = "procedente"|"improcedente"|"parcial"|"divergente"|"sem_indicador";

/** Espelha o RPC lexis_merito_snapshot. Classificação do CRM, não decisão
 * judicial validada. Não confunde procedência parcial e resultados opostos.
 */
export function categoriaMeritoCadastrado(c:any):CategoriaMeritoCadastrado{
 if(!c)return "sem_indicador";
 const d=dadosOf(c);
 // Movimentações oficiais do DataJud prevalecem sobre flags e notas internas.
 // Outros desfechos (acordo, indeferimento etc.) não são improcedência.
 const oficial = d.merito_fonte === "datajud_tpu_2026-10-22"
   ? String(d.merito_datajud_20261022?.resultado || "") : "";
 if (oficial) {
   if (oficial === "procedente" || oficial === "improcedente" || oficial === "parcial") return oficial;
   if (oficial === "conflito_resultados") return "divergente";
   return "sem_indicador";
 }
 const evento=String(c.evento_tipo||d.evento_tipo||"").toLowerCase();
 const merito=String(c.merito_resultado||d.merito_resultado||"").toLowerCase();
 const proc=c.is_procedente===true||d.is_procedente===true
   || evento==="sentenca_procedente"||merito==="procedente";
 const imp=c.is_improcedente===true||d.is_improcedente===true
   || d.sentenca_improcedente===true||evento==="sentenca_improcedente"||merito==="improcedente";
 const partial=d.sentenca_parcial===true||evento==="sentenca_parcial"||merito==="parcial";
 if((proc&&imp)||(partial&&imp))return "divergente";
 if(partial)return "parcial";
 if(imp)return "improcedente";
 if(proc)return "procedente";
 return "sem_indicador";
}
export function flagProcedente(c:any):boolean{
 return categoriaMeritoCadastrado(c)==="procedente";
}
export function flagImprocedente(c:any):boolean{
 return categoriaMeritoCadastrado(c)==="improcedente";
}

export function flagCumprimentoAtivo(c: any): boolean {
  const d = dadosOf(c);
  if (c?.cumprimento_encerrado || d.cumprimento_encerrado) return false;
  return !!(
    c?.em_cumprimento_sentenca ||
    d.em_cumprimento_sentenca ||
    c?.evento_tipo === 'cumprimento_sentenca'
  );
}

export function flagCumprimentoEncerrado(c: any): boolean {
  const d = dadosOf(c);
  return !!(c?.cumprimento_encerrado || d.cumprimento_encerrado);
}

export function flagFaltaInstaurar(c: any): boolean {
  const d = dadosOf(c);
  if (flagCumprimentoAtivo(c) || flagCumprimentoEncerrado(c)) return false;
  return !!(
    c?.cumprimento_pendente_necessario ||
    d.cumprimento_pendente_necessario
  );
}

export function oportunidadeOf(c: any): any | null {
  const d = dadosOf(c);
  return (
    c?.oportunidade_instaurar ||
    d.oportunidade_instaurar ||
    c?.detalhes_execucao?.oportunidade_instaurar ||
    d.detalhes_execucao?.oportunidade_instaurar ||
    null
  );
}

export function flagOportunidadeHonorarios(c: any): boolean {
  const op = oportunidadeOf(c);
  if (!op) return false;
  if (op.elegivel === false) return false;
  const score = Number(op.score ?? c?.oportunidade_score ?? 0);
  const tipo = String(op.tipo_credito || op.tipo || '').toLowerCase();
  if (op.acima_limiar_cobranca) return true;
  if (score >= 55) return true;
  if (tipo.includes('sucumb') || tipo === 'ambos') return score >= 40;
  return false;
}

export function flagSucumbencia(c: any): boolean {
  const op = oportunidadeOf(c);
  const tipo = String(op?.tipo_credito || op?.tipo || c?.oportunidade_tipo_credito || '').toLowerCase();
  if (tipo.includes('sucumb') || tipo === 'ambos') return true;
  const blob = `${c?.evento_resumo || ''} ${c?.djen_ultimo_resumo || ''} ${JSON.stringify(op || {})}`.toUpperCase();
  return /SUCUMB[EÊ]NCIA|HONOR[AÁ]RIOS\s+ADVOCAT[IÍ]CIOS|ART\.?\s*85/.test(blob);
}

export type KpiExecutivo = {
  total: number;
  procedentes: number;
  improcedentes: number;
  parciais: number;
  divergentesMerito: number;
  cumprimentoAtivo: number;
  cumprimentoEncerrado: number;
  faltaInstaurar: number;
  oportunidadeHonorarios: number;
  sucumbencia: number;
  baixasTribunal: number;
  encerradosCarteira: number;
};

export function computeKpiExecutivo(cases: any[]): KpiExecutivo {
  const list = cases || [];
  let procedentes = 0;
  let improcedentes = 0;
  let parciais=0;
  let divergentesMerito=0;
  let cumprimentoAtivo = 0;
  let cumprimentoEncerrado = 0;
  let faltaInstaurar = 0;
  let oportunidadeHonorarios = 0;
  let sucumbencia = 0;
  let baixasTribunal = 0;
  let encerradosCarteira = 0;

  for (const c of list) {
    const merito=categoriaMeritoCadastrado(c);
    if(merito==="procedente")procedentes++;
    if(merito==="improcedente")improcedentes++;
    if(merito==="parcial")parciais++;
    if(merito==="divergente")divergentesMerito++;
    if (flagCumprimentoAtivo(c)) cumprimentoAtivo += 1;
    if (flagCumprimentoEncerrado(c)) cumprimentoEncerrado += 1;
    if (flagFaltaInstaurar(c)) faltaInstaurar += 1;
    if (flagOportunidadeHonorarios(c)) oportunidadeHonorarios += 1;
    if (flagSucumbencia(c)) sucumbencia += 1;
    if (c?.datajud_encerrado_tribunal || dadosOf(c).datajud_encerrado_tribunal) baixasTribunal += 1;
    try {
      if (isCasoEncerrado(c)) encerradosCarteira += 1;
    } catch {
      /* */
    }
  }

  return {
    total: list.length,
    procedentes,
    improcedentes,
    parciais,
    divergentesMerito,
    cumprimentoAtivo,
    cumprimentoEncerrado,
    faltaInstaurar,
    oportunidadeHonorarios,
    sucumbencia,
    baixasTribunal,
    encerradosCarteira,
  };
}
