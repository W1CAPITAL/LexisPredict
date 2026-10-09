import 'server-only';
import {getSupabaseAdmin} from '@/lib/server-db';
import {isCasoEncerrado} from '@/lib/status-encerrado';
import {preparePublicationNotice,type PublicationSourceRow} from '@/lib/wa-publication-builder';

/** Called only after the WA.Auto transport acknowledged the delivery.
 * Internal close must never be interpreted as legal close for enforcement.
 */
export async function closeAfterConfirmedNotice(input:{
  empresaId:string;processoId:number;campaignId:string;
  dispatchId:string;eventHash:string;
}) {
  const db=await getSupabaseAdmin();
  const {data:row,error:loadError}=await db.from('processos').select('*')
    .eq('empresa_id',input.empresaId).eq('id',input.processoId).maybeSingle();
  if(loadError||!row)return {closed:false,reason:'Processo não localizado'};
  if(isCasoEncerrado(row))return {closed:false,reason:'Já encerrado'};
  const notice=preparePublicationNotice(row as PublicationSourceRow,{includeClosed:true}).notice;
  if(!notice||notice.event_hash!==input.eventHash)
    return {closed:false,reason:'A movimentação mudou: revisão necessária'};
  if(notice.kind==='transito')
    return {closed:false,reason:'Trânsito não comprova satisfação ou fim do cumprimento'};
  if(row.em_cumprimento_sentenca||row.cumprimento_ativo||
      row.cumprimento_pendente_necessario||
      row.dados?.em_cumprimento_sentenca||
      row.dados?.cumprimento_pendente_necessario)
    return {closed:false,reason:'Cumprimento ativo ou pendente'};
  const now=new Date().toISOString();
  const dados={...(row.dados||{}),situacao:'ENCERRADO',statusManual:'Encerrado',
    wa_auto_encerramento:{campanha_id:input.campaignId,envio_id:input.dispatchId,
      evento_hash:input.eventHash,confirmacao_envio:now,fonte:notice.source,
      motivo:'Status interno atualizado após envio; não certifica cumprimento judicial'}};
  let query=db.from('processos').update({
    status:'Encerrado',status_interno:'ENCERRADO',dados,updated_at:now,
  }).eq('empresa_id',input.empresaId).eq('id',input.processoId)
    .eq('status',row.status);
  if(row.updated_at)query=query.eq('updated_at',row.updated_at);
  const {data,error}=await query.select('id').maybeSingle();
  return {closed:!!data&&!error,reason:error?.message||(!data?'Dados alterados, confira antes de encerrar':null)};
}
