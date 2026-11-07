'use client';
import Link from 'next/link';
import { useEffect,useState } from 'react';
type Model={id:string;label:string;provider:string;durations:string[];ratios:string[]};
type Status={configured:boolean;ready:boolean;generationEnabled:boolean;error?:string;models:Model[]};
type Task={taskId:string;status:string;readyToDownload:boolean;recoveryRequired:boolean;error?:string};
export default function HiggsfieldStudio(){
  const [status,setStatus]=useState<Status|null>(null);
  const [modelId,setModelId]=useState('');
  const [prompt,setPrompt]=useState('');
  const [duration,setDuration]=useState('');
  const [ratio,setRatio]=useState('9:16');
  const [taskId,setTaskId]=useState('');
  const [task,setTask]=useState<Task|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  useEffect(()=>{fetch('/api/media/open-higgsfield',{cache:'no-store'})
    .then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error||'Sem permissão.');return d as Status;})
    .then(d=>{setStatus(d);setModelId(d.models?.[0]?.id||'');})
    .catch(e=>setError(e instanceof Error?e.message:'Estúdio indisponível.'));},[]);
  const model=status?.models?.find(x=>x.id===modelId);
  const canSubmit=!!(status?.ready&&status.generationEnabled&&modelId&&prompt.trim().length>=3&&!busy);
  async function create(){
    if(!canSubmit)return;
    setBusy(true);setError('');setTask(null);
    try{
      const res=await fetch('/api/media/open-higgsfield',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({modelId,prompt,duration:duration||undefined,
          aspectRatio:model?.ratios.includes(ratio)?ratio:undefined})});
      const d=await res.json();if(!res.ok)throw Error(d.error||'Geração não confirmada.');
      setTaskId(d.taskId);
    }catch(e){setError(e instanceof Error?e.message:'Geração não iniciada.');}
    finally{setBusy(false);}
  }
  async function refresh(){
    if(!taskId)return;setBusy(true);setError('');
    try{
      const res=await fetch('/api/media/open-higgsfield?task_id='+encodeURIComponent(taskId),{cache:'no-store'});
      const d=await res.json();if(!res.ok)throw Error(d.error||'Não foi possível consultar.');
      setTask(d);
    }catch(e){setError(e instanceof Error?e.message:'Consulta indisponível.');}
    finally{setBusy(false);}
  }
  return <main className="min-h-screen bg-[#0c1018] px-4 py-8 text-white md:px-8">
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/ai-lab" className="text-sm text-[#f0b2cd]">← Voltar ao AI Lab</Link>
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[.2em] text-[#cf93b1]">W1 Capital · Estúdio privado</p>
        <h1 className="text-3xl font-semibold">Open-Higgsfield</h1>
        <p className="text-sm text-slate-300">Gere cenas para Reels. Demonstrações comerciais devem utilizar também gravações reais dos projetos.</p>
      </header>
      <section className="space-y-5 rounded-2xl border border-white/15 bg-white/[.05] p-5">
        <p role="status" className="text-sm text-slate-300">
          {!status?'Verificando configuração…':status.ready?
            (status.generationEnabled?'Estúdio conectado. Cada geração pode consumir créditos do provedor.':'Estúdio conectado em modo somente leitura.'):
            status.error||'Estúdio não configurado.'}
        </p>
        <div className="space-y-2">
          <label htmlFor="higgs-model" className="text-sm">Modelo de vídeo</label>
          <select id="higgs-model" className="w-full rounded-lg bg-[#1c2330] p-3" value={modelId}
            onChange={e=>{setModelId(e.target.value);setDuration('');}}>
            {!status?.models?.length?<option value="">Nenhum provedor conectado</option>:
              status.models.map(m=><option key={m.id} value={m.id}>{m.label} · {m.provider}</option>)}
          </select>
        </div>
        <div className="space-y-2">
          <label htmlFor="higgs-prompt" className="text-sm">Cena desejada</label>
          <textarea id="higgs-prompt" className="min-h-32 w-full rounded-lg bg-[#1c2330] p-3"
            maxLength={2500} value={prompt} onChange={e=>setPrompt(e.target.value)}
            placeholder="Ex.: câmera acompanhando uma pessoa navegando em um site real; iluminação natural, cortes dinâmicos, sem textos gerados na imagem"/>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label htmlFor="higgs-duration" className="mb-2 block text-sm">Duração</label>
            <select id="higgs-duration" className="w-full rounded-lg bg-[#1c2330] p-3" value={duration} onChange={e=>setDuration(e.target.value)}>
              <option value="">Padrão do modelo</option>
              {(model?.durations||[]).map(d=><option key={d} value={d}>{d} s</option>)}
            </select></div>
          <div><label htmlFor="higgs-ratio" className="mb-2 block text-sm">Formato</label>
            <select id="higgs-ratio" className="w-full rounded-lg bg-[#1c2330] p-3" value={ratio} onChange={e=>setRatio(e.target.value)}>
              <option value="9:16">9:16 · Reel</option><option value="16:9">16:9</option><option value="1:1">1:1</option>
            </select></div>
        </div>
        <button disabled={!canSubmit} type="button" onClick={()=>void create()}
          className="w-full rounded-lg bg-[#9f3359] px-5 py-3 font-medium text-white disabled:opacity-40">
          {busy?'Processando…':'Gerar vídeo'}
        </button>
        <p className="text-xs text-slate-400">Só gera após o clique. Não há repetição automática de tarefas nem envio de dados sigilosos.</p>
      </section>
      {taskId&&<section className="space-y-3 rounded-2xl border border-white/15 p-5">
        <p className="text-sm text-slate-300">Tarefa: <code className="break-all">{taskId}</code></p>
        <button disabled={busy} type="button" onClick={()=>void refresh()} className="rounded-lg border border-white/30 px-4 py-2 text-sm disabled:opacity-40">Consultar resultado</button>
        {task&&<p role="status" className="text-sm">Status: {task.status}{task.recoveryRequired?' · verifique antes de reenviar':''}</p>}
        {task?.readyToDownload&&<a className="inline-block rounded-lg bg-[#9f3359] px-4 py-2 text-sm"
          href={'/api/media/open-higgsfield/download?task_id='+encodeURIComponent(taskId)}>Baixar vídeo</a>}
      </section>}
      {error&&<p role="alert" className="rounded-xl border border-red-500/30 bg-red-950/30 p-3 text-sm text-red-200">{error}</p>}
    </div>
  </main>;
}