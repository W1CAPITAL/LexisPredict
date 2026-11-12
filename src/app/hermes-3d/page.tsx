"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { HermesCaseHealth } from "@/lib/hermes-company-intelligence";
import {parseHermesMeetingTranscript,type HermesOfficeIntelligence} from "@/lib/hermes-company-intelligence";
import type { HermesOfficeDailyRow,HermesRebuildRun,HermesStalledSummary,HermesPortfolioCaseSummary } from "@/lib/hermes-company-service";
import Link from "next/link";
import {
  ArrowLeft, ArrowRight, Bot, Boxes, ChevronLeft, ChevronRight,
  ExternalLink, Grid2X2, Info, Minus, Plus, RotateCcw,
  ShieldCheck, Sparkles
} from "lucide-react";
import { getHermesOfficeStations } from "@/lib/hermes-office";
import {hermesOfficeEventClock,type HermesOfficeEvent} from "@/lib/hermes-agent-route";
import {HermesRoamingRobots} from "@/components/hermes/hermes-roaming-robots";
import {HermesActivityLog} from "@/components/hermes/hermes-activity-log";
import {HermesRebuildPanel} from "@/components/hermes/hermes-rebuild-panel";
import {HermesPortfolioReport} from "@/components/report/hermes-portfolio-report";
import type {HermesPortfolioDiagnostics} from "@/lib/hermes-diagnostics-policy";
import {HermesExport} from "@/components/hermes/hermes-export";
import { HermesPriorityQueue } from "@/components/hermes/hermes-priority-queue";
import { HermesCompanyPanel } from "@/components/hermes/hermes-company-panel";
import {HermesStalledMonitoring} from "@/components/hermes/hermes-stalled-monitoring";
import {HermesPortfolioMonitoring} from '@/components/hermes/hermes-portfolio-monitoring';
import {HermesTjPortalGrid} from '@/components/hermes/hermes-tj-portal-grid';
import "./hermes-office.css";

type ViewMode = "3d" | "2d";

