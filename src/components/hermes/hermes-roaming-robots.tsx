'use client';
import {getHermesAgentDestination,type HermesOfficeEvent} from '@/lib/hermes-agent-route';
import type {HermesOfficeStation} from '@/lib/hermes-office';
import type {CSSProperties} from 'react';

/** O roteiro visual segue os eventos persistidos, mas não executa trabalho no navegador.
 * Caminhadas sem eventos são explicitamente rondas visuais. */
export function HermesRoamingRobots({stations,events,meetingReplay,eco,select}:{
 stations:HermesOfficeStation[];events:HermesOfficeEvent[];
 meetingReplay:boolean;eco:boolean;select:(id:string)=>void;
}){
 const now=new Date();
 return <div className="h3d-navigation-plane" data-eco={eco?'true':'false'}
   aria-label="Agentes caminhando entre setores do escritório">
  {stations.map((station,index)=>{
    const route=getHermesAgentDestination(station,events,meetingReplay,now);
    const style={
      left:station.x+'%',top:station.y+'%',
      '--h3d-dx':(route.target.x-station.x)+'cqw',
      '--h3d-dy':(route.target.y-station.y)+'cqh',
      '--h3d-accent':station.color,
      '--h3d-walk-delay':(-index*2.6)+'s',
      '--h3d-walk-duration':(18+(index%4)*3)+'s',
    } as CSSProperties;
    return <button type="button" key={station.id}
       onClick={()=>select(station.id)}
       aria-label={station.title+': '+route.label+
         (route.isLive?' — atividade recente em processamento':' — representação visual')}
       title={station.title+' · '+route.label}
       className="h3d-roaming-agent"
       data-activity={route.status} data-verified-live={route.isLive?'true':'false'}
       style={style}>
      <span className="h3d-roaming-robot" aria-hidden="true">
        <i className="h3d-roaming-ant"/>
        <span className="h3d-roaming-head"><i/><i/></span>
        <span className="h3d-roaming-body"><b/></span>
        <span className="h3d-roaming-foot h3d-foot-left"/>
        <span className="h3d-roaming-foot h3d-foot-right"/>
      </span>
      <span className="h3d-roaming-tag">{station.glyph} · {station.title.split(' ').slice(0,2).join(' ')}</span>
      <span className="h3d-roaming-task">{route.status==='meeting-replay'?'Reproduzindo ata':route.isLive?'Consultando fonte':route.status==='attention'?'Alerta registrado':'Ronda ilustrativa'}</span>
    </button>;
  })}
 </div>;
}
