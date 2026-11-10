/** Agent navigation is an illustration tied to recent, tenant-authorized audit events.
 * It never asserts work is happening without an event in the last five minutes. */
export type HermesOfficeEvent={
 id:number;
 sector:string;
 kind:string;
 status:'working'|'completed'|'warning';
 title:string;
 detail:string|null;
 processo_id:number|null;
 recorded_at:string;
};
export type HermesStationCoordinates={id:string;x:number;y:number};
export type HermesAgentRoute={
 status:'idle'|'working'|'completed'|'attention'|'meeting-replay';
 isLive:boolean;
 target:{x:number;y:number};
 label:string;
 event:HermesOfficeEvent|null;
};
const DESTINATIONS:Record<string,{x:number;y:number}>={
 processos:{x:34,y:31},
 provas:{x:48,y:36},
 operacao:{x:63,y:33},
 comunicacoes:{x:32,y:52},
 relatorios:{x:68,y:55},
 agentes:{x:48,y:62},
 crm:{x:38,y:66},
 gestao:{x:50,y:48},
};
const MEETING_DESTINATION={x:50,y:48};

/** 8 small avatars use CSS transforms. The event audit—not the avatar—is the source of truth. */
export function getHermesAgentDestination(
  station:HermesStationCoordinates,
  events:HermesOfficeEvent[],
  replayingMeeting:boolean,
  now:Date=new Date(),
):HermesAgentRoute{
 const latest=(events||[]).find(e=>e.sector===station.id && Number.isFinite(Date.parse(e.recorded_at)))||null;
 if(replayingMeeting&&['gestao','agentes','processos','crm'].includes(station.id)){
  return {status:'meeting-replay',isLive:false,target:MEETING_DESTINATION,
    label:'Reprodução da ata',event:latest};
 }
 const age=latest?now.getTime()-Date.parse(latest.recorded_at):Infinity;
 // Only very recent records may be presented as currently being processed.
 const recent=age>=0&&age<5*60*1000;
 if(recent&&latest){
  const status=latest.status==='working'?'working':latest.status==='warning'?'attention':'completed';
  return {status,isLive:latest.status==='working',
    target:DESTINATIONS[station.id]||{x:50,y:50},
    label:latest.title.slice(0,60),event:latest};
 }
 // Idle movement is explicitly a visual patrol, not a claim of ongoing automation.
 const idleTarget=station.id==='gestao'?{x:58,y:60}:{x:Math.min(82,Math.max(16,station.x+(station.x<50?16:-13))),y:Math.min(82,Math.max(17,station.y+(station.y<50?13:-12)))};
 return {status:'idle',isLive:false,target:idleTarget,
   label:latest?'Última atividade registrada':'Ronda visual · sem tarefa recente',event:latest};
}

export function hermesOfficeEventClock(date:string):string{
 const t=Date.parse(date);
 if(!Number.isFinite(t))return 'Horário não disponível';
 return new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(t));
}
