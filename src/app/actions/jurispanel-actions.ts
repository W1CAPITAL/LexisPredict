'use server';
import { getSupabaseAdmin, getUserContext } from '@/lib/server-db';

export type JurisTimeEntry = {
  id:string; titulo:string; descricao:string; protocolo_ref:string|null;
  inicio_em:string; fim_em:string; duracao_segundos:number; faturavel:boolean; criado_em:string;
};
export type JurisTemplate = {
  id:string; titulo:string; categoria:string; corpo:string;
  autor_auth_user_id:string; atualizado_em:string;
};

async function context() {
  const ctx = await getUserContext();
  if (!ctx.empresa_id || !ctx.auth_id) throw new Error('Sessão da empresa não encontrada');
  if (ctx.isViewer) throw new Error('Perfil de leitura não pode criar ou editar registros');
  return { empresaId:String(ctx.empresa_id), userId:String(ctx.auth_id) };
}
async function reader() {
  const ctx = await getUserContext();
  if (!ctx.empresa_id || !ctx.auth_id) throw new Error('Faça login para acessar a empresa');
  return {empresaId:String(ctx.empresa_id),userId:String(ctx.auth_id)};
}
const err = (e:unknown) => ({ success:false as const, error:e instanceof Error?e.message:'Falha na operação' });
const isUuid=(s:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);

