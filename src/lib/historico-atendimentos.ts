import { getSupabaseAdmin } from "@/lib/server-db";
import { periodBounds, type PeriodoRelatorio } from "@/lib/atendimento-semana";

export type AtendimentosHistorico = {
 processos:number; eventos:number; tecnicoEventos:number;
 porUsuario:Array<{userId:string;nome:string;processos:number;eventos:number}>;
 dias:Array<{ymd:string;day:string;atendimentos:number}>;
 atualizadoEm:string; periodo:PeriodoRelatorio;
};
export function emptyHistorico(periodo:PeriodoRelatorio="esta_semana"):AtendimentosHistorico{
 return {processos:0,eventos:0,tecnicoEventos:0,porUsuario:[],dias:[],atualizadoEm:"",periodo};
}
const toYmd=(d:Date)=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");
const labelDia=["DOM","SEG","TER","QUA","QUI","SEX","SÁB"];
const saoPauloDay=(raw:string)=>new Intl.DateTimeFormat("en-CA",{
 timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"
}).format(new Date(raw));
// Histórico imutável é a fonte de verdade. Não se apoia em ultimo_retorno
// que muda quando outro operador atende ou o scanner atualiza o cadastro.
export async function getHistoricoAtendimentosEmpresa(
 empresaId:string,periodo:PeriodoRelatorio="esta_semana"
):Promise<AtendimentosHistorico>{
 const db=await getSupabaseAdmin();
 const {start,end}=periodBounds(periodo);
 const inicio=toYmd(start),final=toYmd(end);
 const next=new Date(end.getFullYear(),end.getMonth(),end.getDate()+1);
 const from=inicio+"T03:00:00Z",to=toYmd(next)+"T03:00:00Z";
 const {data:users,error:errUsers}=await db.from("usuarios")
   .select("auth_user_id,nome").eq("empresa_id",empresaId);
 if(errUsers)throw errUsers;
 const nomeById=new Map<string,string>();
 for(const u of users||[]){
  const nome=String(u.nome||"").trim();
  // Identidades técnicas ficam em indicador próprio, não em atendimento humano.
  if(!/^(w1 control|sistema interno|supervis[aã]o|get)$/i.test(nome))
   nomeById.set(String(u.auth_user_id),nome);
 }
 type Log={auth_user_id:string|null;protocolo_ref:string|null;created_at:string;action:string;detalhes:Record<string,unknown>|null};
 const logs:Log[]=[];
 for(let fromRow=0;fromRow<15000;fromRow+=500){
  const {data,error}=await db.from("auditoria_logs_app")
   .select("auth_user_id,protocolo_ref,created_at,action,detalhes")
   .eq("empresa_id",empresaId)
   .in("action",["atendimento","encerramento"])
   .gte("created_at",from).lt("created_at",to)
   .order("created_at",{ascending:false}).range(fromRow,fromRow+499);
  if(error)throw error;
  logs.push(...((data||[]) as Log[]));
  if((data||[]).length<500)break;
 }
 const all=new Set<string>();let events=0,tecnicoEventos=0;
 const byUser=new Map<string,{nome:string;ids:Set<string>;eventos:number}>();
 const byDay=new Map<string,Set<string>>();
 for(const ev of logs){
  // Encerramento em lote não é atendimento; somente encerramento por
  // formulário de atendimento com identificador próprio conta.
  if(ev.action==="encerramento"&&!ev.detalhes?.event_id)continue;
  const actor=String(ev.auth_user_id||"");
  const norm=String(ev.protocolo_ref||"").replace(/\D/g,"");
  if(norm.length!==20)continue;
  const nome=nomeById.get(actor);
  if(!nome){tecnicoEventos++;continue;}
  events++;all.add(norm);
  const item=byUser.get(actor)||{nome,ids:new Set<string>(),eventos:0};
  item.ids.add(norm);item.eventos++;
  byUser.set(actor,item);
  const day=saoPauloDay(ev.created_at);
  if(!byDay.has(day))byDay.set(day,new Set<string>());
  byDay.get(day)!.add(norm);
 }
 const days:Array<{ymd:string;day:string;atendimentos:number}>=[];
 for(let d=new Date(start);d<=end;d.setDate(d.getDate()+1)){
  const ymd=toYmd(d);
  days.push({ymd,day:labelDia[d.getDay()],atendimentos:byDay.get(ymd)?.size||0});
 }
 return {
  processos:all.size,eventos:events,tecnicoEventos,
  porUsuario:[...byUser.entries()].map(([userId,v])=>({
    userId,nome:v.nome,processos:v.ids.size,eventos:v.eventos
  })).sort((a,b)=>b.processos-a.processos),
  dias:days,atualizadoEm:new Date().toISOString(),periodo
 };
}
