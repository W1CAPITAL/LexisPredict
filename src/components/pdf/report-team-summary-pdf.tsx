import React from "react";
import {Document,Page,Text,View,StyleSheet} from "@react-pdf/renderer";
import type {EquipeRelatorio,EquipeMembro} from "@/components/report/team-report";

type Snapshot={total:number|null;ativos:number|null;encerrados:number|null;vencidos:number|null;novidades:number|null;
 atendidos:number|null;eventos:number|null;semRetorno30:number|null;meritoPendente:number|null;
 procedentes:number|null;improcedentes:number|null;parciais:number|null;semMerito:number|null};
const navy="#17243F",violet="#6754AF",muted="#5E687A",line="#DDE3EC",soft="#F4F6FB",white="#FFFFFF";
const styles=StyleSheet.create({
 page:{paddingTop:36,paddingBottom:42,paddingHorizontal:38,fontFamily:"Helvetica",color:navy,fontSize:9,lineHeight:1.35},
 eyebrow:{fontSize:8,color:violet,fontWeight:700,letterSpacing:1,marginBottom:7},
 title:{fontSize:22,fontWeight:700,marginBottom:8},
 subtitle:{fontSize:9,color:muted,marginBottom:16},
 stripe:{height:5,backgroundColor:violet,marginBottom:23,borderRadius:2},
 section:{fontWeight:700,fontSize:13,marginTop:14,marginBottom:8},
 kpiLine:{flexDirection:"row",flexWrap:"wrap",gap:8,marginBottom:10},
 kpi:{borderWidth:1,borderColor:line,backgroundColor:soft,padding:10,width:"31.5%",borderRadius:7},
 kpiLabel:{fontSize:7,color:muted,marginBottom:4},
 kpiNum:{fontSize:16,fontWeight:700},
 note:{fontSize:8,color:muted,marginTop:8,marginBottom:10,lineHeight:1.55},
 person:{borderWidth:1,borderColor:line,borderRadius:8,padding:13,marginBottom:12},
 personName:{fontSize:13,fontWeight:700,color:navy,marginBottom:5},
 chipRow:{flexDirection:"row",flexWrap:"wrap",gap:8,marginTop:5,marginBottom:7},
 chip:{backgroundColor:soft,padding:7,borderRadius:4,minWidth:88},
 chipTitle:{fontSize:7,color:muted},
 chipNum:{fontSize:12,fontWeight:700},
 tiny:{fontSize:8,color:muted},
 item:{fontSize:8,marginBottom:5,lineHeight:1.4},
 description:{fontSize:8,marginTop:3,lineHeight:1.45},
 footer:{position:"absolute",left:38,right:38,bottom:20,paddingTop:5,borderTopWidth:1,borderTopColor:line,flexDirection:"row",justifyContent:"space-between"},
 footerText:{fontSize:7,color:muted},
 separator:{borderBottomWidth:1,borderBottomColor:line,marginVertical:10},
});
const n=(v:number|null|undefined)=>v==null?"—":v.toLocaleString("pt-BR");
const d=(v:string)=>v&&v.length===10?v.slice(8,10)+"/"+v.slice(5,7)+"/"+v.slice(0,4):v||"";
const lab=(s:string)=>({
 auditoria_sistemica:"Auditoria sistêmica em lote",auditoria_documental:"Revisão documental",
 triagem_replica_provas:"Réplica e provas",dossie_individual:"Dossiê individual",
 entrega_projeto:"Projeto entregue",investigacao_get:"Investigação GET",
 investigacao_externa:"Investigação externa",atendimento:"Atendimento",analise_processual:"Análise processual",
 } as Record<string,string>)[s]||s.replaceAll("_"," ");
