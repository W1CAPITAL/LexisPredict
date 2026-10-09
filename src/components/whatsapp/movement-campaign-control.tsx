"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BellRing, FileClock, CheckCircle2, Clock3, Loader2, Pause, Play, RefreshCcw, Send, ShieldCheck, Square, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PUBLICATION_TEMPLATE_PREVIEWS } from "@/lib/wa-publication-templates";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAdmin } from "@/hooks/use-admin";
import { resolveWaAutoPermissions } from "@/lib/wa-auto-permissions";
import {
  previewWhatsAppMovementCampaignAction,
  startWhatsAppMovementCampaignAction,
  getWhatsAppMovementCampaignAction,
  changeWhatsAppMovementCampaignAction,
  advanceWhatsAppMovementCampaignAction,
} from "@/app/actions/whatsapp-movement-campaign-actions";

type Sample = {client:string;cnj:string;source:string;date:string;message:string;verdict?:string|null;kind?:string|null};
type CampaignKind = "movement" | "publication";
type Preview = {
  ok:boolean;error?:string;consentAttested?:boolean;kind?:CampaignKind;counts?:{
    scanned:number;withoutPhone:number;withoutEvent:number;blocked:number;samePhone:number;
    alreadyQueued:number;eligible:number;alreadyClosed?:number;consentMissing?:number;
    needsReview?:number;alreadyNotified?:number;missingReturn?:number;noNewMovement?:number;
  }; samples?:Sample[];
};
type Campaign = {
  id:string;campaign_kind?:CampaignKind;status:'running'|'paused'|'completed'|'cancelled';total:number;
  sent_count:number;failed_count:number;uncertain_count:number;
  pending_count?:number;review_count?:number;
  next_send_at:string;created_at:string;
};

