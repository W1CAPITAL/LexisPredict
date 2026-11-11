import React from 'react';
import {Document,Page,View,Text,Font,StyleSheet} from '@react-pdf/renderer';
import type {HermesOfficeDailyRow,HermesPortfolioCaseSummary} from '@/lib/hermes-company-service';
import type {HermesCaseHealth} from '@/lib/hermes-company-intelligence';
import type {HermesPortfolioDiagnostics} from '@/lib/hermes-diagnostics-policy';
import {buildHermesPdfSections} from '@/lib/report/hermes-report-sections';
import {reportDate,reportValue,type ReportSection} from '@/lib/report/visual-report';
import {cleanHermesReportText} from '@/lib/hermes-verified-meeting';

const wine='#53233C',wineDeep='#321526',bronze='#B58B61',ink='#27232A',muted='#50505A',line='#DAD3CD',paper='#FCFBF9',soft='#F7F3EF';
const base=typeof window==='undefined'?process.cwd()+'/public/fonts/report/':window.location.origin+'/fonts/report/';
Font.register({family:'HermesLegal',fonts:[
 {src:base+'Ubuntu-R.ttf',fontWeight:400},
 {src:base+'Ubuntu-B.ttf',fontWeight:700},
]});
const s=StyleSheet.create({
 page:{fontFamily:'HermesLegal',backgroundColor:paper,color:ink,fontSize:9.3,paddingTop:106,paddingBottom:67,paddingHorizontal:46,lineHeight:1.48},
 strip:{position:'absolute',top:0,left:0,right:0,height:9,backgroundColor:wine},
 header:{position:'absolute',top:23,left:46,right:46,borderBottomWidth:1.2,borderBottomColor:bronze,paddingBottom:11},
 brand:{fontSize:16,fontWeight:700,color:wineDeep,letterSpacing:1.1},
 brandSub:{fontSize:8,color:muted,marginTop:3,letterSpacing:.6},
 headerSide:{position:'absolute',top:26,right:0,alignItems:'flex-end'},
 small:{fontSize:7.7,color:muted},
 footer:{position:'absolute',bottom:25,left:46,right:46,borderTopWidth:.7,borderTopColor:line,paddingTop:9,flexDirection:'row',justifyContent:'space-between'},
 footerText:{fontSize:7,color:muted},
 title:{fontSize:22,fontWeight:700,color:wineDeep,lineHeight:1.12,marginTop:9,marginBottom:8},
 lead:{fontSize:10.5,color:muted,lineHeight:1.5,marginBottom:16},
 eyebrow:{fontSize:8,color:wine,fontWeight:700,letterSpacing:1.2},
 section:{marginBottom:15},
 sectionTitle:{fontSize:13,fontWeight:700,color:wineDeep,marginBottom:5},
 sectionLead:{fontSize:8,color:muted,marginBottom:8,lineHeight:1.35},
 accentRule:{height:2,backgroundColor:bronze,width:54,marginBottom:15},
 statGrid:{flexDirection:'row',flexWrap:'wrap',gap:8,marginBottom:10},
 stat:{width:'48%',borderWidth:.8,borderColor:line,borderRadius:5,padding:11,backgroundColor:'#FFF'},
 statName:{fontSize:8,color:muted,marginBottom:3},
 statValue:{fontSize:19,fontWeight:700,color:wineDeep},
 label:{fontSize:8,fontWeight:700,color:wine},
 note:{fontSize:9,color:ink,lineHeight:1.48},
 noteRow:{borderLeftWidth:2,borderLeftColor:bronze,paddingLeft:10,marginBottom:10,paddingVertical:4},
 tableHeader:{flexDirection:'row',backgroundColor:wine,padding:8},
 th:{color:'#FFFFFF',fontWeight:700,fontSize:7.4,lineHeight:1.3},
 row:{flexDirection:'row',borderBottomWidth:.6,borderBottomColor:line,paddingVertical:7,paddingHorizontal:8},
 td:{fontSize:7.7,color:ink,lineHeight:1.3,paddingRight:5},
 callout:{backgroundColor:soft,borderLeftWidth:3,borderLeftColor:bronze,padding:13,marginBottom:14,borderRadius:2},
 confidentiality:{fontSize:8,color:muted,marginTop:6,lineHeight:1.5},
 pageMark:{fontSize:9,color:wine,fontWeight:700,marginBottom:7},
 entry:{padding:10,marginBottom:8,borderWidth:.7,borderColor:line,borderRadius:4,backgroundColor:'#FFF'},
});
const clean=(x:unknown,n=700)=>cleanHermesReportText(x).replace(/\n/g,' ').slice(0,n);
function Letterhead({day}:{day:string}){
 return <>
  <View fixed style={s.strip}/>
  <View fixed style={s.header}>
   <Text style={s.brand}>LEXISPREDICT  /  HERMES</Text>
   <Text style={s.brandSub}>GESTÃO E INTELIGÊNCIA OPERACIONAL JURÍDICA</Text>
   <View style={s.headerSide}><Text style={[s.small,{color:wine,fontWeight:700}]}>RELATÓRIO CONFIDENCIAL</Text><Text style={s.small}>{reportDate(day)}</Text></View>
  </View>
  <View fixed style={s.footer}>
   <Text style={s.footerText}>LEXISPREDICT  ·  RELATÓRIO INTERNO DE GESTÃO  ·  NÃO É PEÇA PROCESSUAL</Text>
   <Text style={s.footerText} render={({pageNumber,totalPages})=>pageNumber+' / '+totalPages}/>
  </View>
 </>;
}
function Body({item}:{item:ReportSection}){
 if(item.kind==='metrics')return <View style={s.statGrid}>{item.metrics.map((m,i)=><View key={i} style={s.stat} wrap={false}>
  <Text style={s.statName}>{clean(m.label,90)}</Text><Text style={s.statValue}>{clean(reportValue(m.value),30)}</Text>
  {m.note?<Text style={s.small}>{clean(m.note,180)}</Text>:null}
 </View>)}</View>;
 if(item.kind==='table'){
  const widths=item.columns.map((_,i)=>i===0?item.columns.length>3?30:40:(item.columns.length>3?70:60)/(item.columns.length-1));
  return <View>
   <View style={s.tableHeader} wrap={false}>{item.columns.map((h,i)=><Text style={[s.th,{width:widths[i]+'%'}]} key={i}>{clean(h,65)}</Text>)}</View>
   {item.rows.map((row,i)=><View style={[s.row,{backgroundColor:i%2?'#F8F5F2':'#FFFFFF'}]} wrap={false} key={i}>
    {row.map((v,j)=><Text key={j} style={[s.td,{width:widths[j]+'%'}]}>{clean(reportValue(v),j===0?120:160)}</Text>)}
   </View>)}
  </View>;
 }
 if(item.kind==='notes')return <View>{item.items.map((v,i)=><View key={i} style={s.noteRow} wrap={false}>
  <Text style={s.note}>{cleanHermesReportText(v)}</Text>
 </View>)}</View>;
 if(item.kind==='records')return <View>{item.records.map((v,i)=><View key={i} style={s.entry} wrap={false}>
  <Text style={s.label}>{clean(v.meta||v.title,170)}</Text>
  <Text style={s.note}>{clean(v.body||v.title,550)}</Text>
  {v.source?<Text style={s.small}>Fonte: {clean(v.source,150)}</Text>:null}
 </View>)}</View>;
 if(item.kind==='people')return <View>{item.people.map((v,i)=><View key={i} style={s.entry} wrap={false}>
  <Text style={s.label}>{clean(v.name,130)}{v.role?' · '+clean(v.role,80):''}</Text>
  {v.metrics.map((m,j)=><Text key={j} style={s.note}>{clean(m.label,70)}: {clean(reportValue(m.value),40)}</Text>)}
 </View>)}</View>;
 return <View>{item.series.map((v,i)=><View key={i} style={s.entry} wrap={false}>
  <Text style={s.label}>{clean(v.label,130)}</Text>
  {v.values.map((n,j)=><Text key={j} style={s.note}>{clean(n.label,100)}: {reportValue(n.value)}</Text>)}
 </View>)}</View>;
}
export function HermesLegalPdf({row,diagnostics,cases=[],portfolioScans=[]}:{
 row:HermesOfficeDailyRow|null;diagnostics:HermesPortfolioDiagnostics|null;cases?:HermesCaseHealth[];portfolioScans?:HermesPortfolioCaseSummary[];
}){
 const day=diagnostics?.day||row?.day||new Date().toISOString().slice(0,10);
 const sections=buildHermesPdfSections(row,cases,diagnostics,portfolioScans);
 const validOverdue=diagnostics?.overdueReturns??row?.metrics?.overdue??0;
 const invalid=diagnostics?.invalidReturnDates??0;
 return <Document title={'Hermes - Relatorio juridico operacional - '+day} author="LexisPredict"
  subject="Relatório jurídico operacional baseado em dados de CRM, DJEN e DataJud">
  <Page size="A4" style={s.page} wrap>
   <Letterhead day={day}/>
   <Text style={s.eyebrow}>GESTÃO DE CARTEIRA  /  DOCUMENTO EXECUTIVO</Text>
   <Text style={s.title}>Relatório de acompanhamento e integridade operacional</Text>
   <View style={s.accentRule}/>
   <Text style={s.lead}>Carteira, retornos e scanner judicial de todos os processos com CNJ. Movimentos DataJud, publicações DJEN, audiências e indícios jurídicos são atribuídos às respectivas fontes. O inteiro teor dos autos deve ser conferido quando necessário.</Text>
   <View style={s.statGrid}>
    {[
     ['Processos abertos',row?.metrics?.active??diagnostics?.active??0],
     ['Retornos vencidos válidos',validOverdue],
     ['Datas de retorno inconsistentes',invalid],
     ['Fontes desatualizadas',diagnostics?.staleSources??row?.metrics?.staleSources??0],
    ].map(([a,v],i)=><View style={s.stat} wrap={false} key={i}>
     <Text style={s.statName}>{a}</Text><Text style={s.statValue}>{String(v)}</Text>
    </View>)}
   </View>
   <View style={s.callout} wrap={false}>
    <Text style={s.label}>ESCOPO E LIMITAÇÃO</Text>
    <Text style={s.confidentiality}>A revisão de fontes é independente do atendimento. O documento não confirma prazo judicial perdido, procedência definitiva ou ausência de movimentação quando alguma fonte estiver indisponível. Datas administrativas inconsistentes não são contabilizadas como retornos vencidos.</Text>
   </View>
   <Text style={s.sectionTitle}>Ata técnica automatizada</Text>
   <Text style={s.sectionLead}>Registro de decisões sugeridas por setores virtuais; não é transcrição de reunião de pessoas. Conteúdo refeito quando os indicadores mudam.</Text>
   {cleanHermesReportText(row?.meeting_note||'Nenhuma síntese registrada.').split('\n').map((line,i)=><View style={s.noteRow} wrap={false} key={i}><Text style={s.note}>{line}</Text></View>)}
  </Page>
  {sections.filter(x=>x.id!=='hermes-meeting').map((item,i)=><Page size="A4" key={item.id} style={s.page} wrap>
   <Letterhead day={day}/>
   <Text style={s.pageMark}>APÊNDICE TÉCNICO  {String(i+1).padStart(2,'0')}</Text>
   <View style={s.section}>
    <Text style={s.sectionTitle}>{clean(item.title,200)}</Text>
    {item.subtitle?<Text style={s.sectionLead}>{clean(item.subtitle,600)}</Text>:null}
    <View style={s.accentRule}/>
    <Body item={item}/>
   </View>
  </Page>)}
 </Document>;
}