function Footer(){
 return <View style={styles.footer} fixed><Text style={styles.footerText}>LexisPredict · Relatório de equipe · Uso interno</Text>
 <Text style={styles.footerText} render={({pageNumber,totalPages})=>pageNumber+" / "+totalPages}/></View>;
}
function Kpi({title,value}:{title:string;value:number|null}){
 return <View style={styles.kpi}><Text style={styles.kpiLabel}>{title}</Text><Text style={styles.kpiNum}>{n(value)}</Text></View>;
}
function Person({p}:{p:EquipeMembro}){
 const deliveries=p.trabalho.entregasRecentes||[];
 return <View style={styles.person} wrap={false}>
  <Text style={styles.personName}>{p.nome}</Text>
  <Text style={styles.tiny}>Carteira atual: {n(p.carteira.total)} processos ({n(p.carteira.ativos)} ativos e {n(p.carteira.encerrados)} encerrados no CRM)</Text>
  <View style={styles.chipRow}>
   <View style={styles.chip}><Text style={styles.chipTitle}>Processos atendidos</Text><Text style={styles.chipNum}>{n(p.atendimentos.processos)}</Text></View>
   <View style={styles.chip}><Text style={styles.chipTitle}>Eventos de atendimento</Text><Text style={styles.chipNum}>{n(p.atendimentos.eventos)}</Text></View>
   <View style={styles.chip}><Text style={styles.chipTitle}>Processos editados</Text><Text style={styles.chipNum}>{n(p.edicoes.processos)}</Text></View>
   <View style={styles.chip}><Text style={styles.chipTitle}>Encerramentos manuais</Text><Text style={styles.chipNum}>{n(p.encerramentos.processos)}</Text></View>
   <View style={styles.chip}><Text style={styles.chipTitle}>Atividades cadastradas</Text><Text style={styles.chipNum}>{n(p.atividades.registros)}</Text></View>
   <View style={styles.chip}><Text style={styles.chipTitle}>Registros analíticos</Text><Text style={styles.chipNum}>{n(p.trabalho.registros)}</Text></View>
  </View>
  {p.trabalho.verificacoesLote>0?<Text style={styles.note}>Desses registros analíticos, {n(p.trabalho.verificacoesLote)} são verificações em lote, não atendimentos manuais individuais.</Text>:null}
  {(p.atividades.categorias||[]).length?<View>
   <Text style={styles.item}>Tipos de atividades: {p.atividades.categorias.map(x=>lab(x.categoria)+" ("+n(x.registros)+")").join("; ")}</Text>
  </View>:<Text style={styles.item}>Nenhuma atividade descritiva cadastrada no período; os registros do CRM aparecem acima.</Text>}
  {deliveries.length?<View><Text style={[styles.item,{fontWeight:700,marginTop:5}]}>Trabalhos e entregas descritos:</Text>
   {deliveries.slice(0,9).map((x,i)=><Text key={i} style={styles.item}>• {d(x.data)} · {x.titulo}: {(x.detalhe||"").slice(0,160)}</Text>)}
   {deliveries.length>9?<Text style={styles.tiny}>+ {n(deliveries.length-9)} entregas adicionais no detalhamento da página.</Text>:null}
  </View>:null}
 </View>;
}
export function ReportTeamSummaryPdf({data,overview,scope}:{data:EquipeRelatorio;overview:Snapshot;scope:string}){
 const members=data.pessoas||[];
 const sum=(get:(p:EquipeMembro)=>number)=>members.reduce((acc,p)=>acc+get(p),0);
 return <Document title="LexisPredict - Relatório da equipe" author="LexisPredict" subject="Resumo da operação e atividades por responsável">
  <Page size="A4" style={styles.page} wrap>
   <View style={styles.stripe}/>
   <Text style={styles.eyebrow}>LEXISPREDICT / RELATÓRIOS</Text>
   <Text style={styles.title}>Relatório da equipe</Text>
   <Text style={styles.subtitle}>Período: {d(data.inicio)} a {d(data.fim)}  |  Carteira: {scope}  |  Indicadores da carteira consultados no momento da exportação</Text>
   <Text style={styles.section}>Visão geral</Text>
   <View style={styles.kpiLine}>
    <Kpi title="Processos na carteira" value={overview.total}/>
    <Kpi title="Processos ativos" value={overview.ativos}/>
    <Kpi title="Processos encerrados no CRM" value={overview.encerrados}/>
    <Kpi title="Retornos vencidos" value={overview.vencidos}/>
    <Kpi title="Atendidos no período" value={overview.atendidos}/>
    <Kpi title="Eventos registrados" value={overview.eventos}/>
   </View>
   <Text style={styles.section}>Pontos para acompanhar</Text>
   <Text style={styles.description}>Ativos sem retorno recente: {n(overview.semRetorno30)} · Méritos a esclarecer: {n(overview.meritoPendente)} · Novidades: {n(overview.novidades)}</Text>
   <Text style={styles.description}>Movimentos judiciais classificados: {n(overview.procedentes)} procedências; {n(overview.parciais)} procedências parciais; {n(overview.improcedentes)} improcedências; {n(overview.semMerito)} sem julgamento de mérito.</Text>
   <Text style={styles.note}>Classificações judiciais identificadas não confirmam trânsito em julgado. Encerramento no CRM é administrativo. Os totais de atividades, registros analíticos e atendimentos não devem ser somados, pois podem representar trabalho sobre o mesmo processo.</Text>
   <Text style={styles.section}>Atuação da equipe</Text>
   <View style={styles.kpiLine}>
    <Kpi title="Colaboradores listados" value={members.length}/>
    <Kpi title="Atendimentos auditados" value={sum(p=>p.atendimentos.eventos)}/>
    <Kpi title="Atividades cadastradas" value={sum(p=>p.atividades.registros)}/>
   </View>
   {members.map(p=><Person key={p.userId} p={p}/>)}
   <Text style={styles.note}>A atribuição é pelo autor efetivo dos eventos, não pelo responsável atual da carteira. Falta de registro em uma trilha não significa ausência de trabalho. Os projetos e auditorias descritos são registros internos, não comprovação de execução judicial de cada caso.</Text>
   <Footer/>
  </Page>
 </Document>;
}
