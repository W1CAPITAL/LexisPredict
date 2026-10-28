'use client';
import React,{useCallback,useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import { listJurisTimesheetAction, saveJurisTimeAction, deleteJurisTimeAction, type JurisTimeEntry } from '@/app/actions/jurispanel-actions';
import { Clock3, Download, Play, Save, Trash2, Square, RefreshCcw } from 'lucide-react';

const TIMER_KEY='lexis_jurispanel_timer_start_v1';
const fmt=(s:number)=>[Math.floor(s/3600),Math.floor(s%3600/60),s%60].map(x=>String(x).padStart(2,'0')).join(':');
function cell(raw:unknown) {
 const s=String(raw??'');
 const safe=/^[=+\-@\t\r]/.test(s)? "'"+s:s;
 return '"'+safe.replace(/"/g,'""')+'"';
}
export function JurisTimesheetIntegrado(){
 const [rows,setRows]=useState<JurisTimeEntry[]>([]);
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 const [title,setTitle]=useState('');
 const [cnj,setCnj]=useState('');
 const [desc,setDesc]=useState('');
 const [billable,setBillable]=useState(false);
 const [minutes,setMinutes]=useState('30');
 const [started,setStarted]=useState<number|null>(null);
 const [now,setNow]=useState(Date.now());
 const load=useCallback(async()=>{
  setLoading(true);
  const res=await listJurisTimesheetAction();
  if(res.success)setRows(res.rows);
  else setMessage(res.error||'Não foi possível carregar');
  setLoading(false);
 },[]);
 useEffect(()=>{
  void load();
  try{
   const value=Number(localStorage.getItem(TIMER_KEY));
   if(Number.isFinite(value)&&value>0&&value<=Date.now()&&Date.now()-value<=86400000)setStarted(value);
  }catch{}
  const timer=setInterval(()=>setNow(Date.now()),1000);
  return ()=>clearInterval(timer);
 },[load]);
 const elapsed=started===null?0:Math.max(0,Math.floor((now-started)/1000));
 const total=useMemo(()=>rows.reduce((acc,x)=>acc+Number(x.duracao_segundos||0),0),[rows]);
 const start=()=>{
  const n=Date.now();setNow(n);setStarted(n);setMessage('');
  try{localStorage.setItem(TIMER_KEY,String(n));}catch{}
 };
 const stop=()=>{setStarted(null);try{localStorage.removeItem(TIMER_KEY);}catch{}};
 const save=async(mode:'timer'|'manual')=>{
  if(title.trim().length<3){setMessage('Informe uma descrição do trabalho com pelo menos 3 caracteres.');return;}
  const end=Date.now();
  const from=mode==='timer'?started: end-Math.round(Number(minutes)*60000);
  if(from===null||!Number.isFinite(from)||from>=end||end-from>86400000){
   setMessage('Tempo inválido. O máximo por registro é 24 horas.');return;
  }
  setBusy(true);setMessage('');
  const res=await saveJurisTimeAction({
   titulo:title,descricao:desc,cnj,inicioEm:new Date(from).toISOString(),fimEm:new Date(end).toISOString(),faturavel:billable
  });
  setBusy(false);
  if(!res.success){setMessage(res.error||'Falha ao salvar');return;}
  if(mode==='timer')stop();
  setTitle('');setDesc('');setCnj('');setBillable(false);setMessage('Tempo registrado no Supabase.');
  void load();
 };
 const remove=async(id:string)=>{
  if(!window.confirm('Excluir este registro de horas?'))return;
  const res=await deleteJurisTimeAction(id);
  if(!res.success){setMessage(res.error||'Falha ao excluir');return;}
  setMessage('Registro removido.');void load();
 };
 const exportCsv=()=>{
  const header=['Data','Atividade','CNJ','Descrição','Segundos','Horas','Faturável'];
  const data=rows.map(x=>[x.inicio_em.slice(0,10),x.titulo,x.protocolo_ref||'',x.descricao,x.duracao_segundos,(x.duracao_segundos/3600).toFixed(2),x.faturavel?'Sim':'Não']);
  const csv='\uFEFF'+[header,...data].map(line=>line.map(cell).join(';')).join('\r\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download='lexispredict-timesheet.csv';a.click();
  URL.revokeObjectURL(url);
 };
 return <div className="space-y-6 rounded-xl border border-border bg-card p-4 text-foreground sm:p-6">
   <div className="flex flex-wrap items-center justify-between gap-3">
    <div><h2 className="mt-2 text-xl font-extrabold">Registro de tempo de trabalho</h2><p className="mt-1 text-sm text-muted-foreground">Registro real por usuário e CNJ; não cria honorários automaticamente.</p></div>
    <button onClick={exportCsv} disabled={rows.length===0} className="flex gap-2 rounded-lg border px-4 py-2 text-sm disabled:opacity-40"><Download size={17}/> Exportar CSV</button>
   </div>
   <div className="grid gap-4 md:grid-cols-3">
    <section className="rounded-xl border bg-card p-5"><p className="text-xs text-muted-foreground">Tempo registrado (últimos 250)</p><strong className="mt-2 block text-3xl">{fmt(total)}</strong></section>
    <section className="rounded-xl border bg-card p-5"><p className="text-xs text-muted-foreground">Registros</p><strong className="mt-2 block text-3xl">{rows.length}</strong></section>
    <section className="rounded-xl border bg-card p-5"><p className="text-xs text-muted-foreground">Cronômetro</p><strong className="mt-2 block font-mono text-3xl">{fmt(elapsed)}</strong></section>
   </div>
   <section className="rounded-xl border bg-card p-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-bold">Registrar trabalho realizado</h2>
     {!started?<button className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground" onClick={start}><Play size={16}/> Iniciar</button>
     :<button className="flex items-center gap-2 rounded-lg border px-4 py-2" onClick={stop}><Square size={16}/> Descartar cronômetro</button>}
    </div>
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
     <label className="text-sm">Atividade *<input value={title} onChange={e=>setTitle(e.target.value)} maxLength={180} placeholder="Análise do processo, reunião..." className="mt-1 w-full rounded-md border bg-background p-3"/></label>
     <label className="text-sm">Número CNJ cadastrado (opcional)<input value={cnj} onChange={e=>setCnj(e.target.value)} placeholder="0000000-00.2026.8.26.0000" className="mt-1 w-full rounded-md border bg-background p-3"/></label>
     <label className="text-sm sm:col-span-2">Descrição<textarea value={desc} onChange={e=>setDesc(e.target.value)} maxLength={4000} rows={3} className="mt-1 w-full rounded-md border bg-background p-3"/></label>
     <label className="text-sm">Duração manual (minutos)<input type="number" min="1" max="1440" step="1" value={minutes} onChange={e=>setMinutes(e.target.value)} className="mt-1 w-full rounded-md border bg-background p-3"/></label>
     <label className="flex items-center gap-2 pt-6 text-sm"><input type="checkbox" checked={billable} onChange={e=>setBillable(e.target.checked)}/> Marcado como faturável (sem cobrança automática)</label>
    </div>
    <div className="mt-4 flex flex-wrap gap-3">
     <button disabled={busy||!started||elapsed<1} onClick={()=>save('timer')} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-3 font-bold text-primary-foreground disabled:opacity-50"><Clock3 size={17}/> Salvar {fmt(elapsed)} do cronômetro</button>
     <button disabled={busy} onClick={()=>save('manual')} className="flex items-center gap-2 rounded-lg border px-4 py-3 font-semibold disabled:opacity-50"><Save size={17}/> Salvar tempo manual</button>
    </div>
    {message?<p role="status" className="mt-3 text-sm text-primary">{message}</p>:null}
   </section>
   <section className="rounded-xl border bg-card p-5">
    <div className="mb-3 flex items-center justify-between"><h2 className="font-bold">Meus lançamentos</h2><button onClick={()=>void load()} aria-label="Atualizar" className="rounded p-2"><RefreshCcw size={16}/></button></div>
    {loading?<p>Carregando...</p>:rows.length===0?<p className="text-sm text-muted-foreground">Sem lançamentos ainda.</p>:
     <div className="space-y-3">{rows.map(row=><article key={row.id} className="flex items-start justify-between gap-4 rounded-lg border p-3">
      <div className="min-w-0"><h3 className="font-semibold">{row.titulo}</h3><p className="text-xs text-muted-foreground">{new Date(row.inicio_em).toLocaleString('pt-BR')} • {fmt(row.duracao_segundos)} • {row.faturavel?'Faturável':'Interno'}</p>
       {row.protocolo_ref?<Link className="mt-1 block font-mono text-xs text-primary underline" href="/processos">{row.protocolo_ref}</Link>:null}
       {row.descricao?<p className="mt-2 whitespace-pre-wrap text-sm">{row.descricao}</p>:null}
      </div><button onClick={()=>void remove(row.id)} title="Excluir" className="rounded p-2 text-red-600"><Trash2 size={17}/></button>
     </article>)}</div>}
   </section>
   <p className="text-xs text-muted-foreground">O cronômetro funciona enquanto o navegador está aberto. Pode ser retomado após atualizar a aba no mesmo navegador; não constitui monitoramento 24h nem prova de tempo efetivamente trabalhado.</p>
 </div>;
}

/** O histórico de atividades continua sendo a página principal; o cronômetro só monta quando solicitado. */
export function JurisTimesheetSection() {
  const [expanded, setExpanded] = useState(false);
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <button type="button" onClick={() => setExpanded(value => !value)} aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-3 text-left">
        <span><strong className="block text-lg">Cronômetro e controle de horas</strong>
        <span className="mt-1 block text-sm text-muted-foreground">Registre a duração das suas atividades e vincule à carteira, sem abrir outra aba.</span></span>
        <span className="shrink-0 rounded-lg border px-3 py-2 text-sm">{expanded ? 'Recolher' : 'Abrir'}</span>
      </button>
      {expanded ? <div className="mt-5"><JurisTimesheetIntegrado /></div> : null}
    </section>
  );
}
