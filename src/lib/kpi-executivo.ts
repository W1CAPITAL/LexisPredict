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
 const oficial = d.merito_fonte === "datajud_tpu_2026-10-22"
   ? String(d.merito_datajud_20261022?.resultado || "") : "";
 if (oficial) {
   if (oficial === "procedente" || oficial === "improcedente" || oficial === "parcial") return oficial;
   if (oficial === "conflito_resultados") return "divergente";
   return "sem_indicador";
 }

 const motivo=String(c.procedente_motivo ?? d.procedente_motivo ?? "").trim().toUpperCase();
 const textoAtual=[
   c.evento_tipo,d.evento_tipo,c.evento_resumo,d.evento_resumo,
   c.datajud_ultimo_nome,d.datajud_ultimo_nome,
   c.djen_ultimo_resumo,d.djen_ultimo_resumo,
   c.merito_resultado,d.merito_resultado
 ].filter(Boolean).join(" ").toUpperCase();

 const classificarTexto=(texto:string):CategoriaMeritoCadastrado|null=>{
   const parcial=/PARCIAL|EM PARTE/.test(texto);
   const improcedente=/IMPROCEDENTE|IMPROCED[ÊE]NCIA/.test(texto);
   const procedente=/PROCEDENTE|PROCED[ÊE]NCIA/.test(texto) && !improcedente && !parcial;
   const sinais=Number(parcial)+Number(improcedente)+Number(procedente);
   if(sinais>1)return "divergente";
   if(parcial)return "parcial";
   if(improcedente)return "improcedente";
   if(procedente)return "procedente";
   return null;
 };

 const motivoCategoria=classificarTexto(motivo);
 const atualCategoria=classificarTexto(textoAtual);
 const flagPositiva=c.is_procedente===true || d.is_procedente===true;

 if(motivoCategoria==="divergente")return "divergente";
 if(motivoCategoria==="parcial")
   return atualCategoria && atualCategoria!=="parcial" ? "divergente" : "parcial";
 if(motivoCategoria==="improcedente")
   return flagPositiva || (atualCategoria && atualCategoria!=="improcedente") ? "divergente" : "improcedente";
 if(motivoCategoria==="procedente")
   return atualCategoria && atualCategoria!=="procedente" ? "divergente" : "procedente";

 // "Decisão interlocutória de mérito" não revela, sozinha, quem venceu.
 // Se houver resultado atual explícito, ele prevalece; se contradisser a flag positiva, revisar.
 if(/DECIS[ÃA]O INTERLOCUT[ÓO]RIA DE M[ÉE]RITO/.test(motivo)){
   if(atualCategoria==="improcedente" && flagPositiva)return "divergente";
   if(atualCategoria)return atualCategoria;
   return "sem_indicador";
 }
 if(atualCategoria)return atualCategoria;

 // Compatibilidade com campos estruturados antigos. A flag positiva isolada não
 // basta para declarar procedência; o booleano legado também marcava parciais.
 const evento=String(c.evento_tipo||d.evento_tipo||"").toLowerCase();
 const merito=String(c.merito_resultado||d.merito_resultado||"").toLowerCase();
 const proc=evento==="sentenca_procedente"||merito==="procedente";
 const imp=c.is_improcedente===true||d.is_improcedente===true
   ||d.sentenca_improcedente===true||evento==="sentenca_improcedente"||merito==="improcedente";
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

function statusExecucaoOf(c:any,d:any):string{
  return String(
    c?.status_executivo ?? d?.status_executivo ??
    c?.detalhes_execucao?.status_executivo ?? d?.detalhes_execucao?.status_executivo ?? ''
  ).trim().toLowerCase();
}

export function flagCumprimentoAtivo(c: any): boolean {
  const d = dadosOf(c);
  if (flagCumprimentoEncerrado(c)) return false;
  const status=statusExecucaoOf(c,d);
  return c?.cumprimento_ativo===true || d.cumprimento_ativo===true || status==='ativo';
}

export function flagCumprimentoEncerrado(c: any): boolean {
  const d = dadosOf(c);
  const status=statusExecucaoOf(c,d);
  return !!(c?.cumprimento_encerrado || d.cumprimento_encerrado || status==='encerrado');
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
  semIndicador: number;
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
  let semIndicador=0;
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
    if(merito==="sem_indicador")semIndicador++;
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
    semIndicador,
    cumprimentoAtivo,
    cumprimentoEncerrado,
    faltaInstaurar,
    oportunidadeHonorarios,
    sucumbencia,
    baixasTribunal,
    encerradosCarteira,
  };
}