async function resolveCase(cnj:string,empresaId:string) {
  const numero=cnj.trim();
  if(!numero) return {processo_id:null as number|null,protocolo_ref:null as string|null};
  if(numero.replace(/\D/g,'').length!==20) throw new Error('CNJ precisa ter 20 dígitos');
  const db=await getSupabaseAdmin();
  const {data,error}=await db.from('processos').select('id,protocolo_ref').eq('empresa_id',empresaId).eq('protocolo_ref',numero).maybeSingle();
  if(error) throw new Error('Não foi possível validar o processo');
  if(!data) throw new Error('Este CNJ não está cadastrado na carteira da empresa');
  return {processo_id:Number(data.id),protocolo_ref:String(data.protocolo_ref)};
}
export async function findJurisProcessAction(cnj:string) {
  try {
    const {empresaId}=await reader();
    const link=await resolveCase(cnj,empresaId);
    if(!link.processo_id)return {success:false as const,error:'Informe um CNJ'};
    const db=await getSupabaseAdmin();
    const {data,error}=await db.from('processos').select('cliente,dados').eq('empresa_id',empresaId).eq('id',link.processo_id).maybeSingle();
    if(error||!data)return {success:false as const,error:'Processo não encontrado'};
    const dados=(data.dados||{}) as Record<string,unknown>;
    return {success:true as const,cnj:link.protocolo_ref||'',cliente:String(data.cliente||dados.cliente||'')};
  } catch(e){return err(e);}
}
export async function listJurisTimesheetAction() {
  try{
    const {empresaId,userId}=await reader(),db=await getSupabaseAdmin();
    const {data,error}=await db.from('juris_timesheet').select('id,titulo,descricao,protocolo_ref,inicio_em,fim_em,duracao_segundos,faturavel,criado_em')
      .eq('empresa_id',empresaId).eq('autor_auth_user_id',userId).order('inicio_em',{ascending:false}).limit(250);
    if(error) throw new Error('Não foi possível carregar o timesheet');
    return {success:true as const,rows:(data||[]) as JurisTimeEntry[]};
  }catch(e){return {...err(e),rows:[] as JurisTimeEntry[]};}
}
export async function saveJurisTimeAction(input:{
  titulo:string; descricao?:string; cnj?:string; inicioEm:string; fimEm:string; faturavel?:boolean;
}) {
  try{
    const {empresaId,userId}=await context();
    const titulo=String(input.titulo||'').trim();
    const descricao=String(input.descricao||'').trim();
    const from=Date.parse(input.inicioEm),to=Date.parse(input.fimEm);
    const seconds=Math.round((to-from)/1000);
    if(titulo.length<3||titulo.length>180||descricao.length>4000)throw new Error('Título ou descrição fora dos limites');
    if(!Number.isFinite(seconds)||seconds<1||seconds>86400||!Number.isFinite(from)||to>Date.now()+60000)throw new Error('Intervalo de tempo inválido (máximo 24h)');
    const process=await resolveCase(String(input.cnj||''),empresaId);
    const db=await getSupabaseAdmin();
    const {data,error}=await db.from('juris_timesheet').insert({
      empresa_id:empresaId,autor_auth_user_id:userId,
      ...process,titulo,descricao,inicio_em:new Date(from).toISOString(),
      fim_em:new Date(to).toISOString(),duracao_segundos:seconds,faturavel:input.faturavel===true,
    }).select('id').single();
    if(error)throw new Error('Não foi possível salvar o tempo trabalhado');
    return {success:true as const,id:String(data.id)};
  }catch(e){return err(e);}
}
export async function deleteJurisTimeAction(id:string) {
  try{
    const {empresaId,userId}=await context();
    if(!isUuid(id))throw new Error('Identificador inválido');
    const db=await getSupabaseAdmin();
    const {error}=await db.from('juris_timesheet').delete().eq('id',id).eq('empresa_id',empresaId).eq('autor_auth_user_id',userId);
    if(error)throw new Error('Falha ao excluir tempo');
    return {success:true as const};
  }catch(e){return err(e);}
}
export async function listJurisTemplatesAction() {
  try{
    const {empresaId}=await reader(),db=await getSupabaseAdmin();
    const {data,error}=await db.from('juris_modelos_autorais')
      .select('id,titulo,categoria,corpo,autor_auth_user_id,atualizado_em')
      .eq('empresa_id',empresaId).order('atualizado_em',{ascending:false}).limit(200);
    if(error)throw new Error('Falha ao carregar modelos');
    return {success:true as const,rows:(data||[]) as JurisTemplate[]};
  }catch(e){return {...err(e),rows:[] as JurisTemplate[]};}
}
export async function saveJurisTemplateAction(input:{id?:string;titulo:string;categoria:string;corpo:string}) {
  try{
    const {empresaId,userId}=await context();
    const titulo=String(input.titulo||'').trim(), categoria=String(input.categoria||'').trim(),corpo=String(input.corpo||'').trim();
    if(titulo.length<3||titulo.length>160||categoria.length<2||categoria.length>80||corpo.length<20||corpo.length>30000)throw new Error('Modelo fora dos limites permitidos');
    const db=await getSupabaseAdmin();
    if(input.id){
      if(!isUuid(input.id))throw new Error('Identificador inválido');
      const {data,error}=await db.from('juris_modelos_autorais').update({titulo,categoria,corpo,atualizado_em:new Date().toISOString()})
        .eq('id',input.id).eq('empresa_id',empresaId).eq('autor_auth_user_id',userId).select('id').maybeSingle();
      if(error||!data)throw new Error('Sem permissão para alterar este modelo');
      return {success:true as const,id:String(data.id)};
    }
    const {data,error}=await db.from('juris_modelos_autorais').insert({
      titulo,categoria,corpo,empresa_id:empresaId,autor_auth_user_id:userId,
    }).select('id').single();
    if(error)throw new Error('Falha ao criar modelo');
    return {success:true as const,id:String(data.id)};
  }catch(e){return err(e);}
}
export async function deleteJurisTemplateAction(id:string) {
  try{
    const {empresaId,userId}=await context();
    if(!isUuid(id))throw new Error('Identificador inválido');
    const db=await getSupabaseAdmin();
    const {data,error}=await db.from('juris_modelos_autorais').delete()
      .eq('id',id).eq('empresa_id',empresaId).eq('autor_auth_user_id',userId).select('id').maybeSingle();
    if(error||!data)throw new Error('Modelo não encontrado ou sem permissão');
    return {success:true as const};
  }catch(e){return err(e);}
}
