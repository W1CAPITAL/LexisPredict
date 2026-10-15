"use client";

import {useCallback,useEffect,useState} from 'react';
import {usePathname,useRouter} from 'next/navigation';
import {AlertTriangle,Check,ChevronRight,RefreshCw,WifiOff,X} from 'lucide-react';
import {useAuth} from '@/components/auth/auth-provider';
import {waLocalStatusAction} from '@/app/actions/whatsapp-local-actions';

const DAY=86400000;
type Status=Awaited<ReturnType<typeof waLocalStatusAction>>;
const HIDDEN_PREFIX='lexis-wa-offline-notice-until-v1:';

/** Lightweight, user-scoped heads-up. It does not create synthetic QRs or
 * start a message campaign: only the linked-device service can generate QR.
 */
export function WhatsAppConnectionNotice(){
 const {user,profile}=useAuth();
 const route=usePathname(),router=useRouter();
 const [status,setStatus]=useState<Status|null>(null);
 const [visible,setVisible]=useState(false);
 const [showQr,setShowQr]=useState(false);
 const [quietDay,setQuietDay]=useState(false);
 const [checking,setChecking]=useState(false);
 const uid=String(user?.id||'');
 const tenant=String(profile?.empresa_id||'');
 const key=HIDDEN_PREFIX+tenant+':'+uid;
 const disallowed=!uid||!tenant||tenant==='guest-local'||
  ['/login','/signup','/primeiro-acesso','/setup-empresa','/termos'].includes(route);
 const hidden=useCallback(()=>{
  try{return Number(localStorage.getItem(key)||'0')>Date.now();}
  catch{return false}
 },[key]);
 const refresh=useCallback(async()=>{
  if(disallowed)return;
  setChecking(true);
  try{
   const s=await waLocalStatusAction();
   setStatus(s);
   if(s.ok&&s.connected){setVisible(false);setShowQr(false);return;}
   if(s.ok&&!hidden())setVisible(true);
  }catch{/* Offline state is not a confirmed bridge outage. */}
  finally{setChecking(false)}
 },[disallowed,hidden]);
 useEffect(()=>{
  if(disallowed)return;
  const delay=window.setTimeout(()=>{
   // Wizard and legal acceptance are not obscured by another modal.
   if(document.querySelector('[aria-label="Sua experiência LexisPredict"]'))return;
   void refresh();
  },4000);
  return()=>window.clearTimeout(delay);
 },[disallowed,refresh]);
 useEffect(()=>{
  if(!visible)return;
  const id=window.setInterval(()=>{if(document.visibilityState==='visible')void refresh()},15000);
  return()=>window.clearInterval(id);
 },[visible,refresh]);
 const dismiss=()=>{
  if(quietDay){try{localStorage.setItem(key,String(Date.now()+DAY))}catch{}}
  setVisible(false);
 };
 if(disallowed||!visible||!status?.ok||status.connected)return null;
 const qr=('qr' in status&&typeof status.qr==='string')?status.qr:null;
 const fresh=('qrFresh' in status&&status.qrFresh===true);
 return <div className="fixed inset-0 z-[240] flex items-center justify-center bg-slate-950/55 p-3"
  role="presentation" onClick={e=>{if(e.currentTarget===e.target)dismiss()}}>
  <section role="dialog" aria-modal="true" aria-label="Conectar WhatsApp LexisPredict"
   className="w-full max-w-lg space-y-3 rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-2xl">
   <div className="flex items-start gap-3">
    <span className="rounded-xl bg-amber-500/10 p-2 text-amber-600"><WifiOff className="h-6 w-6"/></span>
    <div className="flex-1">
     <h2 className="text-lg font-bold">WhatsApp desconectado</h2>
     <p className="text-xs text-muted-foreground">O LexisPredict mantém a fila, mas não envia mensagens até a sessão do aparelho estar conectada.</p>
    </div>
    <button type="button" onClick={dismiss} className="rounded-lg p-1 text-muted-foreground hover:bg-muted" aria-label="Fechar aviso">
     <X className="h-5 w-5"/>
    </button>
   </div>
   {showQr?<div className="space-y-2 rounded-xl border border-border p-3 text-center">
    {qr?<img src={qr} alt="QR do WhatsApp recebido do serviço de conexão" className={`mx-auto h-48 w-48 max-w-full rounded-lg bg-white p-2 ${fresh?'':'opacity-55'}`}/>:
     <div className="rounded-lg bg-muted p-5 text-sm">Aguardando QR do servidor de conexão…</div>}
    <p className="text-xs text-muted-foreground">
     {qr&&fresh?'No celular, abra WhatsApp → Aparelhos conectados → Conectar aparelho e escaneie.':
      'O serviço ainda não confirmou um QR válido. Quando recuperar a conexão, o código aparecerá automaticamente.'}
    </p>
    <button type="button" onClick={()=>void refresh()} disabled={checking} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
     <RefreshCw className={`h-4 w-4 ${checking?'animate-spin':''}`}/>Verificar novo código
    </button>
   </div>:null}
   <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
    <input type="checkbox" checked={quietDay} onChange={e=>setQuietDay(e.target.checked)}/>
    Não mostrar este aviso novamente pelas próximas 24 horas
   </label>
   <div className="flex flex-wrap justify-end gap-2">
    <button type="button" onClick={dismiss} className="rounded-xl border border-border px-4 py-2 text-sm font-semibold">Agora não</button>
    <button type="button" onClick={()=>{setShowQr(true);void refresh()}}
     className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">
      Conectar / mostrar QR <ChevronRight className="ml-1 inline h-4 w-4"/>
    </button>
    <button type="button" onClick={()=>{dismiss();router.push('/whatsapp')}}
     className="rounded-xl border border-primary/30 px-4 py-2 text-sm font-semibold text-primary">Abrir terminal</button>
   </div>
  </section>
 </div>;
}
