/**
 * Deterministic OmniReport: no provider, tokens, fabricated rulings or background
 * scraping. The text is an indexed documentary report, not LLM analysis.
 */
export type OfflineSource = {id:string;name:string;kind?:string;text:string};
export type OfflineSection = {number:string;title:string;body:string};

const MARKERS = /(?:\b\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}\b|\b\d{20}\b)/g;
const DATE = /\b(?:\d{1,2}[\/-]\d{1,2}[\/-]\d{4}|20\d{2}-\d{2}-\d{2})\b/g;
const ISSUE = /prazo|intimaç|sentenç|decisã|cumprimento|recurso|protocolo|distribuiç|pagamento|crédit|extinç|arquiv|trânsito|prescriç|substabelec|petiç|tutela|audienc|contrat|juros|seguro|movimentaç|publicaç|acordo|omissã|erro|indeferid|djen|datajud/i;

function normalized(value:string) {
  return String(value||'').replace(/<[^>]{0,200}>/g,' ').replace(/[\u0000-\u001f]+/g,' ').replace(/\s+/g,' ').trim();
}
function unique<T>(arr:T[]) {return [...new Set(arr)];}

export function buildOfflineOmniReport(
  instruction:string,
  sources:OfflineSource[],
  detail:'normal'|'profundo'|'maximo'
) {
  const filtered=sources.filter(x=>x.text.trim());
  const processIds=unique((instruction+'\n'+filtered.map(x=>x.text.slice(0,10000)).join('\n')).match(MARKERS)||[]).slice(0,80);
  const records=filtered.map(s=>{
    const lines=String(s.text||'').split(/\r?\n/).map(normalized).filter(x=>x.length>=12);
    const relevant=lines.filter(x=>ISSUE.test(x)||MARKERS.test(x)); MARKERS.lastIndex=0;
    const selected=unique((relevant.length?relevant:lines).map(x=>x.slice(0,700))).slice(0,detail==='normal'?6:detail==='profundo'?12:20);
    const dates=unique((s.text.slice(0,60000).match(DATE)||[])).slice(0,15);
    return {ref:s.id,name:s.name,kind:s.kind,characters:s.text.length,selected,dates};
  });
  const citations=(r:typeof records[number])=>'['+r.ref+']';
  const maxRecords=detail==='normal'?12:detail==='profundo'?24:40;
  const active=records.slice(0,maxRecords);
  const catalog=active.map(r=>'- **'+citations(r)+' '+r.name+'** ('+r.kind+', '+r.characters+' caracteres).').join('\n');
  const sample=active.flatMap(r=>r.selected.slice(0,detail==='normal'?3:detail==='profundo'?6:11).map((line,i)=>'- '+citations(r)+' Trecho '+(i+1)+': “'+line+'”')).slice(0,detail==='normal'?35:detail==='profundo'?90:180).join('\n');
  const dated=active.flatMap(r=>r.dates.slice(0,8).map(date=>'- **'+date+'** — data mencionada em '+citations(r)+', sem verificação independente.')).slice(0,70).join('\n');
  const caseList=processIds.length?processIds.map(id=>'- Processo mencionado: `'+id+'` — localizar autos e movimentações oficiais antes de classificar mérito ou fase.').join('\n'):'Nenhum número CNJ completo foi identificado na amostra textual.';
  const missing=active.filter(r=>r.kind==='imagem_nao_transcrita').length;
  const warning='As informações abaixo foram **extraídas e organizadas sem LLM**, não verificadas judicialmente. Cada trecho é uma declaração contida na fonte, não uma comprovação autônoma. Data de documento não é necessariamente data de movimentação.\n'+(missing?'Há '+missing+' imagem(ns) não transcrita(s), que exigem leitura humana ou OCR autorizado.\n':'');
  const sectionsBase=[
    ['Conclusões documentais e alcance', '## Objeto do relatório\n'+normalized(instruction||'Organização e conferência das fontes enviadas.')+'\n\n## O que pode ser afirmado\nForam fornecidas '+sources.length+' fontes documentais; '+processIds.length+' números CNJ distintos foram reconhecidos no recorte processado. A classificação jurídica, a veracidade e a atualidade das informações devem ser confirmadas nos autos e pelos responsáveis.\n\n'+warning],
    ['Inventário das fontes e método de prova', '## Inventário rastreável\n'+(catalog||'Nenhuma fonte de texto disponível.')+'\n\n## Metodologia\nOs trechos estão citados por [Sxx]/[Pxx], preservando identificadores e textos. Ausência de consulta ao tribunal, documento incompleto ou registro unilateral não equivale a prova oficial. Não foram efetuadas consultas externas nesta execução gratuita.'],
    ['Cronologia registrada e números de processo', '## Datas que aparecem nas fontes\n'+(dated||'Nenhuma data reconhecível no trecho analisado.')+'\n\n## Processos citados\n'+caseList+'\n\n**Conferir:** ordem temporal, confirmação do ato, teor original e eventual retificação.'],
    ['Trechos relacionados a eventos e divergências','## Excertos para verificação\n'+(sample||'Não foram identificados trechos substanciais.')+'\n\nCada excerto é um registro textual; o relatório não presume que alguma irregularidade ocorreu.'],
    ['Análise por dimensões de auditoria','## Competência, representação e peças\nConferir classe, competência, procurações e substabelecimentos nos autos originais.\n\n## Prazos e intimações\nComparar datas e destinatários das publicações com protocolos realizados, sem inferir preclusão apenas por silêncio da planilha.\n\n## Mérito, cumprimento e recursos\nDistinguir decisão, trânsito, cumprimento, quitação e arquivamento; nenhum desses eventos é confirmado apenas por este relatório.\n\n## Financeiro e contrato\nValidar documentos, valores e memória de cálculo antes de indicar restituição ou responsabilidade.\n\n## Documentos de suporte\n'+(sample||'Sem excertos textuais suficientes.')],
    ['Responsabilidades, causalidade e contraprovas','A existência de uma pessoa, advogado ou escritório nas fontes não atribui automaticamente responsabilidade. Para individualizar o fato, comparar atos assinados, poderes, intimações e tempo de gestão. Para alegar dano, identificar conduta, consequência comprovada e nexo causal.\n\n## Evidências a confrontar\n'+(sample||'Não existem recortes suficientes para essa comparação.')],
    ['Prioridades e diligências de validação','1. Recuperar os autos e publicações completos para cada CNJ citado.\n2. Organizar cada fato em **confirmado pelo ato**, **registro interno**, **relato** ou **hipótese**.\n3. Conferir datas, assinaturas, responsáveis e versões divergentes.\n4. Revisar prazos e pendências atuais antes de qualquer contato ou providência.\n5. Registrar conferência humana com data, responsável e link da fonte oficial.\n\n## Casos a conferir\n'+caseList],
    ['Limitações e anexo dos excertos','## Limitações\n'+warning+'\nO material pode estar incompleto, repetido ou desatualizado. A recuperação documental não implica pesquisa ao vivo de tribunais, autenticação de documentos ou parecer jurídico definitivo.\n\n## Amostra indexada das fontes\n'+(sample||'Nenhum trecho selecionado.')],
  ] as Array<[string,string]>;
  const indices=detail==='normal'?[0,1,2,6]:detail==='profundo'?[0,1,2,3,4,6,7]:[0,1,2,3,4,5,6,7];
  const sections:OfflineSection[]=indices.map((i,j)=>({
    number:String(j+1).padStart(2,'0'),title:sectionsBase[i][0],body:sectionsBase[i][1],
  }));
  const executive={
    headline:'Dossiê documental — leitura de fontes, sem IA externa',
    oneLine:'Organização rastreável de documentos e processos; apontamentos exigem conferência nos autos.',
    status:'misto' as const,
    metrics:[
      {label:'Fontes',value:String(sources.length),note:'materiais fornecidos'},
      {label:'CNJs reconhecidos',value:String(processIds.length),note:'não significa consulta ao tribunal'},
      {label:'Trechos indexados',value:String(active.reduce((n,r)=>n+r.selected.length,0)),note:'seleção documental'},
      {label:'Consulta judicial ao vivo',value:'Não',note:'modo gratuito local'},
    ],
    offices:[],lawyers:[],criticalFacts:[],
    cautions:['Documento ou alegação não equivale a decisão judicial validada.','A atribuição de responsabilidade exige autos, provas e análise humana.'],
  };
  return {sections,executive,cnjs:processIds.length,chunks:active.length};
}
