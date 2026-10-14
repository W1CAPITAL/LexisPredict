"use client";
import {useCallback, useEffect, useState} from 'react';
import {Loader2, RefreshCw, QrCode, Smartphone, Wifi, WifiOff, LogOut} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Badge} from '@/components/ui/badge';
import {useAdmin} from '@/hooks/use-admin';
import {resolveWaAutoPermissions} from '@/lib/wa-auto-permissions';
import {useToast} from '@/hooks/use-toast';
import {evolutionConnectionAction,evolutionConnectAction,evolutionPairAction,evolutionLogoutAction,evolutionReadinessAction} from '@/app/actions/whatsapp-actions';

type State = {status?:string;message?:string;qr?:string|null;pairingCode?:string|null};
export function EvolutionConnectionCard(){
  const {profile}=useAdmin();
  const {canManage}=resolveWaAutoPermissions(profile as any);
  const {toast}=useToast();
  const [connection,setConnection]=useState<State|null>(null);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [loading,setLoading]=useState(true);
  const [phone,setPhone]=useState('');
  const [tested,setTested]=useState<string|null>(null);
  const ready=connection?.status==='ready';
  const report=useCallback((online:boolean)=>{
    window.dispatchEvent(new CustomEvent('lexis-evolution-status',{detail:{ready:online}}));
  },[]);
  const refresh=useCallback(async()=>{
    try{
      const res=await evolutionConnectionAction();
      if(!res.success){setError(res.error||'Evolution indisponível');setConnection({status:'offline'});report(false);return;}
      setError('');setConnection(res.connection);report(res.connection?.status==='ready');
    }catch{setError('Não foi possível consultar o servidor Evolution.');report(false);}
    finally{setLoading(false);}
  },[report]);
  useEffect(()=>{
    void refresh();
    const interval=window.setInterval(()=>{if(document.visibilityState==='visible')void refresh();},60000);
    return ()=>window.clearInterval(interval);
  },[refresh]);
  const run=async(op:'connect'|'pair'|'logout')=>{
    setBusy(true);setError('');
    try {
      const res=op==='connect'?await evolutionConnectAction():op==='pair'?await evolutionPairAction(phone):await evolutionLogoutAction();
      if(!res.success){setError(res.error||'Não foi possível conectar a Evolution.');report(false);return;}
      setConnection(res.connection);
      report(res.connection?.status==='ready');
      if(op!=='logout')window.setTimeout(()=>void refresh(),10000);
    }catch{setError('A solicitação de conexão falhou.');}
    finally{setBusy(false);}
  };
  const test=async()=>{
    setBusy(true);
    try{
      const r=await evolutionReadinessAction();
      setTested(r.success?'A instância Evolution está pronta para envio.':'Não está pronta para envio: '+(r.error||'Sem sessão conectada.'));
      if(!r.success)report(false);
    }catch{setTested('A verificação de conexão falhou.');}
    finally{setBusy(false);}
  };
  return <section className="mx-3 mt-2 rounded-2xl border border-border/60 bg-card p-3 shadow-sm sm:mx-4">
    <div className="flex flex-wrap items-center gap-3 justify-between">
      <div className="flex items-center gap-2 min-w-0">
        {ready?<Wifi className="h-4 w-4 text-emerald-600"/>:<WifiOff className="h-4 w-4 text-amber-600"/>}
        <div><div className="flex gap-2 items-center flex-wrap"><strong className="text-sm">Evolution API · WhatsApp</strong><Badge variant={ready?'default':'outline'} className="text-[10px]">{ready?'CONECTADO':loading?'CONSULTANDO':connection?.status==='connecting'?'AGUARDANDO QR':'DESCONECTADO'}</Badge></div>
          <p className="text-xs text-muted-foreground">{connection?.message||'Conexão da empresa via Evolution, sem WA.Auto.'}</p></div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={()=>void refresh()} disabled={busy||loading}>{loading?<Loader2 className="h-4 w-4 animate-spin"/>:<RefreshCw className="h-4 w-4"/>}<span className="ml-1">Atualizar</span></Button>
        {canManage&&<Button type="button" variant="outline" size="sm" onClick={()=>void test()} disabled={busy}>Testar conexão</Button>}
        {ready&&canManage&&<Button type="button" variant="outline" size="sm" onClick={()=>void run('logout')} disabled={busy}><LogOut className="mr-1 h-4 w-4"/>Desconectar</Button>}
      </div>
    </div>
    {error&&<p role="alert" className="mt-3 rounded-xl border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-100">{error}</p>}
    {tested&&<p role="status" className="mt-2 text-xs text-muted-foreground">{tested}</p>}
    {!ready&&canManage&&<div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,300px)_1fr]">
      <div className="space-y-2">
        <Button type="button" className="w-full" disabled={busy} onClick={()=>void run('connect')}>{busy?<Loader2 className="mr-2 h-4 w-4 animate-spin"/>:<QrCode className="mr-2 h-4 w-4"/>}Gerar QR da Evolution</Button>
        <div className="flex gap-2">
          <Input aria-label="Número para pareamento" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="DDD + número" inputMode="tel"/>
          <Button type="button" variant="outline" onClick={()=>void run('pair')} disabled={busy||phone.replace(/\D/g,'').length<10}><Smartphone className="mr-1 h-4 w-4"/>Parear</Button>
        </div>
      </div>
      <div className="flex min-h-[120px] items-center justify-center rounded-xl border border-dashed p-3">
        {connection?.qr?<img src={connection.qr} alt="QR Code Evolution para conectar WhatsApp" className="h-auto w-full max-w-[255px]"/>:
          connection?.pairingCode?<div className="text-center"><p className="text-xs text-muted-foreground">Código de pareamento</p><strong className="text-xl tracking-[.2em]">{connection.pairingCode}</strong></div>:
          <p className="text-center text-xs text-muted-foreground">Gere o QR para conectar o WhatsApp. A sessão é administrada no servidor Evolution configurado.</p>}
      </div>
    </div>}
    {!canManage&&<p className="mt-2 text-xs text-muted-foreground">Somente gestores autorizados podem conectar ou desconectar a instância.</p>}
  </section>;
}
