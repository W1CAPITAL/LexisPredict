"use client";
import {useCallback,useEffect,useState} from 'react';
import {Badge} from '@/components/ui/badge';
import {Button} from '@/components/ui/button';
import {useAdmin} from '@/hooks/use-admin';
import {resolveWaAutoPermissions} from '@/lib/wa-auto-permissions';
import {waLocalStatusAction,waLocalProvisionAction} from '@/app/actions/whatsapp-local-actions';
import {Copy,RefreshCw,QrCode,ShieldAlert,Monitor} from 'lucide-react';
type State={provisioned:boolean;online:boolean;connected:boolean;state:string;qr:string|null;phone:string|null;lastSeen:string|null;error:string|null};
export function EvolutionConnectionCard(){
 const {profile}=useAdmin(),canManage=resolveWaAutoPermissions(profile as any).canManage;
 const [info,setInfo]=useState<State|null>(null),[error,setError]=useState('');
 const [token,setToken]=useState<string|null>(null),[busy,setBusy]=useState(false);
 const load=useCallback(async()=>{
   try{
     const r=await waLocalStatusAction();
     if(!r.ok){setError(r.error||'Falha de consulta');return;}
     setError('');setInfo(r);
     window.dispatchEvent(new CustomEvent('lexis-evolution-status',{detail:{ready:r.connected}}));
   }catch{setError('Não foi possível verificar o dispositivo local.');}
 },[]);
 useEffect(()=>{void load();const id=window.setInterval(()=>{
   if(document.visibilityState==='visible')void load();
 },9000);return()=>window.clearInterval(id);},[load]);
 const setup=async()=>{
   if(info?.provisioned&&!window.confirm('Gerar uma nova credencial desconecta o trabalhador antigo até atualizar o arquivo .env. Continuar?'))return;
   setBusy(true);
   try{
     const r=await waLocalProvisionAction();
     if(!r.ok){setError(r.error||'Falha ao gerar credencial');return;}
     setToken(r.token);setError('');
     void load();
   }finally{setBusy(false);}
 };
 const connected=info?.connected===true,connecting=info?.online===true&&!connected;
 return <section className="mx-3 mt-2 rounded-2xl border border-border/60 bg-card p-3 shadow-sm sm:mx-4" aria-label="WhatsApp integrado">
  <div className="flex flex-wrap items-center justify-between gap-3">
   <div className="flex items-center gap-2 min-w-0"><QrCode className="h-5 w-5 text-emerald-600 shrink-0" aria-hidden="true"/>
    <div><div className="flex flex-wrap items-center gap-2"><strong className="text-sm">WhatsApp integrado · WA Local</strong>
      <Badge variant={connected?'default':'outline'}>{connected?'CONECTADO':connecting?'AGUARDANDO QR':'OFFLINE'}</Badge></div>
     <p className="text-xs text-muted-foreground">{connected?'Dispositivo vinculado: '+(info?.phone||'WhatsApp conectado'):
       'Conexão independente de WA.Auto e Evolution, sem mensalidade adicional. Precisa de computador ligado.'}</p></div>
   </div>
   <div className="flex flex-wrap gap-2">
    <Button size="sm" variant="outline" type="button" onClick={()=>void load()}><RefreshCw className="mr-1 h-4 w-4"/>Atualizar</Button>
    {canManage&&<Button size="sm" type="button" disabled={busy} onClick={()=>void setup()}><Monitor className="mr-1 h-4 w-4"/>{info?.provisioned?'Nova credencial':'Conectar dispositivo local'}</Button>}
   </div>
  </div>
  {error&&<p role="alert" className="mt-2 rounded-lg border border-destructive/40 p-2 text-xs text-destructive">{error}</p>}
  {info?.qr&&canManage&&<div className="mt-3 flex flex-wrap items-center gap-4 rounded-xl border border-emerald-500/30 p-3">
    <img alt="QR Code do dispositivo WhatsApp local" src={info.qr} className="h-56 w-56 max-w-full rounded-lg bg-white p-2"/>
    <div className="text-xs space-y-2"><strong>Escaneie no WhatsApp</strong>
      <p>WhatsApp no celular → Aparelhos conectados → Conectar aparelho.</p>
      <p>O QR Code é criado no computador da empresa. Ele será atualizado automaticamente nesta tela.</p>
    </div>
   </div>}
  {canManage&&!connected&&<div className="mt-3 rounded-xl border bg-muted/30 p-3 text-xs space-y-2">
    <strong>Ativação gratuita — primeira vez</strong>
    <p>1. Gere uma credencial neste painel. 2. Baixe a pasta <code>workers/wa-local</code> do repositório. 3. No Windows, execute <code>iniciar-windows.cmd</code> e informe a credencial no arquivo <code>.env</code>. 4. Escaneie o QR nesta tela.</p>
    <a href="https://github.com/W1CAPITAL/LexisPredict/tree/main/workers/wa-local" target="_blank" rel="noopener noreferrer" className="underline text-primary">Abrir instalação gratuita no GitHub</a>
    {token&&<div className="space-y-1">
      <p className="font-semibold">Credencial única — copie agora; ela não será exibida novamente.</p>
      <div className="flex gap-2 flex-wrap items-center">
       <code className="block max-w-full select-all break-all rounded border bg-background p-2">{token}</code>
       <Button type="button" variant="outline" size="sm" onClick={()=>void navigator.clipboard.writeText(token)}><Copy className="mr-1 h-4 w-4"/>Copiar</Button>
      </div>
      <p className="text-amber-800 dark:text-amber-300">Não compartilhe a credencial nem a pasta <code>session</code>. Não cole em conversas públicas.</p>
    </div>}
   </div>}
  {!connected&&!info?.qr&&<p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"><ShieldAlert className="h-4 w-4"/>A conexão permanecerá offline até o programa local iniciar. O CRM não enviará mensagens nesse estado.</p>}
 </section>;
}
