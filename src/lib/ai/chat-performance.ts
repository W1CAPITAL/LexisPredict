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

/** A deterministic, source-labelled safety net. Never synthesize judicial
 * conclusions from an unverified case, and never claim a live query occurred.
 */
export function summarizeAuthorizedCaseEvidence(raw:string):string|null {
 if(!raw.includes('[EVIDÊNCIAS INTERNAS AUTORIZADAS'))return null;
 const lines=raw.split(/\r?\n/);
 const value=(label:string):string|null=>{
  const line=lines.find(x=>x.startsWith(label+': '));
  const text=line?.slice(label.length+2).trim();
  return text && !/^N[aã]o registrad[oa]$/i.test(text) ? text : null;
 };
 const cnj=value('CNJ');
 if(!cnj || !/^\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}$/.test(cnj))return null;
 const cliente=value('Cliente cadastrado');
 const tribunal=value('Tribunal');
 const status=value('Status operacional');
 const mov=value('Última movimentação judicial cadastrada');
 const dataMov=value('Data movimento cadastrado');
 const retorno=value('Próximo retorno (campo)');
 const statusResumo=status?.replace(/\s*\|\s*Situa[cç][aã]o interna:.*/i,'').trim();
 const head=`Conforme o registro interno do LexisPredict, o processo ${cnj}${cliente?', de '+cliente:''}${tribunal?', no '+tribunal:''}${statusResumo?' está marcado como "'+statusResumo+'"':''}.`;
 const latest=mov ? `A última movimentação cadastrada${dataMov?' em '+dataMov:''} é: ${mov}.` : 'Não há movimentação judicial identificada nesse resumo.';
 const follow=retorno?`O próximo retorno interno está registrado para ${retorno}.`:'Não há data de retorno interno informada.';
 return [head,latest,follow,'Esta informação vem do registro interno e não é uma consulta judicial em tempo real.'].join(' ');
}
