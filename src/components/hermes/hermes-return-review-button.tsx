"use client";

import React from "react";
import { Bot, ClipboardCopy, Loader2, RefreshCw, FileSearch } from "lucide-react";
import { getHermesReturnReviewAction } from "@/app/actions/hermes-return-actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

type Review = NonNullable<Extract<Awaited<ReturnType<typeof getHermesReturnReviewAction>>, { ok: true }>['review']>;

const fmt = (iso: unknown) => {
  const raw = String(iso || "");
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? m[3] + "/" + m[2] + "/" + m[1] : "—";
};
export function HermesReturnReviewButton({ processId, compact = false }: { processId: number; compact?: boolean }) {
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [review, setReview] = React.useState<Review | null>(null);
  const [registered, setRegistered] = React.useState<{ next: string | null; last: string | null; status?:string }>({ next: null, last: null });
  const [copied, setCopied] = React.useState(false);

  async function queryOfficialBrazil(processId:number){
    const response=await fetch('/api/hermes-office?action=review',{
      method:'POST',credentials:'same-origin',
      headers:{'Content-Type':'application/json',Accept:'application/json'},
      body:JSON.stringify({processId})
    });
    const data=await response.json().catch(()=>({ok:false,error:'Resposta inválida do serviço de consulta.'}));
    if(!response.ok||!data.ok)throw Error(data.error||'Falha ao consultar as fontes oficiais.');
  }

  const load = React.useCallback(async (autoRefresh = false) => {
    if (!Number.isSafeInteger(processId) || processId <= 0) return;
    setBusy(true); setError("");
    try {
      let result = await getHermesReturnReviewAction(processId);
      if (!result.ok) throw new Error(result.error);
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
      setRegistered({ next: result.nextReturnRegistered, last: result.lastReturnRegistered,status:result.returnDateStatus });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Revisão indisponível.");
    } finally { setBusy(false); }
  }, [processId]);

  React.useEffect(() => { if (open) void load(true); }, [open, load]);

  async function refresh() {
    setBusy(true); setError("");
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
                    <p className="mt-1 text-muted-foreground">Uma fonte pode responder mesmo quando a outra falha. Reconsulte sem presumir que não houve movimentação.</p>
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
                <p className="text-xs text-muted-foreground">Próximo retorno sugerido: <strong className="text-foreground">{fmt(review.suggested_next_return)}</strong> (sugestão administrativa; não é prazo judicial nem alteração automática no cadastro).</p>
              </>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
