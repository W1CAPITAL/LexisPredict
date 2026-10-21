'use server';

/**
 * Supervisão — snapshot operacional da empresa inteira.
 * Processos agrupados por usuário (created_by → nome do perfil).
 */

import { getUserContext, getStoredCasesForEmpresa, getSupabaseAdmin } from '@/lib/server-db';
import { periodBounds, labelPeriodo, type PeriodoRelatorio } from '@/lib/atendimento-semana';
import { getHistoricoAtendimentosEmpresa,emptyHistorico,type AtendimentosHistorico } from '@/lib/historico-atendimentos';
import { getResumoAnalisesDaEmpresa, EMPTY_ANALISES, type AnalisesResumo } from '@/lib/analises-internas';

export type SupervisaoProcessoResumo = {
  id: string;
  protocolo: string;
  cliente: string;
  status: string;
  ultimoRetorno: string;
  advogado: string;
  tribunal: string;
  encerrado: boolean;
  novidade: boolean;
};

export type SupervisaoUsuarioGrupo = {
  key: string;
  nome: string;
  total: number;
  ativos: number;
  encerrados: number;
  /** Baixa/trânsito DataJud/DJEN */
  baixasTribunal: number;
  vencidos: number;
  novidades: number;
  atendimentos: number;
  atendidosSemana: number;
  semRetorno: number;
  ba: number;
  processos: SupervisaoProcessoResumo[];
};

export type SupervisaoSnapshot = {
  historicoAtendimentos:AtendimentosHistorico;
  analisesInternas: AnalisesResumo;
  /** Horário UTC em que a consulta foi executada */
  geradoEm?: string;
  /** Última alteração registrada na carteira consultada */
  ultimaAlteracaoEm?: string;
  periodo?: string;
  periodoLabel?: string;
  total: number;
  ativos: number;
  encerrados: number;
  /** Baixa/trânsito DataJud/DJEN (ativos + encerrados) */
  baixasTribunal: number;
  vencidos: number;
  novidades: number;
  ba: number;
  cumprimento: number;
  atendimentosTotais: number;
  atendidosSemana: number;
  auditadosSemana: number;
  auditoriasImportadasPeriodo?:number;
  edicoesEventosPeriodo?:number;
  atendidosAtivosPeriodo?:number;
  tribunalDatajudPeriodo?:number;
  tribunalDjenPeriodo?:number;
  auditadosHoje: number;
  auditadosTribunalSemana: number;
  editadosAppSemana: number;
  semRetorno: number;
  /** % processos com ao menos um retorno (0–100) */
  taxaRetornoPct: number;
  /** % ativos com retorno no período selecionado */
  taxaRetornoPeriodoPct: number;
  operadores: {
    nome: string;
    total: number;
    ativos: number;
    encerrados: number;
    vencidos: number;
    novidades: number;
    atendimentos: number;
    atendidosSemana: number;
    semRetorno: number;
    ba: number;
  }[];
  /** Carteira separada por usuário do sistema (created_by) */
  porUsuario: SupervisaoUsuarioGrupo[];
  timelineSemanal: { label: string; atendidos: number }[];
  porTribunal: { label: string; value: number }[];
  porStatus: { label: string; value: number }[];
  porEscritorio: { label: string; value: number }[];
};

function emptySnapshot(periodoLabel = "Esta semana"): SupervisaoSnapshot {
  return {
    historicoAtendimentos:emptyHistorico(),
    analisesInternas: EMPTY_ANALISES,
    total: 0,
    ativos: 0,
    encerrados: 0,
    baixasTribunal: 0,
    vencidos: 0,
    novidades: 0,
    ba: 0,
    cumprimento: 0,
    atendimentosTotais: 0,
    atendidosSemana: 0,
    auditadosSemana: 0,
    auditadosHoje: 0,
    auditadosTribunalSemana: 0,
    editadosAppSemana: 0,
    semRetorno: 0,
    taxaRetornoPct: 0,
    taxaRetornoPeriodoPct: 0,
    operadores: [],
    porUsuario: [],
    timelineSemanal: [],
    porTribunal: [],
    porStatus: [],
    porEscritorio: [],
  };
}


