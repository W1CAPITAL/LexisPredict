import { detectSuperAgentTask } from './lexis-superagent';

export type ChatWorkPlan = {
  mode:'case-summary'|'deep'|'general';
  liveJudicialLookup:boolean;
  needExtraResearch:boolean;
  allowRepair:boolean;
  maxTokens:number;
};

/** Speed policy is based on the request, never on the model or on personally
 * identifying contents of the case. Every case still needs authorized evidence.
 * A local summary must never be described as a live court verification.
 */
export function planChatWork(prompt:string, input?:{hasPdf?:boolean;hasImg?:boolean}):ChatWorkPlan {
  const task=detectSuperAgentTask(prompt);
  const hasAttachment=!!(input?.hasPdf||input?.hasImg);
  const fullReport=/\b(?:complet[oa]|detalhad[oa]|aprofundad[oa]|exaustiv[oa]|fundamentad[oa]|estrat[eé]gia|peti[cç][aã]o|provas?|decis[oã]es?|jurisprud[eê]ncia|compar[ea]|linha do tempo|cronologia|pesquisa aprofundada)\b/iu.test(prompt);
  const liveRequest=/(?:consult|pesquis|verific|confirm|chec|atualiz|busc|acesse|abr[ai]|pesquise).{0,75}(?:djen|datajud|tribunal|andamento|movimenta|publica[cç]|autos)/iu.test(prompt)
    || /(?:djen|datajud|tribunal).{0,55}(?:agora|atualiz|consult|pesquis|verific)/iu.test(prompt)
    || /(?:[uú]ltim[ao]s?\s+(?:andamento|movimenta[cç][aã]o|publica[cç][aã]o)|movimenta[cç][aã]o\s+mais\s+recente|novidades?\s+de\s+hoje)/iu.test(prompt);
  const deep=hasAttachment||['dossie','investigacao','relatorio'].includes(task)||fullReport||liveRequest;
  if(deep)return {mode:'deep',liveJudicialLookup:liveRequest||task==='dossie'||task==='investigacao',needExtraResearch:true,allowRepair:true,maxTokens:3000};
  if(task==='analise-processual'||task==='atendimento')
    return {mode:'case-summary',liveJudicialLookup:false,needExtraResearch:false,allowRepair:false,maxTokens:900};
  return {mode:'general',liveJudicialLookup:false,needExtraResearch:false,allowRepair:false,maxTokens:950};
}
