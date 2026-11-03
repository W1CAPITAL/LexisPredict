"use client";
import {useCallback,useEffect,useRef,useState} from 'react';
import {Wifi,WifiOff,RefreshCw,AlertCircle} from 'lucide-react';
import {Badge} from '@/components/ui/badge';
import {Button} from '@/components/ui/button';
import {waLocalStatusAction,waLocalRequestFreshQrAction} from '@/app/actions/whatsapp-local-actions';

type State={state:string;connected:boolean;online:boolean;provisioned:boolean;
  qr:string|null;qrFresh?:boolean;qrStale?:boolean;qrRefreshPending?:boolean;qrGeneratedAt?:string|null;connectionState?:string;phone:string|null;error:string|null;lastSeen:string|null};
export function EvolutionConnectionCard(){
  const [bridge,setBridge]=useState<State|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [showQr,setShowQr]=useState(true);
  const [requesting,setRequesting]=useState(false);
  const [requestNote,setRequestNote]=useState('');
  const [refreshing,setRefreshing]=useState(false);
  const [lastCheckedAt,setLastCheckedAt]=useState('');
  const refreshInFlight=useRef(false);
  const requestVersion=useRef(0);
  const reportedReady=useRef<boolean|null>(null);

  // Status is a live fact, not a sticky success from a previous polling cycle.
  // Keep only one in-flight request; ignore responses from an unmounted screen.
  const refresh=useCallback(async()=>{
    if(refreshInFlight.current)return;
    refreshInFlight.current=true;
    const version=++requestVersion.current;
    setRefreshing(true);
    const report=(connected:boolean)=>{
      if(reportedReady.current===connected)return;
      reportedReady.current=connected;
      window.dispatchEvent(new CustomEvent('lexis-evolution-status',{detail:{ready:connected}}));
    };
    try{
      const result=await waLocalStatusAction();
      if(version!==requestVersion.current)return;
      if(!result.ok){
        setBridge(null);
        setLastCheckedAt('');
        setError(result.error||'Não foi possível consultar o WA.Auto.');
        report(false);
        return;
      }
      setBridge(result);
      setError('');
      setLastCheckedAt(new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit',second:'2-digit'}));
      report(result.connected===true);
    }catch{
      if(version!==requestVersion.current)return;
      setBridge(null);
      setLastCheckedAt('');
      setError('Falha ao consultar a conexão WhatsApp.');
      report(false);
    }finally{
      if(version===requestVersion.current){
        refreshInFlight.current=false;
        setRefreshing(false);
        setLoading(false);
      }
    }
  },[]);
  useEffect(()=>{
    void refresh();
    const onVisible=()=>{if(document.visibilityState==='visible')void refresh();};
    const id=window.setInterval(onVisible,12000);
    document.addEventListener('visibilitychange',onVisible);
    window.addEventListener('focus',onVisible);
    return ()=>{
      window.clearInterval(id);
      document.removeEventListener('visibilitychange',onVisible);
      window.removeEventListener('focus',onVisible);
      requestVersion.current++;
      refreshInFlight.current=false;
    };
  },[refresh]);
  const requestNewQr=async()=>{
    setRequesting(true);setRequestNote('');
    try{
      const response=await waLocalRequestFreshQrAction();
      setRequestNote(response.ok?'Pedido enviado. Aguarde um QR realmente novo aparecer.':(response.error||'Falha ao solicitar QR.'));
      await refresh();
    }catch{setRequestNote('Falha de conexão ao solicitar QR.');}
    finally{setRequesting(false);}
  };
  const ready=bridge?.connected===true;
  const qrReady=bridge?.online===true&&bridge?.qrFresh===true&&!!bridge?.qr;
  const starting=bridge?.online===true&&!ready&&!qrReady&&bridge?.state==='connecting';
  return <section aria-label="WA.Auto no LexisPredict" className="mx-3 mt-2 rounded-2xl border border-border/60 bg-card p-3 shadow-sm sm:mx-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2 min-w-0">
        {ready?<Wifi className="h-5 w-5 shrink-0 text-emerald-600"/>:
          <WifiOff className="h-5 w-5 shrink-0 text-amber-600"/>}
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <strong className="text-sm">WA.Auto · WhatsApp integrado</strong>
            <Badge variant={ready?'default':'outline'}>
              {ready?'CONECTADO':qrReady?'QR CODE ATUAL':starting?'INICIANDO':loading?'VERIFICANDO':bridge?.state==='error'?'ERRO':'DESCONECTADO'}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {ready?'Aparelho vinculado: '+(bridge?.phone||'WhatsApp'):
              'Conexão por dispositivo vinculado. Não há envios automáticos quando a sessão está offline.'}
          </p>
          {lastCheckedAt?<p className="mt-1 text-[11px] text-muted-foreground">Estado conferido às {lastCheckedAt}</p>:null}
        </div>
      </div>
      <div className="flex gap-2">
       {!ready?<Button type="button" size="sm" disabled={requesting||!bridge?.online} onClick={()=>{setShowQr(true);void requestNewQr()}}>
        <RefreshCw className={`mr-1 h-4 w-4 ${requesting?'animate-spin':''}`}/>Gerar novo QR
       </Button>:null}
       <Button type="button" variant="outline" size="sm" disabled={refreshing} onClick={()=>void refresh()}>
        <RefreshCw className={`mr-1 h-4 w-4 ${refreshing?'animate-spin':''}`}/>Atualizar
       </Button>
      </div>
    </div>
    {requestNote&&<p role="status" className="mt-2 rounded border p-2 text-xs">{requestNote}</p>}
    {!ready&&showQr&&<div role="status" className="mt-3 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-foreground">
      {!bridge?.online?'O serviço de pareamento está offline. Nenhum QR disponível nesta consulta; um código novo será gerado quando o serviço voltar.':
       qrReady?'QR recente. Abra WhatsApp no celular → Aparelhos conectados → Conectar aparelho.':
       bridge?.qrRefreshPending?'Pedido registrado; aguardando o worker renovar o QR.':bridge?.qrStale?'QR antigo expirado. Clique em Gerar novo QR.':'Aguardando QR do worker. Esta tela atualiza automaticamente.'}
     </div>}
    {qrReady&&showQr&&<div className="mt-3 flex flex-wrap items-center justify-center gap-4 rounded-xl border border-border/50 p-4">
      <img src={bridge?.qr||''} alt="Código QR para vincular WhatsApp ao LexisPredict"
        className={`h-56 w-56 max-w-full rounded-lg bg-white p-2 ${bridge?.qrFresh?'':'opacity-50'}`}/>
      <div className="max-w-sm text-xs leading-relaxed">
        <strong>QR gerado recentemente — escaneie antes de expirar</strong>
        <p className="mt-1">No WhatsApp do celular, abra <strong>Aparelhos conectados</strong>,
        escolha <strong>Conectar aparelho</strong> e escaneie este QR Code. A vinculação habilita a fila autorizada; o histórico das conversas não é importado automaticamente.</p>
      </div>
    </div>}
    {!ready&&!qrReady&&<div role="status" className="mt-3 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600"/>
      <span>{error||bridge?.error||'Servidor de WhatsApp ainda sem sessão ativa. Nenhuma mensagem será enviada enquanto estiver desconectado.'}</span>
    </div>}
  </section>;
}