type CanonUsuario = {
  key:string;nome:string;total:number;ativos:number;encerrados:number;
  vencidos:number;novidades:number;atendimentos:number;semRetorno:number;
  baixasTribunal:number;ba:number;
};
type CanonCarteira = {
  total:number;ativos:number;encerrados:number;vencidos:number;novidades:number;
  baixasTribunal:number;cumprimento:number;ba:number;comRetorno:number;semRetorno:number;
  ultimaAlteracaoEm?:string;
  porUsuario:CanonUsuario[];
  porTribunal:Array<{label:string;value:number}>;
  porStatus:Array<{label:string;value:number}>;
  porEscritorio:Array<{label:string;value:number}>;
};
type CanonAtividade={
 edicoesProcessos:number;edicoesEventos:number;atendidosAtivosPeriodo:number;
 tribunalConsultados:number;tribunalDatajud:number;tribunalDjen:number;
 auditoriasLancadas:number;auditoriasImportadas:number;auditoriasDistintas:number;
 timeline:Array<{label:string;atendidos:number}>;
};
/**
 * O resumo é calculado diretamente no banco pelas mesmas regras da carteira.
 * Listagens detalhadas são complementares, nunca a fonte dos totais dos cards.
 * Eventos humanos vêm do histórico auditável; não de updated_at/processos.
 */
