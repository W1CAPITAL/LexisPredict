import React from "react";
import {Document,Page,Text,View,StyleSheet} from "@react-pdf/renderer";
import type {EquipeMembro,EquipeRelatorio} from "@/components/report/team-report";

export type ReportPdfOverview={total:number|null;ativos:number|null;encerrados:number|null;vencidos:number|null;novidades:number|null;atendidos:number|null;eventos:number|null;semRetorno30:number|null;meritoPendente:number|null;procedentes:number|null;improcedentes:number|null;parciais:number|null;semMerito:number|null};
export type ReportPdfDay={ymd:string;atendimentos:number;encerramentos:number};
const K={navy:"#0C1529",surface:"#14233D",violet:"#8257EA",blue:"#287DE3",pink:"#D65BA6",green:"#1AA48A",amber:"#C58930",red:"#C85268",ink:"#162039",muted:"#65728A",border:"#DCE4F0",off:"#F6F8FC"};
const st=StyleSheet.create({
 page:{backgroundColor:"#FFF",paddingBottom:44,fontFamily:"Helvetica",color:K.ink,fontSize:9},
 hero:{backgroundColor:K.navy,paddingHorizontal:38,paddingTop:28,paddingBottom:23,minHeight:139},
 brand:{fontSize:9,color:"#C5B5FF",fontWeight:700,letterSpacing:1.7,marginBottom:12},
 heroTitle:{color:"#FFF",fontSize:27,fontWeight:700,marginBottom:6},
 heroSubtitle:{color:"#C5CFE3",fontSize:9.2,lineHeight:1.4,maxWidth:460},
 heroTags:{flexDirection:"row",marginTop:13},
 heroTag:{paddingVertical:6,paddingHorizontal:10,backgroundColor:K.surface,borderRadius:5,marginRight:7},
 heroTagText:{color:"#E5EBFA",fontSize:8},
 body:{paddingHorizontal:38,paddingTop:19},
 eyebrow:{color:K.violet,fontSize:8,fontWeight:700,letterSpacing:1.1,marginBottom:4},
 title:{fontSize:14.5,fontWeight:700,marginBottom:7},
 subtitle:{fontSize:8.3,color:K.muted,lineHeight:1.4},
 kpis:{flexDirection:"row",flexWrap:"wrap",justifyContent:"space-between",marginTop:6},
 kpi:{width:"32%",backgroundColor:K.off,borderWidth:1,borderColor:K.border,borderLeftWidth:3,borderRadius:7,padding:9,height:68,marginBottom:8},
 kpiLabel:{fontSize:7.2,color:K.muted},
 kpiNumber:{fontSize:19.5,fontWeight:700,marginTop:5},
 kpiNote:{fontSize:7,color:K.muted,marginTop:3},
 split:{flexDirection:"row",justifyContent:"space-between",marginTop:7},
 boxLeft:{width:"56%",height:162,borderWidth:1,borderColor:K.border,backgroundColor:"#FAFBFD",borderRadius:9,padding:12},
 boxRight:{width:"41.5%",height:162,borderWidth:1,borderColor:K.border,backgroundColor:"#FAFBFD",borderRadius:9,padding:12},
 boxTitle:{fontSize:9.8,fontWeight:700,marginBottom:4},
 chart:{height:94,flexDirection:"row",alignItems:"flex-end",borderBottomWidth:1,borderBottomColor:"#C5D0DF",marginTop:7},
 chartColumn:{flex:1,height:"100%",alignItems:"center",justifyContent:"flex-end",marginRight:1},
 chartBar:{width:"75%",backgroundColor:K.violet,borderTopLeftRadius:2,borderTopRightRadius:2},
 caption:{fontSize:7.1,color:K.muted,marginTop:8,lineHeight:1.3},
 stacked:{height:12,flexDirection:"row",borderRadius:6,overflow:"hidden",backgroundColor:"#E8EDF5",marginVertical:13},
 legend:{flexDirection:"row",alignItems:"center",marginBottom:6},
 dot:{width:7,height:7,borderRadius:5,marginRight:7},
 legendLabel:{fontSize:7.9,color:K.muted,flex:1},
 legendValue:{fontSize:9,fontWeight:700},
 section:{marginTop:16},
 alerts:{flexDirection:"row",justifyContent:"space-between",marginTop:8},
 alert:{width:"32%",borderWidth:1,borderColor:K.border,backgroundColor:K.off,borderRadius:7,padding:10,height:74,borderTopWidth:3},
 alertLabel:{fontSize:8,color:K.muted,lineHeight:1.25},
 alertNumber:{fontSize:18,fontWeight:700,marginTop:7},
 merit:{flexDirection:"row",justifyContent:"space-between",marginTop:9},
 meritBox:{width:"24%",backgroundColor:K.off,borderRadius:7,borderWidth:1,borderColor:K.border,padding:10,height:60},
 meritLabel:{fontSize:7.3,color:K.muted},
 meritNumber:{fontSize:16.5,fontWeight:700,marginTop:7},
 callout:{marginTop:12,backgroundColor:"#F1EEFC",borderLeftWidth:3,borderLeftColor:K.violet,borderRadius:5,padding:10},
 calloutText:{fontSize:8.1,lineHeight:1.42},
 topbar:{backgroundColor:K.navy,paddingHorizontal:38,paddingTop:28,paddingBottom:22},
 topbarTitle:{color:"#FFF",fontSize:22,fontWeight:700},
 topbarSub:{color:"#C8D3E5",fontSize:8.7,lineHeight:1.4,marginTop:6},
 summaryCards:{flexDirection:"row",justifyContent:"space-between",marginTop:9},
 summaryCard:{width:"32%",borderWidth:1,borderColor:K.border,backgroundColor:K.off,borderRadius:8,padding:11,height:64},
 summaryLabel:{fontSize:7.2,color:K.muted},
 summaryNumber:{fontSize:19,fontWeight:700,marginTop:6},
 table:{borderWidth:1,borderColor:K.border,borderRadius:7,marginTop:10,overflow:"hidden"},
 tableRow:{flexDirection:"row",paddingVertical:9,paddingHorizontal:7,borderBottomWidth:1,borderBottomColor:"#E8EDF4"},
 tableHeader:{backgroundColor:"#EBEFF7"},
 nameCell:{width:"25%",fontSize:8.1,fontWeight:700},
 numberCell:{width:"15%",fontSize:8.1,textAlign:"right"},
 compare:{marginTop:15,borderWidth:1,borderColor:K.border,borderRadius:8,padding:12},
 compareRow:{flexDirection:"row",alignItems:"center",marginTop:9},
 compareName:{width:"28%",fontSize:8.2},
 compareTrack:{flex:1,height:9,backgroundColor:"#E5EAF3",borderRadius:5,overflow:"hidden"},
 compareN:{width:38,textAlign:"right",fontSize:8.5,fontWeight:700},
 quiet:{marginTop:14,backgroundColor:K.off,padding:11,borderWidth:1,borderColor:K.border,borderRadius:6},
 quietTitle:{fontSize:9,fontWeight:700,marginBottom:5},
 detailedHeader:{marginTop:13,padding:13,backgroundColor:K.surface,borderRadius:8},
 detailedName:{fontSize:14.5,color:"#FFF",fontWeight:700},
 detailedMeta:{fontSize:8,color:"#C8D6EA",marginTop:5,lineHeight:1.4},
 detailCards:{flexDirection:"row",flexWrap:"wrap",justifyContent:"space-between",marginTop:7},
 detailCard:{width:"32%",borderWidth:1,borderColor:K.border,borderRadius:6,backgroundColor:K.off,padding:9,marginBottom:7},
 detailLabel:{fontSize:7,color:K.muted},
 detailNum:{fontSize:14.5,fontWeight:700,marginTop:5},
 detailSub:{fontSize:10,fontWeight:700,marginTop:10,marginBottom:6},
 category:{flexDirection:"row",borderBottomWidth:.5,borderBottomColor:K.border,paddingBottom:5,marginBottom:5,justifyContent:"space-between"},
 categoryLabel:{fontSize:8.2,color:"#3D475C",width:"82%"},
 categoryNumber:{fontSize:8.5,fontWeight:700},
 work:{backgroundColor:K.off,borderWidth:1,borderColor:K.border,borderRadius:7,marginBottom:7,padding:10},
 workMeta:{fontSize:7.4,color:K.violet,marginBottom:5},
 workTitle:{fontSize:9,fontWeight:700,lineHeight:1.25},
 workDesc:{fontSize:8.3,lineHeight:1.45,color:"#455169",marginTop:5},
 micro:{fontSize:8,color:K.muted,lineHeight:1.4,marginTop:6},
 method:{marginTop:16,backgroundColor:K.off,padding:13,borderRadius:8},
 footer:{position:"absolute",left:38,right:38,bottom:18,paddingTop:7,borderTopWidth:1,borderTopColor:K.border,flexDirection:"row",justifyContent:"space-between"},
 footerText:{fontSize:7,color:"#8794A8"}
});
const n=(x:number|null|undefined)=>x==null?"—":x.toLocaleString("pt-BR");
const d=(x?:string)=>x&&/^\d{4}-\d{2}-\d{2}$/.test(x)?x.slice(8,10)+"/"+x.slice(5,7)+"/"+x.slice(0,4):x||"—";
const name=(x:string)=>({atendimento:"Atendimento",analise_processual:"Análise processual",auditoria:"Auditoria",dossie:"Dossiê",investigacao:"Investigação",auditoria_sistemica:"Auditoria sistêmica em lote",auditoria_documental:"Revisão documental",triagem_replica_provas:"Triagem de réplica e provas",dossie_individual:"Dossiê individual",entrega_projeto:"Entrega de projeto",investigacao_get:"Investigação GET",investigacao_externa:"Investigação externa"} as Record<string,string>)[x]||x.replaceAll("_"," ");
const evidence=(x:EquipeMembro)=>x.atendimentos.eventos+x.edicoes.eventos+x.encerramentos.eventos+x.atividades.registros+x.trabalho.registros+(x.atividades.registrosTotal||0);
function Footer(){return <View fixed style={st.footer}><Text style={st.footerText}>LEXISPREDICT  /  RELATÓRIO GERENCIAL  •  USO INTERNO</Text><Text style={st.footerText} render={({pageNumber,totalPages})=>pageNumber+" / "+totalPages}/></View>}
function Kpi({label,value,note,color}:{label:string;value:number|null;note:string;color:string}){return <View style={[st.kpi,{borderLeftColor:color}]}><Text style={st.kpiLabel}>{label}</Text><Text style={st.kpiNumber}>{n(value)}</Text><Text style={st.kpiNote}>{note}</Text></View>}
function Trend({data}:{data:ReportPdfDay[]}){
 const values=data.slice(-31),max=Math.max(1,...values.map(x=>x.atendimentos||0));
 return <View style={st.boxLeft}><Text style={st.boxTitle}>EVOLUÇÃO DOS ATENDIMENTOS</Text><Text style={st.subtitle}>Histórico diário • período escolhido</Text>
 {values.length?<View style={st.chart}>{values.map((x,i)=><View key={x.ymd+i} style={st.chartColumn}><View style={[st.chartBar,{height:Math.max(2,82*Math.max(0,x.atendimentos)/max)}]}/></View>)}</View>:<View style={{height:94,justifyContent:"center"}}><Text style={st.subtitle}>Histórico diário indisponível nesta consulta.</Text></View>}
 <Text style={st.caption}>{values.length?d(values[0].ymd)+" até "+d(values[values.length-1].ymd)+"  •  pico: "+n(max):"Nenhum número foi estimado."}</Text></View>
}
function Portfolio({data}:{data:ReportPdfOverview}){
 const total=data.total||0,values=[{title:"Ativos",value:data.ativos||0,color:K.violet},{title:"Encerrados no CRM",value:data.encerrados||0,color:K.blue},{title:"Outras situações",value:Math.max(0,total-(data.ativos||0)-(data.encerrados||0)),color:K.pink}];
 return <View style={st.boxRight}><Text style={st.boxTitle}>DISTRIBUIÇÃO DA CARTEIRA</Text><Text style={st.subtitle}>Situação atual no CRM</Text><View style={st.stacked}>{total>0?values.map(x=><View key={x.title} style={{width:100*x.value/total+"%",backgroundColor:x.color}}/>):null}</View>
 {values.map(x=><View key={x.title} style={st.legend}><View style={[st.dot,{backgroundColor:x.color}]}/><Text style={st.legendLabel}>{x.title}</Text><Text style={st.legendValue}>{n(data.total==null?null:x.value)}</Text></View>)}
 <Text style={st.caption}>Encerrado no CRM ≠ êxito judicial.</Text></View>
}
function Member({person:p}:{person:EquipeMembro}){
 const jobs=p.trabalho.entregasRecentes||[],recent=p.atividades.recentes||[];
 const categories=[...(p.atividades.categorias||[])].sort((a,b)=>b.registros-a.registros);
 const analysis=[...(p.trabalho.categorias||[])].sort((a,b)=>b.registros-a.registros);
 return <View style={{marginTop:11}}>
  <View wrap={false} style={st.detailedHeader}><Text style={st.detailedName}>{p.nome.toLocaleUpperCase("pt-BR")}</Text><Text style={st.detailedMeta}>{p.cargo||"Colaborador"} • Carteira: {n(p.carteira.total)} ({n(p.carteira.ativos)} ativos, {n(p.carteira.encerrados)} encerrados no CRM)</Text></View>
  <View style={st.detailCards} wrap={false}>{[
   ["Processos atendidos",p.atendimentos.processos],["Eventos de atendimento",p.atendimentos.eventos],["Processos editados",p.edicoes.processos],
   ["Encerramentos manuais",p.encerramentos.processos],["Atividades no período",p.atividades.registros],["Atividades · histórico",p.atividades.registrosTotal],["Processos relacionados",p.atividades.processosTotal],["Contatos marcados",p.atividades.contatosMarcadosTotal],["Sem referência",p.atividades.semReferenciaTotal],["Registros analíticos",p.trabalho.registros]
  ].map(([label,value])=><View key={String(label)} style={st.detailCard}><Text style={st.detailLabel}>{label}</Text><Text style={st.detailNum}>{n(value as number)}</Text></View>)}</View>
  {p.trabalho.verificacoesLote>0?<View style={st.callout} wrap={false}><Text style={st.calloutText}>{n(p.trabalho.verificacoesLote)} verificações analíticas em lote fazem parte dos {n(p.trabalho.registros)} registros analíticos. Não equivalem a atendimentos humanos individualizados.</Text></View>:null}
  {categories.length>0?<View><Text style={st.detailSub}>ATIVIDADES DOCUMENTADAS</Text>{categories.slice(0,8).map(x=><View wrap={false} key={x.categoria} style={st.category}><Text style={st.categoryLabel}>{name(x.categoria)}</Text><Text style={st.categoryNumber}>{n(x.registros)}</Text></View>)}</View>:null}
  {analysis.length>0?<View><Text style={st.detailSub}>ANÁLISES, AUDITORIAS E PROJETOS</Text>{analysis.slice(0,8).map(x=><View wrap={false} key={x.categoria} style={st.category}><Text style={st.categoryLabel}>{name(x.categoria)}</Text><Text style={st.categoryNumber}>{n(x.registros)}</Text></View>)}</View>:null}
  {jobs.length>0?<View><Text style={st.detailSub}>ENTREGAS IDENTIFICADAS</Text>{jobs.slice(0,22).map((x,i)=><View wrap={false} key={i} style={st.work}><Text style={st.workMeta}>{d(x.data)}  /  {name(x.categoria)}</Text><Text style={st.workTitle}>{x.titulo}</Text>{x.detalhe?<Text style={st.workDesc}>{x.detalhe.slice(0,550)}{x.detalhe.length>550?" …":""}</Text>:null}</View>)}
  {jobs.length>22?<Text style={st.micro}>Exibidas 22 de {n(jobs.length)} entregas disponíveis; consulte a lista no sistema.</Text>:null}</View>:null}
  {recent.length>0?<View><Text style={st.detailSub}>HISTÓRICO DESCRITIVO RECENTE</Text>{recent.slice(0,7).map((x,i)=><View wrap={false} key={i} style={st.work}><Text style={st.workMeta}>{d(x.data)}  /  {name(x.categoria)}</Text><Text style={st.workTitle}>{x.titulo}</Text>{x.detalhe?<Text style={st.workDesc}>{x.detalhe.slice(0,500)}{x.detalhe.length>500?" …":""}</Text>:null}{x.protocolo?<Text style={st.micro}>Referência CNJ: {x.protocolo}</Text>:null}</View>)}
  {recent.length>7?<Text style={st.micro}>Exibidos 7 de {n(recent.length)} registros recentes; histórico integral no aplicativo.</Text>:null}</View>:null}
  {!jobs.length&&!recent.length&&!categories.length&&!analysis.length?<Text style={st.micro}>Sem descrições individuais nesta fonte durante o período; os eventos auditados aparecem nos indicadores acima.</Text>:null}
 </View>
}
export function ReportTeamSummaryPdf({data,overview,scope,trend=[]}:{data:EquipeRelatorio;overview:ReportPdfOverview;scope:string;trend?:ReportPdfDay[]}){
 const people=data.pessoas||[],active=people.filter(x=>evidence(x)>0).sort((a,b)=>evidence(b)-evidence(a)),quiet=people.filter(x=>evidence(x)===0),activityOwners=people.filter(x=>(x.atividades.registrosTotal||0)>0);
 const sum=(f:(x:EquipeMembro)=>number)=>people.reduce((a,x)=>a+f(x),0);
 const max=Math.max(1,...active.map(x=>x.atendimentos.eventos));
 return <Document title="LexisPredict - Relatório Gerencial" author="LexisPredict" subject="Diagnóstico executivo da carteira e equipe">
 <Page size="A4" style={st.page} wrap>
  <View style={st.hero}><Text style={st.brand}>L E X I S P R E D I C T    /    R E P O R T</Text><Text style={st.heroTitle}>Relatório executivo</Text><Text style={st.heroSubtitle}>Carteira jurídica, produtividade, movimentações e prioridades gerenciais reunidas em uma leitura visual.</Text><View style={st.heroTags}><View style={st.heroTag}><Text style={st.heroTagText}>{d(data.inicio)} — {d(data.fim)}</Text></View><View style={st.heroTag}><Text style={st.heroTagText}>{scope}</Text></View></View></View>
  <View style={st.body}><Text style={st.eyebrow}>01  /  VISÃO GERAL</Text><Text style={st.title}>Indicadores da operação</Text>
   <View style={st.kpis}>
    <Kpi label="TOTAL NA CARTEIRA" value={overview.total} note="Total cadastral atual" color={K.violet}/>
    <Kpi label="PROCESSOS ATIVOS" value={overview.ativos} note="Estado atual no CRM" color={K.blue}/>
    <Kpi label="ENCERRADOS NO CRM" value={overview.encerrados} note="Não equivale a mérito" color={K.green}/>
    <Kpi label="COM NOVIDADE" value={overview.novidades} note="Status do snapshot" color={K.pink}/>
    <Kpi label="ATENDIDOS NO PERÍODO" value={overview.atendidos} note="Processos distintos" color={K.violet}/>
    <Kpi label="EVENTOS DE ATENDIMENTO" value={overview.eventos} note="Registros auditados" color={K.blue}/>
   </View>
   <View style={st.split}><Trend data={trend}/><Portfolio data={overview}/></View>
   <View style={st.section}><Text style={st.eyebrow}>02  /  PRIORIDADES</Text><Text style={st.title}>O que merece atenção</Text>
    <View style={st.alerts}>
     {[
      {label:"Ativos sem retorno há 30 dias ou mais",value:overview.semRetorno30,color:K.amber},
      {label:"Classificações judiciais a esclarecer",value:overview.meritoPendente,color:K.red},
      {label:"Marcados vencidos no CRM",value:overview.vencidos,color:K.blue}
     ].map(x=><View key={x.label} style={[st.alert,{borderTopColor:x.color}]}><Text style={st.alertLabel}>{x.label}</Text><Text style={[st.alertNumber,{color:x.color}]}>{n(x.value)}</Text></View>)}
    </View>
   </View>
   <View style={st.section}><Text style={st.eyebrow}>03  /  MOVIMENTAÇÕES</Text><Text style={st.title}>Mérito judicial identificado</Text><View style={st.merit}>
    {[["Procedências",overview.procedentes],["Procedências parciais",overview.parciais],["Improcedências",overview.improcedentes],["Sem julgamento de mérito",overview.semMerito]].map(([title,value])=><View key={String(title)} style={st.meritBox}><Text style={st.meritLabel}>{title}</Text><Text style={st.meritNumber}>{n(value as number|null)}</Text></View>)}
   </View></View>
   <View style={st.callout}><Text style={st.calloutText}>Os resultados identificados não confirmam trânsito em julgado nem desfecho de recurso. Encerramento no CRM é administrativo. Atendimentos, projetos e verificações em lote não são somados como ações humanas diferentes.</Text></View>
  </View><Footer/>
 </Page>
 <Page size="A4" style={st.page} wrap>
  <View style={st.topbar}><Text style={st.brand}>L E X I S P R E D I C T    /    E Q U I P E</Text><Text style={st.topbarTitle}>Produtividade e distribuição</Text><Text style={st.topbarSub}>Comparação por executor registrado, não somente por proprietário atual da carteira.</Text></View>
  <View style={st.body}><Text style={st.eyebrow}>04  /  COLABORADORES</Text><Text style={st.title}>Resumo comparativo</Text><View style={st.summaryCards}>
   {[["Pessoas com atividades",activityOwners.length],["Atividades · histórico completo",activityOwners.reduce((s,x)=>s+(x.atividades.registrosTotal||0),0)],["Eventos de atendimento · período",sum(x=>x.atendimentos.eventos)]].map(([title,value])=><View key={String(title)} style={st.summaryCard}><Text style={st.summaryLabel}>{title}</Text><Text style={st.summaryNumber}>{n(value as number)}</Text></View>)}
  </View><Text style={[st.subtitle,{marginTop:15}]}>Carteira = situação atual; atendimentos, edições, encerramentos e atividades = evidências do período. Não some métricas de natureza diferente.</Text>
  <View style={st.table}><View style={[st.tableRow,st.tableHeader]}>
   {["Responsável","Carteira","Atend.","Edições","Encerr.","Ativ. hist."].map((x,i)=><Text key={x} style={i===0?st.nameCell:st.numberCell}>{x}</Text>)}
  </View>{people.map((x,i)=><View wrap={false} key={x.userId||i} style={[st.tableRow,{backgroundColor:i%2===0?"#FFF":K.off}]}>
   <Text style={st.nameCell}>{x.nome}</Text><Text style={st.numberCell}>{n(x.carteira.total)}</Text><Text style={st.numberCell}>{n(x.atendimentos.eventos)}</Text><Text style={st.numberCell}>{n(x.edicoes.processos)}</Text><Text style={st.numberCell}>{n(x.encerramentos.processos)}</Text><Text style={st.numberCell}>{n(x.atividades.registrosTotal)}</Text>
  </View>)}</View>
  <View style={st.compare}><Text style={st.boxTitle}>EVENTOS DE ATENDIMENTO POR EXECUTOR</Text>
   {active.slice(0,8).map((x,i)=><View key={x.userId||i} style={st.compareRow}><Text style={st.compareName}>{x.nome}</Text><View style={st.compareTrack}><View style={{width:100*x.atendimentos.eventos/max+"%",height:9,borderRadius:4,backgroundColor:[K.violet,K.blue,K.pink,K.green][i%4]}}/></View><Text style={st.compareN}>{n(x.atendimentos.eventos)}</Text></View>)}
   {!active.length?<Text style={st.subtitle}>Sem registros individuais disponíveis neste período.</Text>:null}
  </View>
  {quiet.length?<View wrap={false} style={st.quiet}><Text style={st.quietTitle}>Perfis sem registros nas fontes consultadas</Text><Text style={st.subtitle}>{quiet.map(x=>x.nome).join(" • ")}</Text><Text style={[st.subtitle,{marginTop:5}]}>Ficam em resumo, sem ocupar páginas individuais vazias. Ausência de registro não comprova ausência de trabalho.</Text></View>:null}
  <View wrap={false} style={st.callout}><Text style={st.calloutText}>Os eventos são atribuídos ao usuário que registrou cada ação. Registros importados e verificações em lote não são contabilizados como contatos humanos confirmados. Este relatório não usa percentuais de desempenho arbitrários.</Text></View>
  <Text style={[st.subtitle,{marginTop:17}]}>A seguir: detalhamento das pessoas com registros, com datas, títulos, categorias e descrições das entregas disponíveis.</Text>
  </View><Footer/>
 </Page>
 <Page size="A4" style={st.page} wrap>
  <View style={st.topbar}><Text style={st.brand}>L E X I S P R E D I C T    /    E V I D Ê N C I A S</Text><Text style={st.topbarTitle}>Atuação individual</Text><Text style={st.topbarSub}>{d(data.inicio)} a {d(data.fim)} • Descrições e indicadores disponíveis no sistema.</Text></View>
  <View style={st.body}>{active.map(x=><Member key={x.userId} person={x}/>)}
   {!active.length?<Text style={st.subtitle}>Nenhuma atividade individual identificada para o período selecionado.</Text>:null}
   <View style={st.method}><Text style={st.detailSub}>FONTES, CRITÉRIOS E LIMITAÇÕES</Text><Text style={st.micro}>Carteira atual e registros da equipe no Supabase/LexisPredict. As classificações de mérito requerem verificação judicial de recursos, cumprimento e trânsito. Ausência de documento comprobatório não demonstra que não houve pagamento.</Text><Text style={st.micro}>Este é um relatório gerencial do recorte indicado. Para histórico integral e documentação por processo, consulte as telas do LexisPredict. A exportação não envia mensagens e não modifica registros.</Text></View>
  </View><Footer/>
 </Page>
 </Document>;
}