export default function Hermes3DLexisPage() {
  const stations = useMemo(() => getHermesOfficeStations(), []);
  const [selectedId, setSelectedId] = useState("agentes");
  const [view, setView] = useState<ViewMode>("3d");
  const [rotation, setRotation] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [lowPower, setLowPower] = useState(false);
  const [office, setOffice] = useState<HermesOfficeIntelligence|null>(null);
  const [officeRecord, setOfficeRecord] = useState<HermesOfficeDailyRow|null>(null);
  const [officeCases,setOfficeCases] = useState<HermesCaseHealth[]>([]);
  const [stalledCases,setStalledCases] = useState<HermesStalledSummary[]>([]);
  const [portfolioScans,setPortfolioScans] = useState<HermesPortfolioCaseSummary[]>([]);
  const [officeEvents,setOfficeEvents] = useState<HermesOfficeEvent[]>([]);
  const [rebuildRuns,setRebuildRuns]=useState<HermesRebuildRun[]>([]);
  const [diagnostics,setDiagnostics]=useState<HermesPortfolioDiagnostics|null>(null);
  const [showDiagnostics,setShowDiagnostics]=useState(false);
  const [replayMeeting,setReplayMeeting] = useState(false);
  const [meetingTurn,setMeetingTurn] = useState(0);
  const [officeError, setOfficeError] = useState("");
  const [meetingBusy,setMeetingBusy]=useState(false);

  async function refreshOffice(signal?:AbortSignal) {
    try {
      const res = await fetch('/api/hermes-office',{cache:'no-store',credentials:'same-origin',signal});
      const data = await res.json();
      if(!res.ok||!data.ok)throw Error(data.error||'Não foi possível atualizar o escritório.');
      if(!signal?.aborted){setOffice(data.intelligence||null);setOfficeRecord(data.record||null);setOfficeCases(Array.isArray(data.cases)?data.cases:[]);setStalledCases(Array.isArray(data.stalled)?data.stalled:[]);setPortfolioScans(Array.isArray(data.portfolioScans)?data.portfolioScans:[]);setOfficeEvents(Array.isArray(data.events)?data.events:[]);setRebuildRuns(Array.isArray(data.rebuild)?data.rebuild:[]);setDiagnostics(data.diagnostics||null);setOfficeError("");}
    }catch(e){
      if(!signal?.aborted)setOfficeError(e instanceof Error?e.message:'Acesso temporariamente indisponível.');
    }
  }
  async function requestMeeting(){
    if(meetingBusy)return;
    setMeetingBusy(true);setOfficeError("");
    try{
      const response=await fetch('/api/hermes-office',{method:'POST',credentials:'same-origin'});
      const data=await response.json();
      if(!response.ok||!data.ok)throw Error(data.error||'Não foi possível registrar a reunião.');
      await refreshOffice();
    }catch(e){setOfficeError(e instanceof Error?e.message:'Falha ao realizar reunião.');}
    finally{setMeetingBusy(false);}
  }

  useEffect(() => {
    if (window.matchMedia("(max-width: 767px), (prefers-reduced-motion: reduce)").matches) {
      setView("2d");
      setLowPower(true);
    }
  }, []);

  useEffect(()=>{
    const controller=new AbortController();
    void refreshOffice(controller.signal);
    const handle=window.setInterval(()=>{
      if(!document.hidden)void refreshOffice(controller.signal);
    },45000);
    return()=>{controller.abort();window.clearInterval(handle);};
  },[]);
  const selected = stations.find((station) => station.id === selectedId) || stations[0];
  const selectedDepartment=office?.departments.find(d=>d.id===selected?.id);
  const latestStationEvent=officeEvents.find(e=>e.sector===selected?.id);
  useEffect(()=>{
    if(!replayMeeting)return;
    const id=window.setInterval(()=>setMeetingTurn(n=>n+1),4800);
    return()=>window.clearInterval(id);
  },[replayMeeting]);
  const meetingLines=officeRecord?.meeting_status==='ready'&&officeRecord.meeting_note
    ?parseHermesMeetingTranscript(officeRecord.meeting_note)
    :(office?.meeting||[]);
  useEffect(()=>{
    if(replayMeeting&&meetingTurn>=meetingLines.length){setReplayMeeting(false);setMeetingTurn(0);}
  },[replayMeeting,meetingTurn,meetingLines.length]);
  const canReplay=meetingLines.length>0&&!!officeRecord?.meeting_note;
  const displayStyle = {
    "--h3d-rotation": `${rotation}deg`,
    "--h3d-zoom": zoom,
  } as CSSProperties;

  return (
    <main data-low-power={lowPower||view==='2d'?'true':'false'} className="h3d-page min-h-screen px-4 pb-24 pt-6 text-white md:px-8 md:pb-12">
      <div className="mx-auto max-w-[1500px] space-y-5">
        <header className="h3d-header flex flex-wrap items-center justify-between gap-4 rounded-3xl p-5 md:p-7">
          <div className="flex min-w-0 items-center gap-4">
            <div className="h3d-brand-icon shrink-0"><Boxes size={29} strokeWidth={1.7} /></div>
            <div>
              <p className="h3d-eyebrow">LEXISPREDICT / ESTÚDIO IMERSIVO</p>
              <h1 className="text-2xl font-black tracking-tight md:text-4xl">Hermes<span className="text-[#e4b8ca]">3D</span> <span className="font-light text-[#d4c8ce]">Office</span></h1>
              <p className="mt-1 max-w-2xl text-sm text-[#d6cbd0]">
                Uma empresa virtual com setores, reuniões e análises conectados aos registros reais — sem depender de GPU ou IA instalada no computador.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <HermesExport record={officeRecord} cases={officeCases} events={officeEvents} diagnostics={diagnostics}/>
            <button type="button" onClick={()=>setShowDiagnostics(s=>!s)} className="h3d-button" aria-expanded={showDiagnostics}>Relatório detalhado {showDiagnostics?"−":"+"}</button>
            <a href="#hermes-swarm-rebuild" className="h3d-button">Swarm Rebuild</a>
            <a href="#hermes-activity-log" className="h3d-button" title="Ver o histórico real dos agentes">
              <Bot className="h-4 w-4"/> Diário de execução
            </a>
            <Link href="/projetos" className="h3d-button h3d-button-muted">Entender os projetos</Link>
            <Link href="/estudio-agentes" className="h3d-button">
              <Bot className="h-4 w-4" /> Estúdio de Agentes
            </Link>
            <Link href="/" className="h3d-button h3d-button-muted">
              <ArrowLeft className="h-4 w-4" /> Dashboard
            </Link>
          </div>
        </header>

        <details className="rounded-2xl border border-white/20 bg-[#16151b] p-4" id="hermes-tribunais">
          <summary className="cursor-pointer text-sm font-bold text-white">Consulta por tribunal · 27 TJs · abrir portais oficiais</summary>
          <div className="mt-4 rounded-xl bg-background p-4">
            <HermesTjPortalGrid/>
          </div>
        </details>
        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="h3d-scene-shell min-w-0 overflow-hidden rounded-3xl">
            <div className="h3d-toolbar flex flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-5">
              <div className="flex items-center gap-2">
                <span className="h3d-status-dot" aria-hidden="true" />
                <span className="text-xs font-bold uppercase tracking-[.12em] text-[#e9dbe2]">Miniempresa Hermes · oito setores</span>
                <span className="rounded-full border border-[#b48a9c]/40 px-2 py-0.5 text-[10px] text-[#d4bac4]">Rondas ilustrativas · tarefas auditadas no log</span>
              </div>
              <div data-lexis-rebuild-tablist className="flex items-center gap-1 rounded-xl border border-white/10 bg-black/25 p-1" role="group" aria-label="Modo de visualização">
                <button type="button" className="h3d-toggle" data-lexis-rebuild-tab aria-controls="hermes-view-panel" aria-pressed={view === "3d"} onClick={() => setView("3d")}><Boxes size={15} /> 3D</button>
                <button type="button" className="h3d-toggle" data-lexis-rebuild-tab aria-controls="hermes-view-panel" aria-pressed={view === "2d"} onClick={() => setView("2d")}><Grid2X2 size={15} /> 2D</button>
                <button type="button" className="h3d-toggle" aria-pressed={replayMeeting} disabled={!canReplay} onClick={()=>{setMeetingTurn(0);setReplayMeeting(x=>!x)}} title="Reconstituição visual de uma reunião já registrada; não cria nova reunião com IA">Reproduzir reunião</button>
                <button type="button" className="h3d-toggle" aria-pressed={lowPower} onClick={()=>setLowPower(x=>!x)} aria-label="Modo econômico">Eco {lowPower?'ligado':'desligado'}</button>
              </div>
            </div>

            <div id="hermes-view-panel" data-lexis-rebuild-panel>
            {view === "3d" ? (
              <div className="h3d-viewport" aria-label="Escritório 3D interativo do LexisPredict">
                <div className="h3d-glow h3d-glow-left" aria-hidden="true" />
                <div className="h3d-glow h3d-glow-right" aria-hidden="true" />
                <div className="h3d-world" style={displayStyle}>
                  <div className="h3d-floor">
                    <div className="h3d-grid" aria-hidden="true" />
                    <div className="h3d-far-wall" aria-hidden="true" />
                    <div className="h3d-left-wall" aria-hidden="true" />
                    <div className="h3d-room-division h3d-room-top" aria-hidden="true"/>
                    <div className="h3d-room-division h3d-room-bottom" aria-hidden="true"/>
                    <div className="h3d-glass-partition" aria-hidden="true"/>
                    <div className="h3d-boardroom" data-meeting={officeRecord?.meeting_status==="ready"?"true":"false"} aria-hidden="true">
                      <span className="h3d-conference-table"><i/><b/></span>
                      <span className="h3d-conference-chair h3d-chair-n"/>
                      <span className="h3d-conference-chair h3d-chair-s"/>
                      <span className="h3d-conference-chair h3d-chair-w"/>
                      <span className="h3d-conference-chair h3d-chair-e"/>
                      <span className="h3d-meeting-monitor">CONSELHO</span>
                      <span className="h3d-meeting-bot h3d-meeting-bot-1"><i/><b/></span>
                      <span className="h3d-meeting-bot h3d-meeting-bot-2"><i/><b/></span>
                      <span className="h3d-meeting-bot h3d-meeting-bot-3"><i/><b/></span>
                    </div>
                    <div className="h3d-lounge" aria-hidden="true"><span className="h3d-sofa"/><span className="h3d-coffee"/><span className="h3d-plant"/></div>
                    <div className="h3d-reception" aria-hidden="true"><span>LEXIS</span><i/></div>
                    <div className="h3d-plant h3d-plant-n" aria-hidden="true"/>
                    <div className="h3d-plant h3d-plant-s" aria-hidden="true"/>
                    {stations.map((station) => (
                      <button
                        type="button"
                        key={station.id}
                        className="h3d-desk"
                        data-selected={selected?.id === station.id}
                        data-pending={(office?.departments.find(d=>d.id===station.id)?.workload||0)>0?'true':'false'}
                        onClick={() => setSelectedId(station.id)}
                        aria-pressed={selected?.id === station.id}
                        aria-label={`Selecionar setor: ${station.title}`}
                        style={{
                          left: `${station.x}%`,
                          top: `${station.y}%`,
                          "--h3d-accent": station.color,
                        } as CSSProperties}
                      >
                        <span className="h3d-desk-top"><span className="h3d-terminal"><span /><span /><span /></span></span>
                        <span className="h3d-desk-number">{station.glyph}</span>
                        <span className="h3d-desk-label">{station.title.split(' ').slice(0,2).join(' ')}</span>
                      </button>
                    ))}
                    <HermesRoamingRobots stations={stations} events={officeEvents} meetingReplay={replayMeeting}
                       eco={lowPower} select={setSelectedId}/>
                  </div>
                </div>
                <div className="h3d-scene-caption pointer-events-none absolute bottom-4 left-4 right-4 flex flex-wrap items-center justify-between gap-2">
                  <span><Sparkles size={14} /> Selecione um robô ou uma mesa. Movimento visual; as tarefas reais aparecem no histórico.</span>
                  <span>8 setores · robôs visuais em CSS 3D · IA no servidor</span>
                </div>
              </div>
            ) : (
              <div className="h3d-map-grid grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Mapa leve dos setores">
                {stations.map((station) => (
                  <button
                    type="button"
                    key={station.id}
                    className="h3d-flat-station text-left"
                    data-selected={selected?.id === station.id}
                    onClick={() => setSelectedId(station.id)}
                    aria-pressed={selected?.id === station.id}
                  >
                    <span className="h3d-flat-icon" style={{ borderColor: station.color, color: station.color }}><Bot size={21}/></span>
                    <span className="text-xs font-bold text-[#d8afbd]">ESTAÇÃO {station.glyph}</span>
                    <span className="mt-1 block text-sm font-semibold text-white">{station.title}</span>
                    <span className="mt-1 block text-xs text-[#cbbec6]">{station.specialist}</span>
                  </button>
                ))}
              </div>
            )}
            </div>

            <div className="h3d-controls flex flex-wrap items-center justify-between gap-2 px-4 py-3 md:px-5">
              <span className="flex items-center gap-2 text-xs text-[#c8b9c2]"><Info size={15} /> Mapa baseado nos playbooks existentes</span>
              <div className="flex items-center gap-1" role="group" aria-label="Controles da câmera">
                <button type="button" className="h3d-icon-button" disabled={view === "2d"} aria-label="Girar para a esquerda" onClick={() => setRotation((n) => Math.max(-24, n - 12))}><ChevronLeft size={18}/></button>
                <button type="button" className="h3d-icon-button" disabled={view === "2d"} aria-label="Girar para a direita" onClick={() => setRotation((n) => Math.min(24, n + 12))}><ChevronRight size={18}/></button>
                <button type="button" className="h3d-icon-button" disabled={view === "2d"} aria-label="Reduzir zoom" onClick={() => setZoom((n) => Math.max(0.75, Number((n - 0.1).toFixed(2))))}><Minus size={16}/></button>
                <span className="w-10 text-center text-xs tabular-nums text-[#e0d1d8]">{Math.round(zoom * 100)}%</span>
                <button type="button" className="h3d-icon-button" disabled={view === "2d"} aria-label="Aumentar zoom" onClick={() => setZoom((n) => Math.min(1.2, Number((n + 0.1).toFixed(2))))}><Plus size={16}/></button>
                <button type="button" className="h3d-icon-button" disabled={view === "2d"} aria-label="Redefinir câmera" onClick={() => { setRotation(0); setZoom(1); }}><RotateCcw size={15}/></button>
              </div>
            </div>
          </div>

          <aside className="h3d-details rounded-3xl p-5 md:p-6" aria-live="polite">
            {selected ? (
              <>
                <div className="flex items-start justify-between gap-3">
                  <span className="h3d-details-avatar" style={{ color: selected.color, borderColor: selected.color }}><Bot size={30} /></span>
                  <span className="rounded-full border border-[#c7b3bb]/25 bg-white/[.05] px-2.5 py-1 text-[10px] font-semibold text-[#e0cdd5]">SETOR MAPEADO</span>
                </div>
                <p className="mt-8 text-xs font-bold tracking-[.15em] text-[#ce99ad]">ESTAÇÃO {selected.glyph} · LEXIS OFFICE</p>
                <h2 className="mt-2 text-2xl font-extrabold leading-tight">{selected.title}</h2>
                <p className="mt-3 text-sm leading-6 text-[#d4c4cd]">{selected.description}</p>
                <p className="mt-2 text-xs leading-5 text-[#e7b8cc]">Projeto/setor: {selected.title}. Acesse a ferramenta abaixo para consultar a atividade concreta.</p>
                {latestStationEvent?<div className="mt-4 rounded-xl border border-[#c99eae]/40 bg-[#562c49]/30 p-3 text-xs text-[#f4dce8]">
                  <p className="font-bold">Última tarefa confirmada</p>
                  <p className="mt-1 font-semibold">{latestStationEvent.title}</p>
                  <p className="mt-1 text-[#d8c4cf]">{latestStationEvent.detail||'Sem informações adicionais.'}</p>
                  <p className="mt-1 text-[11px]">{hermesOfficeEventClock(latestStationEvent.recorded_at)} · {latestStationEvent.status==='working'?'Iniciada':latestStationEvent.status==='warning'?'Requer atenção':'Concluída'}</p>
                  <a href="#hermes-activity-log" className="mt-2 inline-block font-bold underline">Ver o diário de execução</a>
                </div>:<p className="mt-4 rounded-lg border border-white/10 bg-white/5 p-3 text-xs text-[#d8c4cf]">Nenhuma atividade recente confirmada neste setor. O robô apenas percorre visualmente o escritório.</p>}
                <div className="my-6 h-px bg-white/10" />
                <p className="text-xs font-bold uppercase tracking-wider text-[#c9a6b5]">Especialista recomendado</p>
                <p className="mt-2 text-base font-semibold">{selected.specialist}</p>
                {selectedDepartment&&<div className="mt-4 rounded-xl border border-white/10 bg-white/[.04] p-3 text-xs text-[#e6d6dd]">
                  <p className="font-extrabold text-[#f3c4d8]">Cargo: {selectedDepartment.role}</p>
                  <p className="mt-1">{selectedDepartment.mission}</p>
                  <p className="mt-2">{selectedDepartment.workload} registro(s) relacionados no painel — não representam execução simultânea.</p>
                </div>}
                <div className="mt-5 flex items-start gap-2 rounded-xl border border-white/10 bg-white/[.04] p-3 text-xs leading-5 text-[#e0d0d7]">
                  <ShieldCheck size={17} className="mt-0.5 shrink-0 text-[#d4b2c0]"/>
                  <span>{selected.requiresReview ? "Ações desta área exigem revisão humana." : "Leitura de dados e conferência sem executar alterações."} Esta tela não informa execução ou disponibilidade de agentes em tempo real.</span>
                </div>
                <Link href={selected.href} className="h3d-primary-link mt-6">
                  Abrir ferramenta <ArrowRight size={18}/>
                </Link>
                <p className="mt-3 text-center font-mono text-xs text-[#a99aa3]">{selected.href}</p>
              </>
            ) : (
              <p className="text-sm text-[#d9cdd5]">Não há setores configurados no catálogo de agentes.</p>
            )}
          </aside>
        </section>

        {replayMeeting&&meetingLines.length>0&&<section role="status" aria-live="polite" className="rounded-2xl border border-[#c99fb1]/40 bg-[#352032] p-4 text-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-[#e5b8ca]">Reprodução da reunião registrada · {Math.min(meetingTurn+1,meetingLines.length)} de {meetingLines.length}</p>
          <p className="mt-2 font-black">{meetingLines[Math.min(meetingTurn,meetingLines.length-1)].speaker}</p>
          <p className="mt-1 leading-6">{meetingLines[Math.min(meetingTurn,meetingLines.length-1)].text}</p>
          <p className="mt-2 text-xs text-[#cbb8c4]">Esta é uma reprodução dos achados salvos; não significa que a IA esteja processando agora.</p>
        </section>}
        <HermesActivityLog events={officeEvents} selectedSector={selectedId} onSelect={setSelectedId}/>
        <HermesPortfolioMonitoring items={portfolioScans}/>
        <HermesStalledMonitoring items={stalledCases}/>
        {showDiagnostics&&<HermesPortfolioReport data={diagnostics} compact/>}
        <HermesRebuildPanel runs={rebuildRuns} onRefresh={()=>refreshOffice()}/>
        <HermesCompanyPanel office={office} record={officeRecord} cases={officeCases} busy={meetingBusy} error={officeError} onRefresh={()=>void refreshOffice()} onMeeting={()=>void requestMeeting()} onReplayMeeting={()=>{setMeetingTurn(0);setReplayMeeting(x=>!x)}}/>
        <div>
          <HermesPriorityQueue/>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-[#cbbbc4]">
          <p>Miniempresa Hermes em CSS 3D, sem modelo local nem GPU dedicada · Indicadores e reuniões vinculados à base autorizada.</p>
          <a className="inline-flex items-center gap-1 underline decoration-white/20 underline-offset-4 hover:text-white" href="https://github.com/iamlukethedev/Hermes3D" target="_blank" rel="noopener noreferrer">
            Inspirado no Hermes3D (MIT) <ExternalLink size={12}/>
          </a>
        </footer>
      </div>
    </main>
  );
}
