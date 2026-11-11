import 'server-only';
import { getSupabaseAdmin } from '@/lib/server-db';
import { extrairAudienciasOficiais, type AudienciaExtraida } from '@/lib/audiencias-monitor';
import {extractOfficialHearingLink} from '@/lib/hermes-judicial-findings';
import {filtrarAudienciasVigentes} from '@/lib/audiencias-expiry';

type Fonte = {source:'DJEN'|'DataJud'; text:string; url?:string|null; publishedAt?:string|null};
export type ProcessoAudiencia = {
  id: number; empresa_id: string|null; protocolo_ref: string|null; cliente: string|null;
  advogado: string|null; tribunal: string|null; djen_last_ok?: boolean|null;
  djen_ultimo_link?: string|null; djen_ultima_data?: string|null;
  datajud_ultimo_nome?: string|null; dados?: Record<string,unknown>|null;
};
const SECURE_COURT = /^https:\/\/(?:[a-z0-9-]+\.)+(?:jus\.br|cnj\.jus\.br)(?:\/|$)/i;
export function portalDeAudiencias(tribunal?:string|null):string|null {
  const sigla=String(tribunal||'').toUpperCase().replace(/[^A-Z]/g,'');
  if(!/^TJ[A-Z]{2,4}$/.test(sigla))return null;
  const names=[sigla+'_PLENARIO_VIRTUAL_URL',sigla+'_SESSOES_URL',sigla+'_PAUTAS_URL'];
  for (const name of names) {
    const raw=process.env[name];
    if(raw && SECURE_COURT.test(raw))return raw;
  }
  return null;
}
function safeOfficialUrl(value?:string|null):string|null {
  if(!value)return null;
  try{const url=new URL(value);return SECURE_COURT.test(url.href)?url.href:null;}
  catch{return null;}
}
function caseEvidence(row:ProcessoAudiencia, sources:Fonte[]):Fonte[] {
  const evidence=(row.dados?.wa_djen_evidence||null) as {text?:unknown;link?:unknown;eventAt?:unknown}|null;
  const cachedText=typeof evidence?.text==='string'?evidence.text:'';
  const cachedLink=typeof evidence?.link==='string'?evidence.link:row.djen_ultimo_link;
  const merged=[...sources.slice(0,50)];
  if(cachedText.length>15 && row.djen_last_ok===true){
    merged.push({source:'DJEN',text:cachedText.slice(0,80000),url:cachedLink,publishedAt:row.djen_ultima_data});
  }
  // Um nome de movimento DataJud pode indicar designação, mas não confirma dia.
  if(typeof row.datajud_ultimo_nome==='string' && row.datajud_ultimo_nome.length>20){
    merged.push({source:'DataJud',text:row.datajud_ultimo_nome});
  }
  return merged;
}
export function prepararAudienciasDoProcesso(row:ProcessoAudiencia, fontes:Fonte[]=[]){
  if(!row.empresa_id||!Number.isSafeInteger(row.id)||!row.protocolo_ref)return [];
  const selected=new Map<string,{item:Record<string,unknown>;weight:number;published:number}>();
  for(const doc of caseEvidence(row,fontes)){
    if(!doc.text || doc.text.length<15)continue;
    const source=doc.source;
    const events=filtrarAudienciasVigentes(extrairAudienciasOficiais(doc.text.slice(0,80000)));
    for(const e of events){
      const evidenceAt=typeof doc.publishedAt==='string' ? Date.parse(doc.publishedAt) : 0;
      const weight=source==='DJEN'?2:1;
      const item={
        empresa_id:row.empresa_id,processo_id:row.id,chave:e.chave,
        protocolo_ref:row.protocolo_ref,cliente:row.cliente,advogado:row.advogado,
        tribunal:row.tribunal,tipo:e.tipo,
        data_evento:e.data,data_fim:e.dataFim,hora_local:e.hora,hora_fim:e.horaFim,
        fuso:e.fuso,modalidade:e.modalidade,situacao:e.situacao,
        fonte:source,fonte_url:safeOfficialUrl(doc.url),portal_url:portalDeAudiencias(row.tribunal),
        meeting_url:extractOfficialHearingLink(doc.text),
        evidencia:e.trecho,verificado_em:new Date().toISOString(),atualizado_em:new Date().toISOString()
      };
      const old=selected.get(e.chave);
      if(!old||weight>old.weight||(weight===old.weight&&evidenceAt>old.published)){
        selected.set(e.chave,{item,weight,published:evidenceAt||0});
      }
    }
  }
  return [...selected.values()].map(v=>v.item);
}
/** Fontes confiáveis: somente resposta efetiva do scanner/Hermes ou documento oficial previamente salvo. */
export async function atualizarAudienciasDeConsulta(input:{
  empresaId:string;processoId:number;fontes?:Fonte[]
}):Promise<{ok:boolean;total:number;error?:string}>{
  const db=await getSupabaseAdmin();
  const {data:row,error}=await db.from('processos')
    .select('id,empresa_id,protocolo_ref,cliente,advogado,tribunal,dados,djen_last_ok,djen_ultimo_link,djen_ultima_data,datajud_ultimo_nome')
    .eq('empresa_id',input.empresaId).eq('id',input.processoId).maybeSingle();
  if(error||!row)return {ok:false,total:0,error:'Processo não acessível nesta empresa'};
  const registros=prepararAudienciasDoProcesso(row as ProcessoAudiencia,input.fontes||[]);
  if(!registros.length)return {ok:true,total:0};
  const result=await db.from('audiencias_monitoradas').upsert(registros,{onConflict:'empresa_id,processo_id,chave'});
  if(result.error)return {ok:false,total:0,error:result.error.code||'Persistência não disponível'};
  return {ok:true,total:registros.length};
}
/**
 * Percorre a carteira em micro-lotes para reconstruir o índice a partir de
 * evidências oficiais já guardadas. Não faz scraping nem inventa API estadual.
 * O cursor é persistido, de modo que o cron diário avança na carteira inteira.
 */