export function MovementCampaignControl() {
  const {profile}=useAdmin();
  const allowed=resolveWaAutoPermissions(profile as any).canManage;
  const {toast}=useToast();
  const [open,setOpen]=useState(false);
  const [loading,setLoading]=useState(false);
  const [sending,setSending]=useState(false);

  const [kind,setKind]=useState<CampaignKind>("movement");
  const [showTemplates,setShowTemplates]=useState(false);
  const [preview,setPreview]=useState<Preview|null>(null);
  const [campaign,setCampaign]=useState<Campaign|null>(null);
  const busy=useRef(false);
  const reload=useCallback(async()=>{
    const result=await getWhatsAppMovementCampaignAction();
    if(result.ok) setCampaign((result.campaign || null) as Campaign|null);
  },[]);

  useEffect(()=>{
    if(!allowed)return;
    void reload();
    const timer=window.setInterval(()=>{if(document.visibilityState==='visible')void reload();},15000);
    return()=>window.clearInterval(timer);
  },[allowed,reload]);

  // Server claims are atomic; one message per 45+ seconds, and never retries unknown delivery.
  // Unlike WA.Auto's dedicated server worker, this loop requires the terminal tab to stay open.
  useEffect(()=>{
    if(!allowed||!campaign||campaign.status!=='running')return;
    let alive=true;let timer:number|undefined;
    const tick=async()=>{
      if(!alive)return;
      if(document.visibilityState==='visible'&&!busy.current) {
        busy.current=true;setSending(true);
        try{
          const result=await advanceWhatsAppMovementCampaignAction(campaign.id);
          if(!alive)return;
          if(!result.ok&&result.error) {
            toast({title:"Fila de movimentações",description:result.error,variant:"destructive"});
          }
          await reload();
        }catch{
          if(alive)toast({title:"Falha de conexão com a fila",description:"Confira os envios antes de retomar.",variant:"destructive"});
        }finally{
          busy.current=false;
          if(alive)setSending(false);
        }
      }
      if(alive)timer=window.setTimeout(()=>void tick(),47000);
    };
    timer=window.setTimeout(()=>void tick(),900);
    return()=>{alive=false;if(timer!==undefined)window.clearTimeout(timer);};
  },[allowed,campaign?.id,campaign?.status,reload,toast]);

  if(!allowed)return null;

  const inspect=async(selectedKind:CampaignKind)=>{
    setKind(selectedKind);setOpen(true);setLoading(true);setPreview(null);setShowTemplates(false);
    try{
      const result=await Promise.race([
        previewWhatsAppMovementCampaignAction(selectedKind),
        new Promise<never>((_,reject)=>window.setTimeout(()=>reject(new Error('A consulta demorou demais. Tente atualizar a prévia.')),25000)),
      ]);
      setPreview(result as Preview);
    }catch(e:any){setPreview({ok:false,error:e?.message||"Não foi possível consultar a carteira."});}
    finally{setLoading(false);}
  };

  const start=async()=>{
    if(!preview?.ok||!preview.counts?.eligible)return;
    setLoading(true);
    try{
      const result=await startWhatsAppMovementCampaignAction(true,kind);
      if(!result.ok){
        toast({title:"Campanha não iniciada",description:result.error,variant:"destructive"});
        return;
      }
      setOpen(false);
      toast({title:"Fila iniciada",description:`${result.total} avisos preparados. Envio gradual pela sessão WA.Auto conectada.`});
      await reload();
    }catch(e:any){
      toast({title:"Erro ao iniciar fila",description:e?.message,variant:"destructive"});
    }finally{setLoading(false);}
  };

  const change=async(action:'pause'|'resume'|'cancel')=>{
    if(!campaign)return;
    if(action==='cancel'&&!window.confirm("Cancelar todos os avisos ainda não enviados? Os já enviados permanecerão no histórico."))return;
    setLoading(true);
    try {
      const result=await changeWhatsAppMovementCampaignAction(campaign.id,action);
      if(!result.ok)toast({title:"Não foi possível atualizar a fila",description:result.error,variant:"destructive"});
      await reload();
    }finally{setLoading(false);}
  };

  const pending=campaign?(campaign.pending_count??Math.max(0,campaign.total-campaign.sent_count-campaign.failed_count-campaign.uncertain_count)):0;
  const hasActive=campaign&&(campaign.status==='running'||campaign.status==='paused');
  return (
    <>
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        <Button type="button" onClick={()=>void inspect("movement")} size="sm"
          className="h-9 gap-1.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 text-[11px] font-bold">
          <BellRing size={14}/><span className="hidden sm:inline">Avisar última movimentação</span><span className="sm:hidden">Avisos</span>
        </Button>
        <Button type="button" onClick={()=>void inspect("publication")} size="sm"
          className="h-9 gap-1.5 rounded-xl border border-primary/30 bg-primary/10 text-foreground hover:bg-primary/20 text-[11px] font-bold">
          <FileClock size={14}/><span className="hidden sm:inline">Avisar publicações pendentes</span><span className="sm:hidden">Publicações</span>
        </Button>
        {campaign&&(
          <div className="flex max-w-full items-center gap-1.5 rounded-xl border border-border bg-card px-2 py-1 text-[10px]">
            <span className="truncate max-w-[170px]" title={campaign.status}>
              {campaign.campaign_kind==='publication'?'Publicações · ':'Movimentos · '}
              {campaign.status==='running'?'Enviando':campaign.status==='paused'?'Pausado':campaign.status==='completed'?'Concluído':'Cancelado'}:
              {" "}{campaign.sent_count}/{campaign.total}
              {campaign.review_count?` · ${campaign.review_count} em conferência`:''}
            </span>
            {sending?<Loader2 size={12} className="animate-spin text-primary"/>:null}
            {hasActive&&(
              <>
                <Button size="icon" variant="ghost" className="h-7 w-7" disabled={loading} title={campaign.status==='running'?'Pausar':'Continuar'} onClick={()=>void change(campaign.status==='running'?'pause':'resume')}>
                  {campaign.status==='running'?<Pause size={13}/>:<Play size={13}/>}
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" disabled={loading} title="Cancelar pendentes" onClick={()=>void change('cancel')}><Square size={12}/></Button>
              </>
            )}
            <Button size="icon" variant="ghost" className="h-7 w-7" title="Atualizar progresso" onClick={()=>void reload()}><RefreshCcw size={12}/></Button>
          </div>
        )}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[min(96vw,660px)] max-h-[min(90dvh,820px)] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base"><BellRing size={18}/> {kind==='publication'?'Avisar novidades pendentes da carteira':'Avisar clientes — última movimentação'}</DialogTitle>
            <DialogDescription>
              {kind==='publication'
                ? 'Considera toda a carteira da empresa, de todos os responsáveis. Envia apenas para processos abertos com movimentação DataJud/DJEN posterior ao último retorno marcado. Eventos antigos e processos encerrados são excluídos.'
                : 'Consulta toda a carteira da empresa. Prepara um aviso somente quando há movimentação posterior ao último retorno, excluindo encerrados, bloqueados e avisos já registrados.'}
            </DialogDescription>
          </DialogHeader>
          {loading&&!preview?<div className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><Loader2 className="animate-spin" size={18}/> Conferindo todos os processos...</div>:null}
          {preview&&!preview.ok?<p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{preview.error}</p>:null}
          {preview?.ok&&preview.counts?(
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  ["Processos",preview.counts.scanned],
                  ["Aptos",preview.counts.eligible],
                  ["Sem telefone",preview.counts.withoutPhone],
                  ["Sem evento válido",preview.counts.withoutEvent],
                ].map(([title,value])=>(
                  <div key={String(title)} className="rounded-xl border bg-muted/30 px-3 py-2">
                    <div className="text-[11px] text-muted-foreground">{title}</div>
                    <strong className="text-lg tabular-nums">{value}</strong>
                  </div>
                ))}
              </div>
              <div className="text-xs text-muted-foreground">
                {preview.counts.blocked} bloqueados/não contatar; {preview.counts.alreadyQueued} já preparados ou enviados (não duplicar).
                {(
                  <div className="mt-2 space-y-1 rounded-xl border bg-muted/40 p-3 text-xs">
                    <p><strong>{preview.counts.alreadyClosed||0}</strong> já encerrados na carteira (excluídos)</p>
                    <p><strong>{preview.counts.consentMissing||0}</strong> sem autorização expressa de WhatsApp (excluídos)</p>
                    <p><strong>{preview.counts.noNewMovement||0}</strong> sem novidade após o último retorno (excluídos)</p>
                    <p><strong>{preview.counts.missingReturn||0}</strong> sem data de último retorno para comparar</p>
                    <p><strong>{preview.counts.needsReview||0}</strong> aguardando conferência do teor oficial ou situação atual do processo (não enviados)</p>
                    <p><strong>{preview.counts.alreadyNotified||0}</strong> com aviso posterior ao evento registrado (excluídos)</p>
                    <p>Sem aviso no banco <strong>não comprova</strong> que o cliente nunca foi avisado em outro WhatsApp ou ligação.</p>
                  </div>
                )}
              </div>
              <div className="rounded-xl border border-border overflow-hidden">
                <div className="bg-muted/50 px-3 py-2 text-xs font-bold">Prévia individualizada — até 5 exemplos</div>
                <div className="max-h-[220px] overflow-y-auto divide-y divide-border">
                  {(preview.samples||[]).map((item,i)=>(
                    <div key={i} className="px-3 py-2">
                      <div className="text-xs font-semibold">{item.client} · {item.cnj}</div>
                      <div className="text-[11px] text-muted-foreground">{item.source} · {new Date(item.date).toLocaleDateString('pt-BR')}{item.kind?' · '+item.kind:''}{item.verdict?' · mérito: '+item.verdict:''}</div>
                      <p className="mt-1 whitespace-pre-wrap text-xs line-clamp-4">{item.message}</p>
                    </div>
                  ))}
                </div>
              </div>
              {kind==='publication' ? (
                <div className="space-y-2 rounded-xl border border-border bg-muted/20 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold">5 modelos por tipo de publicação</p>
                      <p className="text-[11px] text-muted-foreground">Rascunhos internos com variáveis automáticas, não modelos aprovados pela Meta.</p>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={()=>setShowTemplates(x=>!x)}>
                      {showTemplates?'Ocultar modelos':'Ver os 5 modelos'}
                    </Button>
                  </div>
                  {showTemplates&&(
                    <div className="max-h-72 space-y-2 overflow-y-auto">
                      {PUBLICATION_TEMPLATE_PREVIEWS().map((template)=>(
                        <div key={template.kind} className="rounded-lg border border-border bg-background p-3">
                          <p className="text-xs font-bold">{template.title} · {template.verdict.replace('_',' ')}</p>
                          <p className="mt-2 whitespace-pre-wrap text-[11px] leading-relaxed">{template.message}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    O consentimento contratual confirmado para esta carteira vale para a automação. Bloqueios e pedidos de SAIR sempre impedem o envio. O comunicado informa o andamento salvo, sem presumir resultado de julgamento.
                  </p>
                </div>
              ) : null}
              <p className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3 text-xs text-foreground">
                Envio sem confirmação repetitiva: ao iniciar, o gestor utiliza a autorização contratual
                declarada para a carteira desta empresa. O sistema ainda exclui números inválidos,
                processos encerrados, retornos sem novidade e contatos com recusa expressa ou SAIR.
              </p>
              <p className="text-[11px] text-muted-foreground">
                {kind==='publication'
                  ? 'Publicações: até 25 mensagens por dia, intervalo mínimo de 3 minutos, só em horário comercial de dias úteis, no máximo uma por número a cada 24h. Esses controles não garantem ausência de bloqueio; a política do WhatsApp e os modelos aprovados quando exigidos continuam obrigatórios.'
                  : 'Última movimentação: intervalo mínimo de 45 segundos, com limite de 120 mensagens confirmadas por empresa/dia.'}
                {' '}A fila fica gravada no Supabase e o envio continua pelo servidor.
                O agendador processa a fila em segundo plano; resultados incertos pausam para conferência.
              </p>
              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="outline" onClick={()=>setOpen(false)}>Cancelar</Button>
                <Button onClick={()=>void start()} disabled={loading||!preview.counts.eligible||campaign?.status==='running'}>
                  {loading?<Loader2 size={14} className="mr-2 animate-spin"/>:<Send size={14} className="mr-2"/>}
                  {'Iniciar envio sequencial de '}{preview.counts.eligible} avisos
                </Button>
              </div>
              {campaign?.status==='running'&&<p className="text-xs text-amber-700 dark:text-amber-300">Pause ou conclua a fila em andamento antes de iniciar uma nova.</p>}
            </div>
          ):null}
        </DialogContent>
      </Dialog>
    </>
  );
}
