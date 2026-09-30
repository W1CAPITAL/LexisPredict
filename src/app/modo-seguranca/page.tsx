"use client";

import {useEffect,useState} from "react";
import {useRouter} from "next/navigation";
import {listSafetyCarteiraAction} from "@/app/actions/safety-carteira-actions";
import {safetyLogoutAction} from "@/app/actions/safety-mode-actions";

type Row={
  protocolo?:string;
  cliente?:string;
  status?:string;
  atendente?:string;
  created_by?:string;
  tribunal?:string;
  ultimoRetorno?:string;
  proximoPrazo?:string;
};

export default function ModoSegurancaPage(){
  const router=useRouter();
  const [rows,setRows]=useState<Row[]>([]);
  const [meta,setMeta]=useState("");
  const [identity,setIdentity]=useState("");
  const [err,setErr]=useState("");
  const [loading,setLoading]=useState(true);

  async function load(){
    setLoading(true);
    try{
      const res=await listSafetyCarteiraAction();
      if(!res.ok&&res.error==="Sessão de contingência expirada."){
        router.replace("/login");
        return;
      }
      setRows((res.rows||[]) as Row[]);
      setIdentity([res.nome,res.perfil].filter(Boolean).join(" · "));
      setMeta(String(res.totalVisivel||0)+" visíveis · "+String(res.totalPlanilha||0)+" na planilha");
      setErr(res.ok?"":(res.error||"A planilha não respondeu."));
    }catch(e:any){
      setErr(e?.message||"Falha ao abrir a carteira de contingência.");
    }finally{
      setLoading(false);
    }
  }

  useEffect(()=>{void load()},[]);

  return (
    <main className="min-h-screen bg-slate-950 p-3 text-slate-50 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-4">
        <header className="flex flex-col gap-3 rounded-2xl border border-amber-400/25 bg-slate-900/80 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.2em] text-amber-300">Modo de contingência</p>
            <h1 className="mt-1 text-xl font-black">Carteira pela planilha</h1>
            <p className="mt-1 text-xs text-slate-400">{identity||"Sessão temporária"}{meta?" · "+meta:""}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={()=>void load()} className="rounded-xl border border-white/15 px-3 py-2 text-xs font-bold">Atualizar</button>
            <button type="button" onClick={async()=>{await safetyLogoutAction();router.replace("/login")}} className="rounded-xl bg-white px-3 py-2 text-xs font-black text-slate-950">Sair</button>
          </div>
        </header>

        <div className="rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-xs leading-relaxed text-amber-100">
          Superfície isolada de emergência. Ela consulta apenas a carteira autorizada na planilha e não libera o restante do aplicativo sem autenticação principal.
        </div>

        {loading?<p className="text-sm text-slate-400">Carregando carteira…</p>:null}
        {err?<div className="rounded-xl border border-red-400/25 bg-red-400/10 p-3 text-sm text-red-100">{err}</div>:null}

        <div className="overflow-x-auto rounded-2xl border border-white/10 bg-slate-900">
          <table className="min-w-[900px] w-full text-left text-sm">
            <thead className="bg-white/5 text-[10px] uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-3 py-3">Assistente</th>
                <th className="px-3 py-3">Cliente</th>
                <th className="px-3 py-3">Protocolo</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Tribunal</th>
                <th className="px-3 py-3">Retorno</th>
                <th className="px-3 py-3">Próximo</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0,1000).map((r,i)=>(
                <tr key={String(r.protocolo||i)} className="border-t border-white/10">
                  <td className="px-3 py-3">{r.atendente||r.created_by||"—"}</td>
                  <td className="px-3 py-3">{r.cliente||"—"}</td>
                  <td className="px-3 py-3 font-mono text-xs">{r.protocolo||"—"}</td>
                  <td className="px-3 py-3">{r.status||"—"}</td>
                  <td className="px-3 py-3">{r.tribunal||"—"}</td>
                  <td className="px-3 py-3">{r.ultimoRetorno||"—"}</td>
                  <td className="px-3 py-3">{r.proximoPrazo||"—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