export async function atualizarIndiceAudienciasLote(limit=120){
  const db=await getSupabaseAdmin();
  const size=Math.max(1,Math.min(250,Math.trunc(limit)));
  const {data:progress,error:cursorError}=await db.from('audiencias_monitor_cursor')
    .select('ultimo_id').eq('id','global').maybeSingle();
  if(cursorError)throw new Error('Cursor de audiências indisponível');
  const after=Number(progress?.ultimo_id||0);
  let {data,error}=await db.from('processos')
    .select('id,empresa_id,protocolo_ref,cliente,advogado,tribunal,dados,djen_last_ok,djen_ultimo_link,djen_ultima_data,datajud_ultimo_nome')
    .gt('id',after).order('id',{ascending:true}).limit(size);
  if(error)throw new Error('Não foi possível listar os processos da carteira');
  if(!data?.length && after>0){
    const reset=await db.from('audiencias_monitor_cursor').upsert({id:'global',ultimo_id:0,atualizado_em:new Date().toISOString()});
    if(reset.error)throw new Error('Falha ao reiniciar cursor de audiências');
    const next=await db.from('processos')
      .select('id,empresa_id,protocolo_ref,cliente,advogado,tribunal,dados,djen_last_ok,djen_ultimo_link,djen_ultima_data,datajud_ultimo_nome')
      .order('id',{ascending:true}).limit(size);
    data=next.data;error=next.error;
    if(error)throw new Error('Falha ao reiniciar leitura da carteira');
  }
  const rows=(data||[]) as ProcessoAudiencia[];
  const latest=new Map<string,Record<string,unknown>>();
  for(const row of rows)for(const item of prepararAudienciasDoProcesso(row)){
    latest.set(String(item.empresa_id)+':'+String(item.processo_id)+':'+String(item.chave),item);
  }
  if(latest.size){
    // Variações antigas entre dados e coluna oficial são preservadas: não apaga nada.
    const result=await db.from('audiencias_monitoradas').upsert([...latest.values()],{onConflict:'empresa_id,processo_id,chave'});
    if(result.error)throw new Error('Falha ao atualizar índice de audiências');
  }
  const last=rows.at(-1)?.id || after;
  const progressResult=await db.from('audiencias_monitor_cursor').upsert({id:'global',ultimo_id:last,atualizado_em:new Date().toISOString()});
  if(progressResult.error)throw new Error('Falha ao salvar progresso de monitoramento');
  return {ok:true,inspecionados:rows.length,registros:latest.size,ultimoId:last};
}

