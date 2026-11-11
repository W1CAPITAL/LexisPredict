import type {HermesCourtEvent} from '@/lib/hermes-return-policy';

type StalledEvidenceInput={
 today:string;
 djenOk:boolean;
 datajudOk:boolean;
 events:readonly HermesCourtEvent[];
 lastKnownDataJudMove:string|null;
 lastKnownDjenPublication:string|null;
};
export type StalledEvidenceState='confirmed_idle'|'recent_movement'|'no_dated_movement'|'partial'|'unavailable';

function asDay(value:unknown):string|null{
 const v=String(value||'').slice(0,10);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(v))return null;
 const t=Date.parse(v+'T12:00:00Z');
 return Number.isFinite(t)&&new Date(t).toISOString().slice(0,10)===v?v:null;
}
function mostRecent(values:readonly (string|null)[]):string|null{
 const sorted=values.map(asDay).filter((x):x is string=>x!==null).sort();
 return sorted.length?sorted[sorted.length-1]:null;
}
/** DJEN contém publicações e comunicações, não comprova todos os atos dos autos.
 * Nunca usar uma data de publicação como data de movimentação do processo.
 */
export function evaluateHermesStalledEvidence(input:StalledEvidenceInput){
 const lastMovementAt=mostRecent([
  input.lastKnownDataJudMove,
  ...input.events.filter(e=>e.source==='DataJud').map(e=>e.at),
 ]);
 const lastPublicationAt=mostRecent([
  input.lastKnownDjenPublication,
  ...input.events.filter(e=>e.source==='DJEN').map(e=>e.at),
 ]);
 const today=asDay(input.today);
 const daysWithoutMovement=today&&lastMovementAt?
  Math.max(0,Math.round((Date.parse(today+'T12:00:00Z')-Date.parse(lastMovementAt+'T12:00:00Z'))/86400000)):null;
 const state:StalledEvidenceState=
  !input.datajudOk&&!input.djenOk?'unavailable':
  !input.datajudOk||!input.djenOk?'partial':
  daysWithoutMovement===null?'no_dated_movement':
  daysWithoutMovement>=15?'confirmed_idle':'recent_movement';
 return {state,lastMovementAt,lastPublicationAt,daysWithoutMovement};
}
