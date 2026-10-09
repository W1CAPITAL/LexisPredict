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
} from '@/app/actions/wa-daily-return-actions';
type Dashboard={ok:boolean;settings?:{enabled:boolean;intervalDays:number};due?:number;sentToday?:number;error?:string};
const captions:Record<string,string>={
 not_due:'Próximo retorno ainda não venceu',closed:'Processo encerrado',no_consent:'Sem autorização para WhatsApp',
 blocked:'Contato bloqueado',phone:'Telefone não cadastrado',missing_return:'Sem data de último retorno para comparar',
 no_new_movement:'Nenhuma movimentação posterior ao último retorno: nada enviado',
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
  const r=await one();
  if(!live.current)return;
  if(!r?.ok||!r.processed){stop();return;}
  timer.current=setTimeout(()=>void scanLoop(),45000);
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
   toast({title:r.sent?'Processo comunicado':'Sem comunicado',description:caption(r.reason||r.error),variant:r.ok?'default':'destructive'});
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
   {dash?.ok?<span className="text-muted-foreground">Retornos vencidos: {dash.due||0} · Enviados hoje: {dash.sentToday||0}</span>:null}
  </div>
  <div className="rounded-xl border border-border p-3 space-y-2">
   <p className="text-xs font-semibold">Scanner de retornos · um processo por vez</p>
   <div className="flex flex-wrap gap-2">
    <Button size="sm" disabled={busy||running} onClick={()=>void one()}>Verificar próximo</Button>
    <Button size="sm" disabled={busy||running} onClick={start}>Iniciar varredura</Button>
    <Button size="sm" variant="destructive" disabled={!running} onClick={stop}>Parar scanner</Button>
   </div>
   <p className="text-xs text-muted-foreground">Verificados nesta sessão: {checked}. A varredura manual continua enquanto esta aba permanecer aberta. O scanner da carteira também prepara avisos quando a automação está ativa.</p>
  </div>
  <div className="rounded-xl border border-border p-3 space-y-2">
   <p className="text-xs font-semibold">Verificar apenas um processo</p>
   <div className="flex flex-wrap gap-2"><Input className="max-w-[265px]" placeholder="CNJ do processo" value={cnj} onChange={e=>setCnj(e.target.value)}/>
    <Button size="sm" variant="outline" disabled={busy} onClick={()=>void lookup()}>Conferir movimentação</Button></div>
   {preview?.ok&&<div className="space-y-2 text-xs">
    <p>{caption(preview.reason)} {preview.eventAt&&' · '+new Date(preview.eventAt).toLocaleDateString('pt-BR')}</p>
    {preview.preview&&<p className="whitespace-pre-wrap rounded-xl bg-muted/50 p-3">{preview.preview}</p>}
    <label className="flex items-center gap-2"><Checkbox checked={refresh} onCheckedChange={v=>setRefresh(v===true)}/>
     Consultar DataJud/DJEN antes de decidir (somente para CNJ individual)</label>
    <Button size="sm" disabled={busy||!preview.preview} onClick={()=>void sendOne()}>Verificar e enviar se houver novidade</Button>
   </div>}
  </div>
  {dash&&!dash.ok&&<p role="alert" className="text-xs text-destructive">{dash.error}</p>}
  {last&&<p role="status" className="rounded-lg bg-muted/40 p-2 text-xs">Última verificação: {caption(last.reason||last.error)}{last.nextReturn?' · próximo retorno '+last.nextReturn:''}</p>}
  <p className="text-[11px] text-muted-foreground">Ao ativar, você confirma o consentimento e opt-in contratual dos clientes desta carteira. A fila respeita bloqueios, SAIR, intervalo entre mensagens e um aviso por telefone por dia.</p>
 </section></DialogContent></Dialog></>;
}
