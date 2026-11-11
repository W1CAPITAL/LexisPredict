"use client";

import React from "react";
import { Bot, ClipboardCopy, Loader2, RefreshCw, FileSearch } from "lucide-react";
import { getHermesReturnReviewAction } from "@/app/actions/hermes-return-actions";
import {djenBuscaProcesso,type DjenItemRaw} from "@/lib/djen-client";
import {resolveOfficialCourtPortal,getHermesNationalSourcePlan,OFFICIAL_DJEN_PUBLIC_PORTAL,OFFICIAL_JUSBR_PORTAL} from "@/lib/hermes-official-fallbacks";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

type Review = NonNullable<Extract<Awaited<ReturnType<typeof getHermesReturnReviewAction>>, { ok: true }>['review']>;
type CourtScanner = NonNullable<Extract<Awaited<ReturnType<typeof getHermesReturnReviewAction>>, {ok:true}>['courtScanner']>;
type CourtScannerDetails = NonNullable<Extract<Awaited<ReturnType<typeof getHermesReturnReviewAction>>, {ok:true}>['courtScannerDetails']>;

const fmt = (iso: unknown) => {
  const raw = String(iso || "");
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? m[3] + "/" + m[2] + "/" + m[1] : "—";
};
const fmtTime = (iso:unknown) => {
 const value=new Date(String(iso||''));
 return Number.isFinite(value.getTime())?value.toLocaleString('pt-BR',{
  timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'short',
 }):'—';
};
export function HermesReturnReviewButton({ processId, compact = false }: { processId: number; compact?: boolean }) {
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [review, setReview] = React.useState<Review | null>(null);
  const [registered, setRegistered] = React.useState<{ next: string | null; last: string | null; status?:string }>({ next: null, last: null });
  const [copied, setCopied] = React.useState(false);
  const [protocolo, setProtocolo] = React.useState("");
  const [djenBusy,setDjenBusy] = React.useState(false);
  const [djenOnly,setDjenOnly] = React.useState<{
    ok:boolean; error:string|null; checkedAt:string; items:DjenItemRaw[]; count:number;
  }|null>(null);
  const [courtScanner,setCourtScanner]=React.useState<CourtScanner|null>(null);
  const [courtScannerDetails,setCourtScannerDetails]=React.useState<CourtScannerDetails|null>(null);
  const [scmppBusy,setScmppBusy]=React.useState(false);
  const [scmppResult,setScmppResult]=React.useState<{
    status:string;message:string;checkedAt:string;httpStatus:number|null;movementsConfirmed:false
  }|null>(null);
  const courtPortal=React.useMemo(()=>resolveOfficialCourtPortal(protocolo),[protocolo]);
  const nationalPlan=React.useMemo(()=>getHermesNationalSourcePlan(protocolo),[protocolo]);

  async function checkScmppAvailability(){
    if(scmppBusy||!nationalPlan?.scmpp)return;
    setScmppBusy(true);setScmppResult(null);
    try{
      const response=await fetch('/api/hermes-office?action=scmpp-health&instance=1g',{
        method:'GET',credentials:'same-origin',cache:'no-store',
      });
      const body=await response.json();
      if(!response.ok||!body.ok)throw Error('Verificação não disponível para esta sessão.');
      setScmppResult(body.probe);
    }catch{
      setScmppResult({
        status:'unavailable',message:'Não foi possível consultar o diagnóstico SCMPP.',
        checkedAt:new Date().toISOString(),httpStatus:null,movementsConfirmed:false,
      });
    }finally{setScmppBusy(false);}
  }

  async function queryOfficialBrazil(processId:number){
    const response=await fetch('/api/hermes-office?action=review',{
      method:'POST',credentials:'same-origin',
      headers:{'Content-Type':'application/json',Accept:'application/json'},
      body:JSON.stringify({processId})
    });
    const data=await response.json().catch(()=>({ok:false,error:'Resposta inválida do serviço de consulta.'}));
    if(!response.ok||!data.ok)throw Error(data.error||'Falha ao consultar as fontes oficiais.');
  }

  /** Consulta isolada e explícita: canal oficial DJEN pelo navegador.
   * Nunca persiste atendimento, andamento, rascunho ou confirmação DataJud.
   */
  async function checkDjenOnly(){
    if(djenBusy)return;
    const digits=protocolo.replace(/\D/g,'');
    if(digits.length!==20){setDjenOnly({ok:false,error:'Número CNJ não localizado no cadastro.',items:[],count:0,checkedAt:new Date().toISOString()});return;}
    setDjenBusy(true);setDjenOnly(null);
    try{
      const result=await djenBuscaProcesso({protocolo:digits,fast:true});
      if(!result.ok){
        setDjenOnly({ok:false,error:result.error||'Consulta direta ao DJEN indisponível.',items:[],count:0,checkedAt:new Date().toISOString()});
        return;
      }
      // Somente comunicados com CNJ idêntico ao processo consultado.
      const verified=result.items.filter(item=>
        String(item.numeroProcesso||item.numero_processo||'').replace(/\D/g,'')===digits
      );
      setDjenOnly({ok:true,error:null,count:verified.length,items:verified.slice(0,12),checkedAt:new Date().toISOString()});
    }catch{
      setDjenOnly({ok:false,error:'O navegador não conseguiu acessar a API oficial do DJEN.',items:[],count:0,checkedAt:new Date().toISOString()});
    }finally{setDjenBusy(false);}
  }

  const load = React.useCallback(async (autoRefresh = false) => {
    if (!Number.isSafeInteger(processId) || processId <= 0) return;
    setBusy(true); setError("");
    try {
      let result = await getHermesReturnReviewAction(processId);
      if (!result.ok) throw new Error(result.error);
      setProtocolo(String(result.protocolo||''));
      // Opening a client without a recent saved review requests real official data immediately.
      // Never invents a draft: it is generated only after the backend source lookup.
      const checked=Date.parse(String(result.review?.checked_at||''));
      const incomplete=!(result.review?.djen_ok===true&&result.review?.datajud_ok===true);
      const stale=!Number.isFinite(checked)||Date.now()-checked>(incomplete?2:360)*60*1000;
      if(autoRefresh&&stale){
        await queryOfficialBrazil(processId);
        result=await getHermesReturnReviewAction(processId);
        if(!result.ok)throw new Error(result.error);
      }
      setReview(result.review as Review | null);
      setCourtScanner(result.courtScanner||null);
      setCourtScannerDetails(result.courtScannerDetails||null);
      setRegistered({ next: result.nextReturnRegistered, last: result.lastReturnRegistered,status:result.returnDateStatus });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Revisão indisponível.");
    } finally { setBusy(false); }
  }, [processId]);

  React.useEffect(() => { if (open) void load(true); }, [open, load]);

  async function refresh() {
    setBusy(true); setError("");setDjenOnly(null);
    try {
      await queryOfficialBrazil(processId);
      await load(false);
    } catch (e) { setError(e instanceof Error ? e.message : "Falha ao consultar fontes oficiais."); }
    finally { setBusy(false); }
  }
  async function copyDraft() {
    if (!review?.message_draft) return;
    try {
      await navigator.clipboard.writeText(String(review.message_draft));
      setCopied(true);
    } catch { setError("Não foi possível copiar. Selecione o texto do rascunho."); }
  }
  if (!Number.isSafeInteger(processId) || processId <= 0) return null;

  const highlights = Array.isArray(review?.highlights) ? review.highlights as Array<{
    source: string; date: string | null; text: string; url: string | null; kind: string
  }> : [];

  return (
    <>
      <Button type="button" variant="outline" size={compact ? "icon" : "sm"}
        title="Hermes: análise do retorno e consulta DataJud/DJEN"
        aria-label="Abrir análise Hermes do retorno"
        className={compact ? "h-9 w-9 border-[#9c5776]/35 text-[#a15c7d] dark:text-[#e2b5cb]" : "h-9 gap-2 border-[#9c5776]/35 text-[#7e2d4f] dark:text-[#e5bfd0]"}
        onClick={() => { setCopied(false); setOpen(true); }}
      >
        <Bot size={compact ? 17 : 15} />{compact ? null : "Hermes · Retorno"}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto border-border bg-background text-foreground">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg"><Bot size={20} className="text-[#8e3f61]"/> Hermes · Revisão do retorno</DialogTitle>
            <DialogDescription>Conferência oficial e mensagem em rascunho. Nenhum contato é enviado ou registrado automaticamente.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs text-muted-foreground">
                <p>Último atendimento: {fmt(registered.last)} · Próximo retorno cadastrado: {fmt(registered.next)}</p>
                {registered.status==='inconsistent'&&<p className="mt-1 font-semibold text-amber-700 dark:text-amber-300">Cadastro inconsistente: retorno registrado cedo demais após o último atendimento. Não é retorno vencido.</p>}
                {registered.status==='upcoming'&&<p className="mt-1 text-emerald-700 dark:text-emerald-300">Próximo retorno ainda não chegou. Consulta manual disponível.</p>}
                {registered.status==='today'&&<p className="mt-1 font-semibold text-foreground">Retorno previsto para hoje.</p>}
                <p>Consulta Hermes: {fmt(review?.checked_at)} · Fontes: DJEN {review?.djen_ok ? "confirmada" : "não confirmada"} / DataJud {review?.datajud_ok ? "confirmada" : "não confirmada"}</p>
              </div>
              <Button size="sm" onClick={() => void refresh()} disabled={busy} className="gap-2 bg-[#7d3658] text-white hover:bg-[#632642]">
                {busy ? <Loader2 className="h-4 w-4 animate-spin"/> : <RefreshCw className="h-4 w-4"/>}
                Consultar agora
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" disabled={busy||djenBusy||!protocolo}
                className="h-9 gap-2 border-[#9c5776]/40 text-[#7e2d4f] dark:text-[#e5bfd0]"
                onClick={()=>void checkDjenOnly()}>
                {djenBusy?<Loader2 size={15} className="animate-spin"/>:<FileSearch size={15}/>}
                Consultar somente DJEN
              </Button>
              <a href={OFFICIAL_DJEN_PUBLIC_PORTAL} target="_blank" rel="noopener noreferrer"
                className="inline-flex min-h-9 items-center rounded-lg border border-border px-3 text-xs font-bold text-foreground hover:bg-muted">
                Portal oficial do DJEN
              </a>
              {nationalPlan?.otherPortals.map(p=><a key={p.url} href={p.url} target="_blank" rel="noopener noreferrer"
                className="inline-flex min-h-9 items-center rounded-lg border border-border px-3 text-xs font-bold text-foreground hover:bg-muted">{p.label}</a>)}
              <a href={OFFICIAL_JUSBR_PORTAL} target="_blank" rel="noopener noreferrer"
                title="Jus.br: consulta nacional mediante login autorizado; não é uma API pública para robôs"
                className="inline-flex min-h-9 items-center rounded-lg border border-border px-3 text-xs font-bold text-foreground hover:bg-muted">Jus.br · consulta nacional</a>
              {courtPortal&&<a href={courtPortal.url} target="_blank" rel="noopener noreferrer"
                title={courtPortal.scope} className="inline-flex min-h-9 items-center rounded-lg border border-border px-3 text-xs font-bold text-foreground hover:bg-muted">
                {courtPortal.label}
              </a>}
            </div>
            {courtScanner&&<section aria-label="Scanner automático de movimentações do tribunal"
              className="space-y-2 rounded-lg border border-[#945878]/30 bg-card p-3 text-xs">
              <p className="font-semibold text-foreground">Scanner automático do tribunal · {courtScanner.source}</p>
              <p className="text-muted-foreground">{courtScanner.message}</p>
              {courtScannerDetails?.checkedAt&&<p>Última tentativa no tribunal: {fmtTime(courtScannerDetails.checkedAt)}
                {courtScannerDetails.httpStatus!==null&&' · HTTP '+courtScannerDetails.httpStatus}</p>}
              <p>{courtScanner.verified
                ?courtScanner.movements+' movimento(s) público(s) anteriormente verificado(s).'
                :'Nenhuma movimentação deste processo confirmada diretamente pelo tribunal.'}</p>
              {courtScannerDetails?.verifiedAt&&<p>Última verificação de movimentos: {fmtTime(courtScannerDetails.verifiedAt)}</p>}
              {courtScanner.blocked&&courtScanner.holdUntil&&
                <p className="font-semibold text-amber-700 dark:text-amber-300">
                  Serviço do tribunal em pausa até {fmtTime(courtScanner.holdUntil)}. Isso afeta a fonte, não o retorno do cliente.
                </p>}
              <p className="text-muted-foreground">Consulta MNI/SCMPP independente do DataJud e do DJEN. Acessar o WSDL não consulta os movimentos do processo.</p>
            </section>}
            {nationalPlan?.scmpp&&review&&!review.datajud_ok&&<section className="space-y-2 rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
              <p><strong className="text-foreground">SCMPP · TJPR:</strong> o WSDL descreve o serviço, mas não prova que o tribunal aceitou uma consulta de movimentos. O scanner automático acima apresenta a última tentativa efetiva por processo e a pausa da fonte. A Resolução TJPR 532/2026 prevê acesso público sem login; o manual SOAP antigo ainda descreve credenciais. O Hermes não atravessa bloqueios do tribunal.</p>
              <p className="flex flex-wrap gap-3">
                <a href={nationalPlan.scmpp.documentationUrl} target="_blank" rel="noopener noreferrer" className="font-semibold underline">Manual técnico SCMPP</a>
                <a href={nationalPlan.scmpp.legalUrl} target="_blank" rel="noopener noreferrer" className="font-semibold underline">Resolução TJPR 532/2026</a>
              </p>
              <Button type="button" variant="outline" size="sm" disabled={scmppBusy||busy}
                onClick={()=>void checkScmppAvailability()} className="h-8 gap-2">
                {scmppBusy?<Loader2 size={13} className="animate-spin"/>:<FileSearch size={13}/>}
                Testar acesso SCMPP (1º grau)
              </Button>
              {scmppResult&&<p role="status" className="rounded-md border border-border bg-background p-2 leading-5">
                {scmppResult.message} {scmppResult.httpStatus!==null?'HTTP '+scmppResult.httpStatus+'. ':''}
                <span className="block font-medium">Nenhuma movimentação é confirmada por este teste.</span>
              </p>}
            </section>}
            {djenOnly&&<section aria-label="Consulta DJEN independente" className="space-y-2 rounded-xl border border-[#945878]/30 bg-card p-3">
              <p className="font-semibold">DJEN independente · {fmt(djenOnly.checkedAt)}</p>
              <p className="text-xs text-muted-foreground">Consulta pelo navegador, sem alterar a revisão salva. Publicações DJEN não equivalem à confirmação DataJud ou ao histórico integral do tribunal.</p>
              {djenOnly.ok
                ?<p className="text-xs text-foreground">Consulta oficial concluída: {djenOnly.count} publicação(ões) do CNJ correspondente no intervalo pesquisado.</p>
                :<p className="text-xs text-amber-700 dark:text-amber-300">{djenOnly.error} Use o portal oficial acima se necessário.</p>}
              {djenOnly.items.map((item,index)=>{
                const href=item.hash?`https://comunica.pje.jus.br/consulta?hash=${encodeURIComponent(String(item.hash))}`:OFFICIAL_DJEN_PUBLIC_PORTAL;
                return <div key={String(item.hash||item.id||index)} className="rounded-lg border border-border bg-background p-3">
                  <p className="mb-1 font-semibold text-xs">DJEN · {fmt(item.data_disponibilizacao)}</p>
                  <p className="whitespace-pre-wrap text-xs leading-5">{String(item.texto||'Publicação sem texto na resposta oficial.').slice(0,900)}</p>
                  <a target="_blank" rel="noopener noreferrer" href={href} className="mt-2 inline-block text-xs font-bold text-[#8e3f61] underline">Ver no DJEN</a>
                </div>;
              })}
            </section>}
            {error && <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-700 dark:text-red-200">{error}</p>}
            {busy && !review ? <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin"/> Carregando análise…</p> : null}
            {!busy && !review && !error ? <p className="rounded-xl border border-dashed border-border p-4 text-xs text-muted-foreground">Ainda não há revisão salva para este processo. Use “Consultar agora” para verificar o DJEN e o DataJud.</p> : null}
            {review ? (
              <>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full border border-[#a15f7a]/40 bg-[#a15f7a]/10 px-3 py-1 text-xs font-bold text-[#7d3658] dark:text-[#e8bdcf]">Prioridade: {review.priority_label} · {review.priority_score}/100</span>
                  <span className="rounded-full border border-border bg-muted px-3 py-1 text-xs text-foreground">{(review.djen_ok&&review.datajud_ok) ? "Conferência concluída" : (review.djen_ok||review.datajud_ok) ? "Consulta parcial · fonte pendente" : review.state === "skipped" ? "Processo encerrado" : review.state === "scanning" ? "Verificação em curso" : "Sem confirmação oficial"}</span>
                </div>
                {(() => {
                  const raw=review.source_snapshot;
                  const info=raw && typeof raw==='object' && !Array.isArray(raw)
                    ?(raw as Record<string,unknown>).sourceErrors:null;
                  const sourceErrors=info && typeof info==='object'
                    ?info as Record<string,string|null>:null;
                  if(!sourceErrors)return null;
                  return <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-xs leading-5">
                    <p className="font-semibold">Diagnóstico das consultas oficiais</p>
                    {!review.djen_ok&&<p>DJEN: {String(sourceErrors.djen||'Fonte não confirmada.')}</p>}
                    {!review.datajud_ok&&<p>DataJud: {String(sourceErrors.datajud||'Fonte não confirmada.')}</p>}
                    {sourceErrors.fonteAlternativa&&<p className="mt-2 font-medium text-foreground">{sourceErrors.fonteAlternativa}</p>}
                    <p className="mt-1 text-muted-foreground">Uma fonte pode responder mesmo quando a outra falha. DJEN confirma publicações, não a cronologia integral do tribunal.</p>
                  </div>;
                })()}
                {String(registered.next || "") !== String(review.due_on || "") && (
                  <p className="rounded-lg border border-amber-500/35 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200">A data desta revisão é diferente do retorno atual. Pode ser uma consulta avulsa ou um atendimento posterior; revise as datas antes de usar o rascunho.</p>
                )}
                <div className="space-y-2">
                  <h3 className="font-semibold">Pontos principais e fontes</h3>
                  {highlights.map((item, index) => (
                    <div key={index} className="rounded-xl border border-border bg-card p-3 text-xs leading-5">
                      <p className="mb-1 font-bold text-foreground">{item.source}{item.date ? " · " + fmt(item.date) : ""}{item.kind === "new" ? " · Registro posterior ao retorno" : ""}</p>
                      <p className="whitespace-pre-wrap text-foreground/85">{item.text}</p>
                      {item.url && /^https:\/\//.test(item.url) && <a href={item.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 font-bold text-[#914462] underline">Abrir publicação oficial <FileSearch size={13}/></a>}
                    </div>
                  ))}
                </div>
                {review.message_draft && (
                  <div className="rounded-xl border border-border bg-muted/40 p-4">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <h3 className="font-semibold">Possível mensagem ao cliente</h3>
                      <Button type="button" variant="outline" size="sm" className="gap-1" onClick={() => void copyDraft()}>
                        <ClipboardCopy size={13}/>{copied ? "Copiado" : "Copiar"}
                      </Button>
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">{String(review.message_draft)}</p>
                  </div>
                )}
                {(registered.status==='today'||registered.status==='overdue')&&review.suggested_next_return&&(
                  <p className="text-xs text-muted-foreground">Próximo retorno sugerido: <strong className="text-foreground">{fmt(review.suggested_next_return)}</strong> (sugestão administrativa; não é prazo judicial nem alteração automática no cadastro).</p>
                )}
              </>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
