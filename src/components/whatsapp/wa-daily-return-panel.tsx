"use client";
import {useEffect,useRef,useState} from 'react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Checkbox} from '@/components/ui/checkbox';
import {useToast} from '@/hooks/use-toast';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {useAdmin} from '@/hooks/use-admin';
import {
 getWaDailyReturnDashboardAction,saveWaDailyReturnSettingsAction,
 previewWaReturnCnjAction,scanOneWaReturnAction,scanNextWaReturnAction,
 scanWaReturnBatchAction,
} from '@/app/actions/wa-daily-return-actions';
type QueueCase={id:number;cnj:string;cliente?:string|null;proximo_retorno:string;verified_at?:string};
type ClosureReview={id:number;cnj:string;review_priority:string;court_flag_reason?:string|null;last_court_event?:string|null};
type DueQueue={dueTotal:number;missingPhone:number;alreadyClosed:number;awaitingWhatsApp:number;needsSourceCheck:number;closureReview:number;oldClosureReview:number};
type Dashboard={ok:boolean;settings?:{enabled:boolean;intervalDays:number;sendAnytime?:boolean};due?:number;sentToday?:number;readyToday?:number;reusedToday?:number;queuedToday?:number;deviceQueued?:number;campaignWaiting?:number;pausedWaiting?:number;courtUnavailable?:number;needsReview?:number;dueQueue?:DueQueue;dueItems?:{ready:QueueCase[];closureReview:ClosureReview[]};error?:string};
const captions:Record<string,string>={
 not_due:'Próximo retorno ainda não venceu',closed:'Processo encerrado',no_consent:'Sem autorização para WhatsApp',court_unavailable:'Tribunais indisponíveis nesta tentativa; sem envio',checked_for_queue:'Conferência preparada na nuvem; nenhum envio realizado',
 blocked:'Contato bloqueado',phone:'Telefone não cadastrado',missing_return:'Sem data de último retorno para comparar',
 no_new_movement:'Nenhuma movimentação posterior ao último retorno: nada enviado',
 recent_scan_no_new_movement:'Verificação recente reaproveitada: sem novidade, sem nova consulta nem envio',
 ready_for_notice:'Movimentação comprovada; aguardando sua vez no envio automático',
 queued_for_send:'Comunicado na fila do WhatsApp; aguardando aceite do dispositivo',
 bridge_offline:'WhatsApp desconectado; será tentado quando reconectar',
 automation_disabled:'Automação desligada: comunicado não enviado',
 needs_source_review:'Teor oficial, descrição ou situação atual precisam de conferência: nada enviado',
 invalid_cnj:'CNJ inválido',outside_service_window:'Sem conversa aberta nas últimas 24 horas; exige template oficial aprovado',
 opt_out:'Cliente solicitou não receber avisos',already_contacted_today:'Cliente já recebeu comunicado hoje',
 send_rejected:'WA.Auto rejeitou o envio; confira a conexão',
 sent:'Aviso aceito e retornos atualizados',send_uncertain:'Resultado da entrega incerto; verificar conversa antes de reenviar',
 history_unavailable:'Histórico do WhatsApp indisponível',sent_history_unsaved:'Mensagem aceita, mas histórico indisponível: revisar',
 sent_dates_review:'Mensagem aceita; atualização de datas exige revisão',no_due_cases:'Nenhum retorno vencido não conferido hoje',
};
function caption(raw:unknown){const v=String(raw||'');return captions[v]||v;}
export function WaDailyReturnPanel(){
 const {isViewer}=useAdmin(),{toast}=useToast();
 const [open,setOpen]=useState(false);
 const [dash,setDash]=useState<Dashboard|null>(null);
 const [enabled,setEnabled]=useState(false),[interval,setIntervalDays]=useState(1);
 const [cnj,setCnj]=useState(''),[preview,setPreview]=useState<any>(null);
 const [busy,setBusy]=useState(false),[running,setRunning]=useState(false);
 const [last,setLast]=useState<any>(null),[checked,setChecked]=useState(0);
 const [refresh,setRefresh]=useState(true);
 const live=useRef(false),timer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const load=async()=>{
  const r=await getWaDailyReturnDashboardAction();setDash(r);
  if(r.ok&&r.settings){setEnabled(r.settings.enabled);setIntervalDays(r.settings.intervalDays);}
 };
 useEffect(()=>{if(!isViewer&&open)void load();return()=>{live.current=false;if(timer.current)clearTimeout(timer.current);};},[isViewer,open]);
 const save=async(value=enabled)=>{
  setBusy(true);
  try{
   const r=await saveWaDailyReturnSettingsAction(value,interval);
   if(!r.ok)throw new Error(r.error);
   setEnabled(value);toast({title:value?'Retornos diários ativados':'Retornos diários pausados'});
   await load();
  }catch(e:any){toast({title:'Não foi possível salvar',description:String(e?.message||e),variant:'destructive'});}
  finally{setBusy(false);}
 };
 const one=async()=>{
  setBusy(true);
  try{
   const r:any=await scanNextWaReturnAction();setLast(r);setChecked(n=>n+(r.processed?1:0));
   if(!r.ok&&r.error)toast({title:'Scanner',description:r.error,variant:'destructive'});
   await load();return r;
  }catch(e:any){const r={ok:false,error:String(e?.message||e)};setLast(r);return r;}
  finally{setBusy(false);}
 };
 const stop=()=>{live.current=false;setRunning(false);if(timer.current)clearTimeout(timer.current);};
 const scanLoop=async()=>{
  if(!live.current)return;
  setBusy(true);
  try{
   // Uma chamada confere até seis processos na nuvem; sem 45s de pausa entre eles.
   const r=await scanWaReturnBatchAction();
   if(!live.current)return;
   if('last' in r && r.last)setLast(r.last);
   setChecked(n=>n+Number(r.processedCount||0));
   if(!r.ok||r.finished||!r.processed){
     if(!r.ok)toast({title:'Scanner',description:r.error||'Não foi possível prosseguir',variant:'destructive'});
     stop();await load();return;
   }
   await load();
   timer.current=setTimeout(()=>void scanLoop(),700);
  }catch(e:any){
   if(live.current)toast({title:'Scanner interrompido',description:String(e?.message||e),variant:'destructive'});
   stop();
  }finally{setBusy(false);}
 };
 const start=()=>{if(live.current)return;live.current=true;setRunning(true);void scanLoop();};
 const lookup=async()=>{
  setBusy(true);setPreview(null);
  try{const r=await previewWaReturnCnjAction(cnj);setPreview(r);
   if(!r.ok)toast({title:'CNJ',description:r.error,variant:'destructive'});
  }finally{setBusy(false);}
 };
 const sendOne=async()=>{
  if(!preview?.ok||!preview?.processId)return;
  setBusy(true);
  try{
   const r=await scanOneWaReturnAction(preview.processId,refresh);setLast(r);
   toast({title:r.sent?'Processo comunicado':'Sem comunicado',description:caption(('reason' in r ? r.reason : r.error) || ('error' in r ? r.error : null)),variant:r.ok?'default':'destructive'});
   await lookup();await load();
  }finally{setBusy(false);}
 };
 if(isViewer)return null;
 return <>
  <Button size="sm" variant="outline" className="h-9 rounded-xl text-[10px] font-bold uppercase" onClick={()=>setOpen(true)}>Retorno inteligente</Button>
  <Dialog open={open} onOpenChange={value=>{setOpen(value);if(!value)stop();}}>
   <DialogContent className="max-w-2xl max-h-[85dvh] overflow-y-auto overscroll-contain rounded-2xl">
    <DialogHeader><DialogTitle>Retorno inteligente da carteira</DialogTitle>
     <DialogDescription>Processos abertos com novidade posterior ao último retorno, de todos os responsáveis da empresa.</DialogDescription></DialogHeader>
  <section className="rounded-2xl border border-border bg-card p-4 space-y-3">
  <div className="flex flex-wrap items-center justify-between gap-3">
   <div><h3 className="font-semibold text-sm">Retorno inteligente · 1 comunicado por dia</h3>
    <p className="text-xs text-muted-foreground">Compara DataJud/DJEN com o último retorno. Sem movimento novo, não envia e não altera as datas.</p></div>
   <div className="flex items-center gap-2 text-xs"><Checkbox checked={enabled} disabled={busy}
     onCheckedChange={v=>void save(v===true)}/><span>Automação {enabled?'ativa':'desligada'}</span></div>
  </div>
  <div className="flex flex-wrap gap-3 items-center text-xs">
   <label className="flex gap-2 items-center">Próximo retorno após envio
    <select className="rounded-md border bg-background p-2" value={interval} disabled={busy}
     onChange={e=>setIntervalDays(Number(e.target.value))}>
     {[1,3,7,14,30].map(n=><option key={n} value={n}>{n} dia{n>1?'s':''}</option>)}
    </select></label>
   <Button size="sm" variant="outline" onClick={()=>void save()} disabled={busy}>Salvar periodicidade</Button>
  </div>
  {dash?.ok?(
   <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
    {([
     ['Retornos vencidos (bruto)',dash.due||0],
     ['Novidades verificadas',dash.readyToday||0],
     ['Campanha ativa aguardando',dash.campaignWaiting||0],
     ['Campanhas pausadas',dash.pausedWaiting||0],
     ['Fila do dispositivo',dash.deviceQueued||0],
     ['Enviados hoje',dash.sentToday||0],
    ] as [string,number][]).map(([label,value])=>(
     <div key={label} className="rounded-xl border bg-muted/30 p-2.5">
      <div className="text-muted-foreground">{label}</div>
      <strong className="text-lg tabular-nums">{value}</strong>
     </div>
    ))}
    <p className="col-span-2 text-muted-foreground sm:col-span-3">
     {dash.courtUnavailable||0} sem consulta aos tribunais nesta tentativa · {dash.needsReview||0} exigem conferência · {dash.reusedToday||0} verificações reaproveitadas.
     Os mesmos processos podem aparecer em «novidades verificadas» e «campanha aguardando»; não some os indicadores.
    </p>
    <p className="col-span-2 rounded-lg border px-2.5 py-2 text-muted-foreground sm:col-span-3">
     O scanner pode preparar novas verificações na nuvem sem esta página aberta.
     {dash.settings?.sendAnytime
      ? 'Sua empresa autorizou envio sequencial automático, inclusive à noite, com intervalo de segurança, limite diário e bloqueios por contato.'
      : 'O envio ocorre de segunda a sexta, das 9h às 18h (horário de São Paulo). Fora dessa janela, os avisos permanecem preparados.'}
     A fila do dispositivo exibe somente os trabalhos entregues ao worker, não toda a campanha pendente.
     Apenas o aceite confirmado pelo dispositivo atualiza «Enviados hoje».
    </p>
   </div>
  ):null}
  {dash?.ok&&dash.dueQueue?(
   <section className="rounded-xl border border-border p-3 space-y-3" aria-label="Fila de vencidos e casos sem telefone">
    <div className="flex flex-wrap items-center justify-between gap-2">
     <strong className="text-sm">Fila de retornos vencidos</strong>
     <span className="text-[11px] text-muted-foreground">Preparação na nuvem · não significa envio concluído</span>
    </div>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
     {([
      ['Preparados para envio',dash.dueQueue.awaitingWhatsApp],
      ['Sem telefone válido',dash.dueQueue.missingPhone],
      ['Falta conferência oficial',dash.dueQueue.needsSourceCheck],
      ['Já encerrados',dash.dueQueue.alreadyClosed],
      ['Encerramento a revisar',dash.dueQueue.closureReview],
      ['Antigos (+1 ano)',dash.dueQueue.oldClosureReview],
     ] as [string,number][]).map(([title,n])=>(
      <div key={title} className="rounded-lg border border-border bg-muted/30 px-3 py-2">
       <div className="text-[11px] text-muted-foreground">{title}</div>
       <strong className="text-lg tabular-nums">{n}</strong>
      </div>
     ))}
    </div>
    <p className="text-xs text-muted-foreground">
     Os avisos preparados ficam registrados na fila persistente do servidor.
     A fila do dispositivo é separada: só recebe um trabalho quando há WhatsApp conectado
     e chega sua vez, respeitando intervalo, consentimento e bloqueios.
     Processos sem telefone não serão marcados como atendidos.
    </p>
    <details className="rounded-lg border border-border p-2.5">
     <summary className="cursor-pointer text-xs font-semibold">Ver próximos processos preparados</summary>
     <div className="mt-2 max-h-48 space-y-1 overflow-y-auto text-xs">
      {(dash.dueItems?.ready||[]).map(item=>(
       <div key={item.id} className="rounded-md bg-muted/40 px-2 py-1.5">
        <span className="font-semibold">{item.cnj||'CNJ indisponível'}</span>
        <span className="ml-2 text-muted-foreground">{item.cliente||'Cliente sem nome'} · retorno vencido em {item.proximo_retorno}</span>
       </div>
      ))}
      {!dash.dueItems?.ready?.length?<span className="text-muted-foreground">Nenhum caso pronto nesta consulta.</span>:null}
     </div>
     <p className="mt-2 text-[11px] text-muted-foreground">Exibindo até 15 registros; o servidor conserva os demais.</p>
    </details>
    {Number(dash.dueQueue.closureReview)>0?(
     <details className="rounded-lg border border-border p-2.5">
      <summary className="cursor-pointer text-xs font-semibold">Ver encerramentos que exigem confirmação oficial</summary>
      <div className="mt-2 max-h-48 space-y-1.5 overflow-y-auto text-xs">
       {(dash.dueItems?.closureReview||[]).map(item=>(
        <div key={item.id} className="rounded-md bg-muted/40 px-2 py-1.5">
         <div className="font-semibold">{item.cnj}</div>
         <div className="text-muted-foreground">
          {item.review_priority==='old_over_365_days'?'Movimentação com mais de 1 ano':item.review_priority==='old_over_180_days'?'Movimentação entre 6 e 12 meses':'Encerramento não confirmado'}
          {item.last_court_event?' · registro de '+item.last_court_event:''}
         </div>
         <div className="text-muted-foreground">Registro anterior: {item.court_flag_reason||'motivo não documentado'}. Aguardando validação das fontes oficiais.</div>
        </div>
       ))}
      </div>
     </details>
    ):null}
   </section>
  ):null}
  <div className="rounded-xl border border-border p-3 space-y-2">
   <p className="text-xs font-semibold">Scanner de retornos · lotes rápidos na nuvem</p>
   <div className="flex flex-wrap gap-2">
    <Button size="sm" disabled={busy||running} onClick={()=>void one()}>Verificar próximo</Button>
    <Button size="sm" disabled={busy||running} onClick={start}>Iniciar varredura</Button>
    <Button size="sm" variant="destructive" disabled={!running} onClick={stop}>Parar scanner</Button>
   </div>
   <p className="text-xs text-muted-foreground">Verificados nesta sessão: {checked}. O servidor confere lotes de até 6 processos e prioriza novidades já verificadas no DJEN/DataJud. Quando as duas fontes foram consultadas com sucesso nas últimas 6h e não há novidade, reaproveita o resultado sem novas consultas. Caso precise buscar, consulta DJEN primeiro e DataJud apenas se necessário. Os vencidos exibidos acima ainda incluem casos descartados pelos filtros. Nenhuma data de retorno muda sem envio confirmado.</p>
  </div>
  <div className="rounded-xl border border-border p-3 space-y-2">
   <p className="text-xs font-semibold">Verificar apenas um processo</p>
   <div className="flex flex-wrap gap-2"><Input className="max-w-[265px]" placeholder="CNJ do processo" value={cnj} onChange={e=>setCnj(e.target.value)}/>
    <Button size="sm" variant="outline" disabled={busy} onClick={()=>void lookup()}>Conferir movimentação</Button></div>
   {preview?.ok&&<div className="space-y-2 text-xs">
    <p>{caption(preview.reason)} {preview.eventAt&&' · '+new Date(preview.eventAt).toLocaleDateString('pt-BR')}</p>
    {preview.preview&&<p className="whitespace-pre-wrap rounded-xl bg-muted/50 p-3">{preview.preview}</p>}
    <label className="flex items-center gap-2"><Checkbox checked={refresh} onCheckedChange={v=>setRefresh(v===true)}/>
     Atualizar DJEN primeiro; consultar DataJud somente se necessário</label>
    <Button size="sm" disabled={busy||!preview.preview} onClick={()=>void sendOne()}>Verificar e enviar se houver novidade</Button>
   </div>}
  </div>
  {dash&&!dash.ok&&<p role="alert" className="text-xs text-destructive">{dash.error}</p>}
  {last&&<p role="status" className="rounded-lg bg-muted/40 p-2 text-xs">Última verificação: {caption(last.reason||last.error)}{last.nextReturn?' · próximo retorno '+last.nextReturn:''}</p>}
  <p className="text-[11px] text-muted-foreground">Ao ativar, você confirma o consentimento e opt-in contratual dos clientes desta carteira. A fila respeita bloqueios, SAIR, intervalo entre mensagens e um aviso por telefone por dia.</p>
 </section></DialogContent></Dialog></>;
}