/**
 * Checagem oficial incremental de audiências próximas e designações sem data.
 * Executada pelo cron diário já existente, sem envio de mensagens.
 * Uma tentativa por execução; sucesso parcial preserva a fonte que respondeu.
 */
export async function verificarUmaAudienciaAgendada() {
  const db=await getSupabaseAdmin();
  const dateParts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
  const getDatePart=(type:string)=>dateParts.find(p=>p.type===type)?.value||'';
  const dateISO=getDatePart('year')+'-'+getDatePart('month')+'-'+getDatePart('day');
  const {data:list,error}=await db.from('audiencias_monitoradas')
    .select('empresa_id,processo_id,protocolo_ref')
    .neq('situacao','cancelada')
    .or('data_evento.gte.'+dateISO+',data_fim.gte.'+dateISO+',situacao.eq.data_pendente')
    .order('ultima_tentativa_em',{ascending:true,nullsFirst:true})
    .limit(1);
  if(error)throw new Error('Fila judicial temporariamente indisponível');
  if(!list?.length)return {ok:true,attempted:0,source:'none'};
  const row=list[0];
  const cnj=String(row.protocolo_ref||'').replace(/\D/g,'');
  if(cnj.length!==20)return {ok:false,attempted:0,source:'invalid_cnj'};
  const attemptAt=new Date().toISOString();
  const attempt=await db.from('audiencias_monitoradas')
    .update({ultima_tentativa_em:attemptAt}).eq('empresa_id',row.empresa_id).eq('processo_id',row.processo_id);
  if(attempt.error)throw new Error('Não foi possível registrar a tentativa oficial');
  const [{fetchDjenComunicacoes,resolveDjenPublicacaoLink},{fetchDataJud}]=await Promise.all([
    import('@/lib/djen'),import('@/lib/datajud'),
  ]);
  const since=new Date(Date.now()-120*86400000).toISOString().slice(0,10);
  const [dj,djen]=await Promise.allSettled([
    fetchDataJud(cnj,1,{fast:true,cloudBudget:true,timeoutMs:6500}),
    fetchDjenComunicacoes(cnj,{dataInicio:since,cloudBudget:true}),
  ]);
  const datajud=dj.status==='fulfilled'?dj.value:null;
  const diario=djen.status==='fulfilled'?djen.value:null;
  const datajudOk=!!datajud&&datajud.error===false&&datajud.found===true;
  const djenOk=!!diario&&diario.success===true;
  const fontes:Fonte[]=[
    ...(djenOk? (diario?.items||[]).filter(item=>String(item.numero_processo||'').replace(/\D/g,'')===cnj)
      .map(item=>({source:'DJEN' as const,text:String(item.texto||''),
        url:resolveDjenPublicacaoLink(item,cnj),publishedAt:item.data_disponibilizacao})) : []),
    ...(datajudOk ? (datajud?.movimentos||[]).map((item:any)=>({
      source:'DataJud' as const,text:String(item?.nome||item?.descricao||''),
      publishedAt:String(item?.dataHora||item?.dataMovimento||''),
    })) : []),
  ];
  let index=0;
  if(fontes.length){
    const result=await atualizarAudienciasDeConsulta({
      empresaId:String(row.empresa_id),processoId:Number(row.processo_id),fontes,
    });
    if(result.ok)index=result.total;
  }
  if(djenOk||datajudOk){
    const stamp=await db.from('audiencias_monitoradas')
      .update({ultima_consulta_oficial_em:new Date().toISOString()})
      .eq('empresa_id',row.empresa_id).eq('processo_id',row.processo_id);
    if(stamp.error)console.warn('[audiencias] Falha ao gravar horário de consulta',stamp.error.code);
  }
  return {ok:true,attempted:1,processId:row.processo_id,
    djenOk,datajudOk,records:index,
    source:djenOk&&datajudOk?'both':djenOk?'djen':datajudOk?'datajud':'unavailable'};
}
