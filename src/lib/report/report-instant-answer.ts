/** Análise local determinística, sem download de modelo, para evitar telas travadas.
 * Cada frase deriva exclusivamente dos dados agregados do /report.
 * Nenhuma execução judicial, contato ou resultado é inferido do texto livre.
 */
export type PessoaResumo = {
  nome:string;
  atendimentos:{processos:number;eventos:number};
  edicoes:{processos:number;eventos:number};
  encerramentos:{processos:number;eventos:number};
  atividades:number;
  trabalho:number;
  verificacoesLote:number;
  categorias:Array<{categoria:string;registros:number}>;
  entregas:string[];
};
export type IndicadoresRelatorio = {
  periodo:string;total:number|null;ativos:number|null;encerrados:number|null;
  vencidos:number|null;novidades:number|null;atendidos:number|null;eventos:number|null;
  semRetorno30:number|null;naoLocalizados:number|null;meritoPendente:number|null;
  encerradosEmCumprimento:number|null;improcedentesOficiais:number|null;
  procedentesOficiais:number|null;parciaisOficiais:number|null;
  semMeritoOficial:number|null;equipe:PessoaResumo[];
};
const num=(n:number|null|undefined)=>n==null?"não disponível":Number(n).toLocaleString("pt-BR");
const norm=(text:string)=>text.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
function pessoaDescricao(x:PessoaResumo){
  const fr=[
    x.atendimentos.processos?num(x.atendimentos.processos)+" processos atendidos ("+num(x.atendimentos.eventos)+" registros)":"nenhum atendimento identificado no período",
    x.edicoes.eventos?num(x.edicoes.processos)+" processos editados ("+num(x.edicoes.eventos)+" edições)":"nenhuma edição registrada",
    x.encerramentos.eventos?num(x.encerramentos.processos)+" processos com encerramento registrado":"nenhum encerramento manual registrado",
    num(x.atividades)+" atividades cadastradas",
  ];
  let s=x.nome+": "+fr.join("; ")+".";
  if(x.trabalho) s+=" Há "+num(x.trabalho)+" registros de análises e auditorias, dos quais "+num(x.verificacoesLote)+" são verificações sistêmicas em lote, não atendimentos individuais.";
  if(x.entregas.length) s+=" Entregas identificadas: "+x.entregas.slice(0,5).join("; ")+".";
  return s;
}
export function responderRelatorioPergunta(raw:string,f:IndicadoresRelatorio):string {
 const q=norm(raw.trim());
 const who=f.equipe.find(x=>norm(x.nome).split(/\s+/).some((part,i)=>i===0&&part.length>2&&new RegExp("(^|\\W)"+part+"(\\W|$)").test(q)));
 if(who && /(fez|fazer|trabalho|atividade|entreg|produtiv|atend|edit|encerr|dossie|investig|audit|projet|sistema|resum|quant)/.test(q)){
   return pessoaDescricao(who)+" As fontes de atendimento, tarefas e auditoria podem referir-se aos mesmos processos; não devem ser somadas.";
 }
 if(/(prioridade|primeiro|urgente|atencao|risco|pendente|vencid|atrasad|acompanh|cobrar)/.test(q)){
  const parts=[
   f.vencidos!=null&&f.vencidos>0?num(f.vencidos)+" retornos estão vencidos":null,
   f.semRetorno30!=null&&f.semRetorno30>0?num(f.semRetorno30)+" processos ativos estão sem retorno recente (30 dias ou mais, incluindo nunca registrados)":null,
   f.encerradosEmCumprimento!=null&&f.encerradosEmCumprimento>0?num(f.encerradosEmCumprimento)+" processos encerrados no CRM têm sinal de cumprimento a conferir":null,
   f.meritoPendente!=null&&f.meritoPendente>0?num(f.meritoPendente)+" resultados judiciais continuam a esclarecer":null,
  ].filter(Boolean);
  return (parts.length?"As pendências que merecem conferência são: "+parts.join("; ")+".":"Os indicadores disponíveis não apontam quantidades positivas de pendências nesta consulta; isso não substitui a revisão dos processos.")+
   " Comece pelos retornos vencidos e confira os casos com prazo ou cumprimento ativo. Os números não indicam, por si só, erro do advogado ou perda judicial.";
 }
 if(/(atend|contat|whats|email|equipe|compar|colaborador|responsav)/.test(q)){
   const items=f.equipe.filter(x=>x.atendimentos.eventos>0).map(x=>x.nome+": "+num(x.atendimentos.processos)+" processos atendidos e "+num(x.atendimentos.eventos)+" registros.");
   return "Atendimentos do período "+f.periodo+": "+(items.length?items.join(" "):"não há atendimentos individuais identificados nesta fonte.")+
    " O crédito é de quem realizou o atendimento, mesmo quando a carteira pertence a outro responsável. Eventos repetidos não são processos diferentes.";
 }
 if(/(encerr|extin|improced|proced|julg|merito|sentenc|resultado)/.test(q)){
  return "A carteira tem "+num(f.encerrados)+" processos encerrados administrativamente. Nos movimentos oficiais, há "+num(f.procedentesOficiais)+" procedências identificadas, "+num(f.parciaisOficiais)+" procedências parciais, "+num(f.improcedentesOficiais)+" improcedências e "+num(f.semMeritoOficial)+" registros sem resolução de mérito. Há "+num(f.meritoPendente)+" resultados a esclarecer e "+num(f.encerradosEmCumprimento)+" encerrados no CRM com indício de cumprimento. Encerramento no CRM não comprova trânsito em julgado.";
 }
 if(/(dossie|projet|sistema|planilha|investig|audit|atividade|entreg|intern)/.test(q)){
  const withWork=f.equipe.filter(x=>x.trabalho||x.atividades);
  if(!withWork.length)return "Não há entregas ou atividades cadastradas nesta base e período. Isso não comprova que não existiu trabalho fora do sistema.";
  return withWork.map(x=>{
   let s=x.nome+": "+num(x.atividades)+" atividades cadastradas, "+num(x.trabalho)+" registros analíticos";
   if(x.verificacoesLote)s+=" ("+num(x.verificacoesLote)+" verificações em lote)";
   if(x.entregas.length)s+=". Entregas: "+x.entregas.slice(0,5).join("; ");
   return s+".";
  }).join(" ")+" As verificações em lote não são contabilizadas como trabalho manual individual.";
 }
 if(/(quant|total|carteira|ativo|novidade|panorama|resumo|geral)/.test(q)){
  return "Panorama da carteira: "+num(f.total)+" processos, dos quais "+num(f.ativos)+" ativos e "+num(f.encerrados)+" encerrados no CRM. "+num(f.vencidos)+" retornos vencidos e "+num(f.novidades)+" com novidades. No período "+f.periodo+", foram identificados "+num(f.atendidos)+" processos atendidos e "+num(f.eventos)+" eventos de atendimento. Números atuais da carteira e eventos no período são medidas distintas.";
 }
 return "Posso explicar os dados já conferidos nesta página: "+num(f.total)+" processos na carteira, "+num(f.vencidos)+" retornos vencidos e "+num(f.atendidos)+" processos atendidos no período. Para aprofundar, pergunte sobre Davi, Kris, Adriana, atendimentos, atividades, dossiês, encerramentos ou prioridades. Não consigo concluir uma investigação individual apenas com estes indicadores agregados.";
}