export async function getSupervisaoSnapshotAction(
  periodo:'esta_semana'|'semana_passada'|'mes'='esta_semana'
):Promise<{success:boolean;snapshot?:SupervisaoSnapshot;error?:string}>{
 try{
  const ctx=await getUserContext();
  if(!ctx.empresa_id)return {success:false,error:'Sessão expirada.'};
  if(!ctx.isSupervisor&&!ctx.isSuperAdmin)
    return {success:false,error:'Acesso restrito a Supervisor ou Superadmin.'};
  const db=await getSupabaseAdmin();
  const hoje=new Date();
  const bounds=periodBounds(periodo,hoje);
  const toYmd=(date:Date)=>[date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
  const [carteiraReq,atividadeReq,estadoReq,historicoReq,analisesReq,casosReq,usuariosReq]=await Promise.allSettled([
    db.rpc('lexis_supervisao_carteira_snapshot',{p_empresa:ctx.empresa_id}),
    db.rpc('lexis_supervisao_atividade_snapshot',{p_empresa:ctx.empresa_id,p_periodo:periodo}),
    db.rpc('lexis_supervisao_status_por_protocolo',{p_empresa:ctx.empresa_id}),
    getHistoricoAtendimentosEmpresa(ctx.empresa_id,periodo),
    getResumoAnalisesDaEmpresa(ctx.empresa_id,toYmd(bounds.start),toYmd(bounds.end)),
    getStoredCasesForEmpresa(ctx.empresa_id,false),
    db.from('usuarios').select('id,auth_user_id,nome').eq('empresa_id',ctx.empresa_id),
  ]);
  const checked=(result:PromiseSettledResult<any>,label:string):any=>{
   if(result.status!=='fulfilled')throw new Error(label+': '+String(result.reason));
   if(result.value?.error)throw new Error(label+': '+result.value.error.message);
   if(result.value?.data==null)throw new Error(label+': sem dados');
   return result.value.data;
  };
  // Falha do KPI canônico nunca deve ser mascarada com somas antigas do navegador.
  const carteira=checked(carteiraReq,'Resumo de carteira') as CanonCarteira;
  const atividade=checked(atividadeReq,'Histórico de produtividade') as CanonAtividade;
  const historico=historicoReq.status==='fulfilled'?historicoReq.value:emptyHistorico(periodo);
  if(historicoReq.status==='rejected')throw new Error('Histórico de atendimentos indisponível.');
  const analises=analisesReq.status==='fulfilled'?analisesReq.value:EMPTY_ANALISES;
  if(analisesReq.status==='rejected')console.warn('[supervisao] análises internas',analisesReq.reason);
  const cases=casosReq.status==='fulfilled'?(casosReq.value||[]):[];
  if(casosReq.status==='rejected')console.warn('[supervisao] detalhe dos casos',casosReq.reason);
  const usuarios=usuariosReq.status==='fulfilled'?(usuariosReq.value.data||[]):[];
  const idsToAuth=new Map<string,string>();
  for(const u of usuarios){
   const auth=String(u.auth_user_id||u.id||'');
   if(u.id)idsToAuth.set(String(u.id),auth);
   if(u.auth_user_id)idsToAuth.set(String(u.auth_user_id),auth);
  }
  const statuses=estadoReq.status==='fulfilled'&&!estadoReq.value.error&&estadoReq.value.data
    ? estadoReq.value.data as Record<string,string>:{};
  const byOwner=new Map<string,SupervisaoProcessoResumo[]>();
  for(const c of cases as any[]){
   const originalOwner=String(c.created_by||c.auth_user_id||'').trim();
   const owner=idsToAuth.get(originalOwner)||originalOwner||'sem-usuario';
   const protocolo=String(c.protocolo||c.protocolo_ref||'');
   const cnj=protocolo.replace(/\D/g,'');
   const status=String(statuses[cnj]||c.status||'Sem Prazo');
   const lista=byOwner.get(owner)||[];
   lista.push({
    id:String(c.id||c.db_id||protocolo),
    protocolo,
    cliente:String(c.cliente||'—'),
    status,
    ultimoRetorno:String(c.ultimoRetorno||c.ultimo_retorno||'—'),
    advogado:String(c.advogado||'—'),
    tribunal:String(c.tribunal||'—'),
    encerrado:status==='Encerrado',
    novidade:!!(c.tem_atualizacao_pos_retorno||c.djen_nova_comunicacao||c.tem_novo_andamento),
   });
   byOwner.set(owner,lista);
  }
  for(const lista of byOwner.values())lista.sort((a,b)=>a.cliente.localeCompare(b.cliente,'pt-BR'));
  const humanByUser=new Map(historico.porUsuario.map(u=>[u.userId,u.processos]));
  const grupos:SupervisaoUsuarioGrupo[]=(carteira.porUsuario||[]).map(u=>({
   ...u,atendidosSemana:humanByUser.get(String(u.key))||0,
   processos:byOwner.get(String(u.key))||[],
  }));
  const operadores=grupos.map(({processos,baixasTribunal,key,...u})=>u);
  const ativos=Number(carteira.ativos||0);
  const total=Number(carteira.total||0);
  const comRetorno=Number(carteira.comRetorno||0);
  const novosAuditoria=Math.max(0,Number(atividade.auditoriasLancadas||0)-Number(atividade.auditoriasImportadas||0));
  return {success:true,snapshot:{
   geradoEm:new Date().toISOString(),
   ultimaAlteracaoEm:carteira.ultimaAlteracaoEm,
   periodo,periodoLabel:labelPeriodo(periodo),
   historicoAtendimentos:historico,analisesInternas:analises,
   total,ativos,encerrados:Number(carteira.encerrados||0),
   baixasTribunal:Number(carteira.baixasTribunal||0),
   vencidos:Number(carteira.vencidos||0),
   novidades:Number(carteira.novidades||0),
   ba:Number(carteira.ba||0),
   cumprimento:Number(carteira.cumprimento||0),
   atendimentosTotais:comRetorno,
   atendidosSemana:historico.processos,
   // Auditoria documental/importações são categorias separadas de edição humana.
   auditadosSemana:novosAuditoria,
   auditadosHoje:historico.edicoes.hoje,
   auditadosTribunalSemana:Number(atividade.tribunalConsultados||0),
   editadosAppSemana:Number(atividade.edicoesProcessos||0),
   semRetorno:Number(carteira.semRetorno||0),
   taxaRetornoPct:total>0?Math.min(100,Math.round(comRetorno/total*100)):0,
   taxaRetornoPeriodoPct:ativos>0?Math.min(100,Math.round(Number(atividade.atendidosAtivosPeriodo||0)/ativos*100)):0,
   atendidosAtivosPeriodo:Number(atividade.atendidosAtivosPeriodo||0),
   auditoriasImportadasPeriodo:Number(atividade.auditoriasImportadas||0),
   edicoesEventosPeriodo:Number(atividade.edicoesEventos||0),
   tribunalDatajudPeriodo:Number(atividade.tribunalDatajud||0),
   tribunalDjenPeriodo:Number(atividade.tribunalDjen||0),
   operadores,porUsuario:grupos,
   timelineSemanal:atividade.timeline||[],
   porTribunal:carteira.porTribunal||[],
   porStatus:carteira.porStatus||[],
   porEscritorio:carteira.porEscritorio||[],
  }};
 }catch(error){
  console.error('[supervisao] falha ao obter snapshot consistente',error);
  return {success:false,error:error instanceof Error?error.message:'Falha ao consultar a Supervisão.'};
 }
}
