"use client";

import * as React from 'react';
import {AlertCircle, CheckCircle2, CloudDownload, ExternalLink, FileText, Loader2, RefreshCw, Search, ShieldCheck} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {canonicalCnj,chronologicalThroughContestacao,type AutoOabDoc} from '@/lib/autos-oab-logic';

type Setup={ok:boolean;configured:boolean;provider?:string;error?:string};
type Status='PENDENTE'|'PROCESSANDO'|'SUCESSO'|'ERRO'|'DESCONHECIDO';
type AutosResult={ok:boolean;documents?:AutoOabDoc[];nextCursor?:string|null;complete?:boolean;error?:string};
const API='/api/scanner/autos-oab';
async function jsonOrError(res:Response) {
 const data=await res.json().catch(()=>({ok:false,error:'Resposta inválida da integração.'}));
 if(!res.ok||!data?.ok)throw new Error(data?.error||'Consulta indisponível.');
 return data;
}
export function AutosOabScannerPanel(){
 const [expanded,setExpanded]=React.useState(false);
 const [setup,setSetup]=React.useState<Setup|null>(null);
 const [cnjInput,setCnjInput]=React.useState('');
 const [authorized,setAuthorized]=React.useState(false);
 const [acceptedCosts,setAcceptedCosts]=React.useState(false);
 const [busy,setBusy]=React.useState<'solicitar'|'status'|'autos'|null>(null);
 const [error,setError]=React.useState('');
 const [status,setStatus]=React.useState<Status|null>(null);
 const [documents,setDocuments]=React.useState<AutoOabDoc[]>([]);
 const [nextCursor,setNextCursor]=React.useState<string|null>(null);
 const [complete,setComplete]=React.useState(false);
 const [showAll,setShowAll]=React.useState(false);
 const validCnj=canonicalCnj(cnjInput);
 const current=React.useRef(0);
 React.useEffect(()=>{
   if(!expanded)return;
   const controller=new AbortController();
   void fetch(API+'?action=config',{credentials:'same-origin',cache:'no-store',signal:controller.signal})
     .then(r=>r.json()).then(data=>{if(!controller.signal.aborted)setSetup(data);})
     .catch(()=>{if(!controller.signal.aborted)setSetup({ok:false,configured:false,error:'Integração indisponível.'});});
   const params=new URLSearchParams(window.location.search);
   const incoming=params.get('cnj')||params.get('search')||'';
   const parsed=canonicalCnj(incoming);
   if(parsed)setCnjInput(parsed);
   return ()=>controller.abort();
 },[expanded]);
 const requestUrl=(action:string,cursor?:string|null,key?:string)=>{
   const p=new URLSearchParams({action,cnj:validCnj||''});
   if(cursor)p.set('cursor',cursor);
   if(key)p.set('key',key);
   return API+'?'+p;
 };
 const resetDocs=()=>{
   current.current++;setDocuments([]);setStatus(null);setNextCursor(null);
   setComplete(false);setError('');setAuthorized(false);setAcceptedCosts(false);
 };
 const loadAutos=async(cursor?:string|null)=>{
   if(!validCnj)return;
   const version=current.current;
   setBusy('autos');setError('');
   try{
     const data=await jsonOrError(await fetch(requestUrl('autos',cursor),{cache:'no-store',credentials:'same-origin'})) as AutosResult;
     if(version!==current.current)return;
     const received=data.documents||[];
     setDocuments(prev=>{
       const existing=cursor?prev:[];
       const keys=new Set(existing.map(x=>x.key));
       return [...existing,...received.filter(x=>!keys.has(x.key))];
     });
     setNextCursor(data.nextCursor||null);
     setComplete(Boolean(data.complete));
   }catch(e){if(version===current.current)setError(e instanceof Error?e.message:'Erro ao consultar autos.');}
   finally{if(version===current.current)setBusy(null);}
 };
 const consultStatus=async()=>{
   if(!validCnj)return;
   const version=current.current;
   setBusy('status');setError('');
   try{
     const data=await jsonOrError(await fetch(requestUrl('status'),{cache:'no-store',credentials:'same-origin'}));
     if(version!==current.current)return;
     const found=String(data.status||'DESCONHECIDO').toUpperCase() as Status;
     setStatus(found);
     if(found==='SUCESSO')await loadAutos();
     if(found==='ERRO')setError(data.motivoErro||'A consulta autenticada falhou no tribunal. Confira o certificado no provedor.');
   }catch(e){if(version===current.current)setError(e instanceof Error?e.message:'Falha ao verificar status.');}
   finally{if(version===current.current)setBusy(null);}
 };
 const start=async()=>{
   if(!validCnj||!authorized||!acceptedCosts||busy)return;
   current.current++;const version=current.current;
   setBusy('solicitar');setError('');setDocuments([]);setStatus(null);setNextCursor(null);setComplete(false);
   try{
     await jsonOrError(await fetch(API,{
       method:'POST',credentials:'same-origin',cache:'no-store',
       headers:{'Content-Type':'application/json'},
       body:JSON.stringify({action:'solicitar',cnj:validCnj,confirmAuthorized:true,confirmCosts:true}),
     }));
     if(version===current.current)setStatus('PENDENTE');
   }catch(e){if(version===current.current)setError(e instanceof Error?e.message:'Não foi possível solicitar os autos.');}
   finally{if(version===current.current)setBusy(null);}
 };
 React.useEffect(()=>{
   if(!expanded||!validCnj||!['PENDENTE','PROCESSANDO'].includes(status||''))return;
   // Poll only while this panel is open, without background processes or paid retries.
   const timer=window.setTimeout(()=>{if(!busy)void consultStatus();},8000);
   return ()=>window.clearTimeout(timer);
 },[expanded,status,busy,validCnj]);
 const segment=React.useMemo(()=>chronologicalThroughContestacao(documents),[documents]);
 const shown=showAll? [...documents].sort((a,b)=>a.data.localeCompare(b.data)):segment.docs;
 return (
  <section className="rounded-xl border border-primary/40 bg-card text-card-foreground p-4 space-y-3 shadow-sm" aria-label="Autos com certificado OAB">
   <button type="button" onClick={()=>setExpanded(v=>!v)} className="w-full flex items-start gap-3 text-left">
     <ShieldCheck className="mt-0.5 text-primary shrink-0" size={18}/>
     <span className="flex-1">
       <strong className="block text-xs font-bold">Autos completos · Certificado OAB (A1)</strong>
       <span className="block mt-1 text-[11px] text-muted-foreground">
         Consulta autenticada, petição inicial e documentos até a possível contestação. Integração opcional e paga.
       </span>
     </span>
     <span className="text-xs text-primary font-semibold">{expanded?'Fechar':'Abrir'}</span>
   </button>
   {expanded && <div className="space-y-3">
      <div className="rounded-lg border border-border bg-muted/50 p-3 text-xs space-y-2">
        <p className="font-semibold">Como funciona</p>
        <p>O advogado cadastra o certificado A1 diretamente no Escavador, que acessa o tribunal quando autorizado. O LexisPredict usa apenas um token de API mantido no servidor.</p>
        <p className="font-medium">Não envie arquivo .pfx, PIN, senha ou certificado ao LexisPredict. Certificados A3 (token/cartão) exigem um conector local próprio e não são suportados por esta opção.</p>
        <a href="https://api.escavador.com/certificados" target="_blank" rel="noopener noreferrer" className="text-primary underline inline-flex items-center gap-1">
         Configurar certificado A1 no provedor <ExternalLink size={12}/>
        </a>
        <p className="text-[11px]">A equipe de administração também precisa configurar <code>ESCAVADOR_API_TOKEN</code> na Vercel. Cada solicitação pode consumir créditos do provedor.</p>
      </div>
      {setup && !setup.configured && <p role="status" className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-2 text-xs text-foreground">
        Integração ainda não configurada: falta a chave privada da API no servidor. O scanner DataJud/DJEN continua disponível normalmente.
      </p>}
      <label className="block space-y-1 text-xs font-semibold" htmlFor="autos-oab-cnj">
        Número do processo (CNJ)
        <input id="autos-oab-cnj" value={cnjInput} onChange={e=>{setCnjInput(e.target.value);resetDocs();}}
         placeholder="0000000-00.0000.0.00.0000" autoComplete="off"
         className="block w-full rounded-lg border border-input bg-background px-3 py-2 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring text-xs"/>
      </label>
      <div className="space-y-2">
        <label className="flex items-start gap-2 text-[11px] text-foreground"><input type="checkbox" checked={authorized} onChange={e=>setAuthorized(e.target.checked)} className="mt-0.5 accent-primary"/> Confirmo que o advogado tem autorização para consultar os autos deste processo.</label>
        <label className="flex items-start gap-2 text-[11px] text-foreground"><input type="checkbox" checked={acceptedCosts} onChange={e=>setAcceptedCosts(e.target.checked)} className="mt-0.5 accent-primary"/> Entendo que esta busca autenticada pode gerar cobrança na API contratada.</label>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" disabled={!setup?.configured||!validCnj||!authorized||!acceptedCosts||!!busy} onClick={()=>void start()}>
         {busy==='solicitar'?<Loader2 size={13} className="mr-1 animate-spin"/>:<Search size={13} className="mr-1"/>}
         Solicitar autos com certificado
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={!setup?.configured||!validCnj||!!busy} onClick={()=>void consultStatus()}>
         <RefreshCw size={13} className="mr-1"/> Consultar andamento
        </Button>
      </div>
      {status && <p role="status" className="text-xs font-semibold">
        Consulta autenticada: {status==='SUCESSO'?'concluída pelo provedor':status==='PENDENTE'?'na fila do provedor':status==='PROCESSANDO'?'em execução':status==='ERRO'?'falhou no provedor':'aguardando confirmação'}
      </p>}
      {error&&<p role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-2 text-xs text-foreground"><AlertCircle size={14} className="shrink-0"/>{error}</p>}
      {busy==='autos'&&<p className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="animate-spin" size={14}/> Lendo índices dos documentos autorizados…</p>}
      {documents.length>0 && <div className="rounded-lg border border-border p-3 space-y-3">
        <div className="flex flex-wrap justify-between gap-2 items-center">
          <div className="text-xs">
            <p className="font-bold">{documents.length} documentos encontrados {complete?'(paginação concluída)':'(listagem parcial)'}</p>
            <p className="text-muted-foreground">{segment.foundContestacao?'Possível contestação identificada pelo título. A autoria do banco precisa ser conferida.':'Contestação ainda não identificada; não concluir que ela não existe.'}</p>
          </div>
          <label className="flex gap-2 items-center text-xs"><input type="checkbox" checked={showAll} onChange={e=>setShowAll(e.target.checked)} className="accent-primary"/> Ver também posteriores à contestação</label>
        </div>
        {!complete&&<p className="text-[11px] text-amber-800 dark:text-amber-200">Listagem incompleta: podem existir documentos anteriores. Continue carregando até finalizar para confirmar o recorte.</p>}
        <div className="space-y-1 max-h-64 overflow-auto">
          {shown.map((doc,i)=><div key={doc.key} className="flex items-start justify-between gap-2 rounded-md border border-border/60 bg-muted/25 p-2 text-xs">
            <div className="min-w-0">
              <p className="font-semibold break-words">{i+1}. {doc.titulo} {doc.tipoDetectado==='contestacao'&&<span className="text-primary">· possível contestação</span>}</p>
              <p className="text-muted-foreground">{doc.data||'Sem data'} · {doc.extensao.toUpperCase()} · {doc.tipo}</p>
            </div>
            <a href={requestUrl('documento',null,doc.key)} className="shrink-0 inline-flex items-center gap-1 rounded-md border border-primary/40 px-2 py-1 font-semibold text-primary hover:bg-muted" download>
             <CloudDownload size={13}/> Baixar
            </a>
          </div>)}
        </div>
        {nextCursor&&<Button type="button" variant="outline" size="sm" disabled={!!busy} onClick={()=>void loadAutos(nextCursor)} className="w-full">
         <FileText size={13} className="mr-1"/> Carregar mais documentos
        </Button>}
        <p className="text-[10px] text-muted-foreground">Os arquivos não são guardados automaticamente no LexisPredict. O acesso só é possível para usuários autorizados desta empresa. Não há peticionamento ou envio automático.</p>
      </div>}
   </div>}
  </section>
 );
}
