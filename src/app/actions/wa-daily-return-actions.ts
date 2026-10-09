'use server';
import {getUserContext,getSupabaseAdmin} from '@/lib/server-db';
import {resolveWaAutoPermissions} from '@/lib/wa-auto-permissions';
import {getDailyReturnSettings,upsertDailyReturnSettings,processNextDueReturn,processOneDailyReturn} from '@/lib/wa-daily-return-service';
import {prepareDailyReturn,brazilToday} from '@/lib/wa-daily-return-policy';

async function manager() {
 const ctx=await getUserContext();
 if(!ctx.empresa_id||!ctx.auth_id||ctx.isViewer||!resolveWaAutoPermissions({cargo:ctx.cargo}).canManage)
   throw new Error('Necessário Supervisor, Administrador ou Superadmin da empresa.');
 return {empresaId:ctx.empresa_id,authId:ctx.auth_id};
}
export async function getWaDailyReturnDashboardAction(){
 try{
  const me=await manager();const db=await getSupabaseAdmin();
  const settings=await getDailyReturnSettings(me.empresaId);
  const day=brazilToday();
  const {count}=await db.from('processos').select('id',{head:true,count:'exact'})
    .eq('empresa_id',me.empresaId).lte('proximo_retorno',day);
  const {count:sentToday}=await db.from('wa_daily_return_sends').select('id',{head:true,count:'exact'})
    .eq('empresa_id',me.empresaId).eq('local_day',day).eq('status','sent');
  return {ok:true as const,settings:{enabled:settings.enabled,intervalDays:settings.intervalDays},due:Number(count||0),sentToday:Number(sentToday||0),today:day};
 }catch(e:any){return {ok:false as const,error:String(e?.message||e)};}
}
export async function saveWaDailyReturnSettingsAction(enabled:boolean,intervalDays:number) {
 try{const me=await manager();await upsertDailyReturnSettings(me.empresaId,me.authId,enabled,intervalDays);
  return {ok:true as const};
 }catch(e:any){return {ok:false as const,error:String(e?.message||e)};}
}
/** Processes one due case per click/tick. No fresh court query unless a
 * manager explicitly requests scan before send for an individual CNJ.
 */
export async function scanNextWaReturnAction(){
 try{const me=await manager();const settings=await getDailyReturnSettings(me.empresaId);
  return await processNextDueReturn(me.empresaId,settings.intervalDays);
 }catch(e:any){return {ok:false,processed:false,error:String(e?.message||e)};}
}
export async function previewWaReturnCnjAction(cnj:string){
 try{
  const me=await manager(),db=await getSupabaseAdmin();
  const digits=String(cnj||'').replace(/\D/g,'');
  if(digits.length!==20)throw new Error('Informe CNJ completo.');
  const formatted=`${digits.slice(0,7)}-${digits.slice(7,9)}.${digits.slice(9,13)}.${digits.slice(13,14)}.${digits.slice(14,16)}.${digits.slice(16)}`;
  const {data,error}=await db.from('processos').select('*').eq('empresa_id',me.empresaId)
    .in('protocolo_ref',[digits,formatted]).limit(3);
  if(error)throw new Error(error.message);
  if((data||[]).length!==1)throw new Error('CNJ inexistente ou duplicado; selecione o processo correto na carteira.');
  const settings=await getDailyReturnSettings(me.empresaId);
  const result=prepareDailyReturn(data![0],{mode:'single',intervalDays:settings.intervalDays});
  return {ok:true as const,processId:data![0].id,cnj:formatted,
    reason:result.reason,preview:result.ready?.message||null,
    eventAt:result.ready?.eventAt||null,source:result.ready?.source||null};
 }catch(e:any){return {ok:false as const,error:String(e?.message||e)};}
}
export async function scanOneWaReturnAction(processId:number,refreshTribunal=false){
 try{
  const me=await manager(),db=await getSupabaseAdmin();
  if(!Number.isInteger(processId)||processId<=0)throw new Error('Identificador inválido');
  const {data,error}=await db.from('processos').select('protocolo_ref')
    .eq('empresa_id',me.empresaId).eq('id',processId).maybeSingle();
  if(error||!data)throw new Error('Processo não localizado nesta empresa.');
  if(refreshTribunal) {
    const {scanSingleCaseAction}=await import('@/app/actions/case-actions');
    const scanned=await scanSingleCaseAction(String(data.protocolo_ref),{mode:'both',fast:true,useClaudeAi:false});
    if(!scanned.success) return {ok:false,sent:false,reason:'consultas_oficiais_indisponiveis',error:String(scanned.error||'A conferência DataJud/DJEN falhou; nenhum aviso enviado.')};
  }
  const settings=await getDailyReturnSettings(me.empresaId);
  return await processOneDailyReturn({empresaId:me.empresaId,processId,mode:'single',intervalDays:settings.intervalDays});
 }catch(e:any){return {ok:false as const,sent:false,error:String(e?.message||e)};}
}
