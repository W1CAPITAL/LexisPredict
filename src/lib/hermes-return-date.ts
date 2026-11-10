import {validReturnDay} from '@/lib/wa-daily-return-policy';
/** Return policies are administrative. A 0–19-day gap is an inconsistent register,
 * not proof that a customer return has become overdue. Never edits source dates. */
export type HermesReturnDateState='unverifiable'|'inconsistent'|'upcoming'|'today'|'overdue';
export function classifyHermesReturnDate(lastRaw:unknown,nextRaw:unknown,todayRaw:unknown):HermesReturnDateState{
 const last=validReturnDay(lastRaw),next=validReturnDay(nextRaw),today=validReturnDay(todayRaw);
 if(!next||!today||!last)return 'unverifiable';
 const lastMs=Date.parse(last+'T12:00:00Z'),nextMs=Date.parse(next+'T12:00:00Z');
 const gap=Math.round((nextMs-lastMs)/86400000);
 if(!Number.isFinite(gap)||gap<20)return 'inconsistent';
 return next>today?'upcoming':next===today?'today':'overdue';
}
