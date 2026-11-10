'use client';
import {FileDown,FileText} from 'lucide-react';
import type {HermesOfficeDailyRow} from '@/lib/hermes-company-service';
import type {HermesCaseHealth} from '@/lib/hermes-company-intelligence';
import type {HermesOfficeEvent} from '@/lib/hermes-agent-route';

const safeCell=(value:unknown)=>{
 const raw=String(value??'').replace(/[\r\n\t]+/g,' ').slice(0,1200);
 // Prevent formula injection when downloaded into Excel/Sheets.
 const neutral=/^\s*[=+@-]/.test(raw)?"'"+raw:raw;
 return '"'+neutral.replace(/"/g,'""')+'"';
};
export function HermesExport({record,cases,events}:{
 record:HermesOfficeDailyRow|null;cases:HermesCaseHealth[];events:HermesOfficeEvent[];
}){
 function downloadCsv(){
  if(!record)return;
  const rows:Array<unknown[]>= [
   ['Tipo','Data/Hora','Setor ou indicador','Descrição','Valor ou status','Referência'],
   ...Object.entries(record.metrics||{}).map(([metric,value])=>
    ['Indicador',record.day,metric,'Consolidação do CRM',value,'']),
   ...events.map(e=>['Evento',e.recorded_at,e.sector,e.title,
    e.status,e.processo_id??'']),
   ...cases.map(c=>['Consulta de processo',c.checkedAt||'',c.client,c.sourceStatus,c.level,c.cnj||'']),
   ['Reunião',record.updated_at,record.meeting_engine||'não executada',
    record.meeting_note||'Nenhuma ata confirmada',record.meeting_status,''],
  ];
  const csv='\uFEFF'+rows.map(row=>row.map(safeCell).join(';')).join('\r\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const link=document.createElement('a');
  link.href=url;link.download='Hermes_Relatorio_'+record.day+'.csv';
  document.body.append(link);link.click();link.remove();
  URL.revokeObjectURL(url);
 }
 return <div className="flex flex-wrap gap-2">
  <a href="/api/report/pdf?escopo=empresa&periodo=mes" target="_blank" rel="noopener noreferrer"
    className="h3d-button" title="PDF consolidado do escritório, com os indicadores e o acompanhamento Hermes">
   <FileText size={16}/> Extrair relatório PDF
  </a>
  <button type="button" className="h3d-button h3d-button-muted" onClick={downloadCsv} disabled={!record}>
    <FileDown size={16}/> Exportar CSV
  </button>
 </div>;
}
