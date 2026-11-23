/** Read-only Supabase RPC wrappers for desktop builds without service_role.
 * The database derives company and supervisor role from auth.uid(), never
 * from a caller-supplied company ID. Verify the returned tenant as defense
 * in depth before using the data in any Server Action or Server Component.
 */
type RpcClient={
 rpc:(name:string,args:Record<string,unknown>)=>PromiseLike<{
  data:unknown;
  error?:{message?:string;code?:string}|null
 }>
};
type Periodo='esta_semana'|'semana_passada'|'mes';
type Snapshot=Record<string,unknown>;
function object(value:unknown):value is Snapshot{
 return value!==null&&typeof value==='object'&&!Array.isArray(value);
}
async function request(db:RpcClient,tenant:string,name:string,args:Record<string,unknown>,required:string[]){
 const {data,error}=await db.rpc(name,args);
 if(error)throw new Error('Consulta de indicadores indisponível: '+String(error.message||error.code||'Falha no banco'));
 if(!object(data))throw new Error('Resumo dos indicadores incompleto.');
 if(data.empresa_id!==tenant)throw new Error('Organização do resumo não corresponde à sessão.');
 for(const field of required){
  if(!object(data[field]))throw new Error('Resumo dos indicadores incompleto: '+field);
 }
 return data;
}
export async function readDesktopHistorico(db:RpcClient,tenant:string,periodo:Periodo='esta_semana'){
 const data=await request(db,tenant,'lexis_desktop_historico_snapshot',{p_periodo:periodo},['historico']);
 if(!Array.isArray((data.historico as Snapshot).dias))
  throw new Error('Histórico de atendimentos incompleto.');
 return data.historico as Snapshot;
}
export async function readDesktopRelatorio(db:RpcClient,tenant:string,periodo:Periodo='mes',owner:string|null=null){
 return request(db,tenant,'lexis_desktop_relatorio_snapshot',
  {p_periodo:periodo,p_owner:owner},['portfolio','historico','merito','retorno']);
}
export async function readDesktopSupervisao(db:RpcClient,tenant:string,periodo:Periodo='esta_semana'){
 return request(db,tenant,'lexis_desktop_supervisao_snapshot',{p_periodo:periodo},['carteira','atividade','status']);
}
