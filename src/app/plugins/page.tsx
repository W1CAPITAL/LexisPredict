
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bot, BrainCircuit, CheckCircle2, CircleOff, FileSearch, FlaskConical,
  Globe2, Image as ImageIcon, Loader2, Monitor, Puzzle, RefreshCw,
  ShieldCheck, Wrench
} from "lucide-react";

type PluginStatus = {
  manifest: {
    id: string;
    name: string;
    version: string;
    description: string;
    category: string;
    runtime: string;
    permissions: string[];
    sourceRepos: string[];
    optional: boolean;
    actions: string[];
  };
  configured: boolean;
  enabled: boolean;
  reason?: string;
};

const categoryIcon: Record<string, React.ComponentType<{ className?: string }>> = {
  memory: BrainCircuit,
  research: FileSearch,
  media: ImageIcon,
  automation: RefreshCw,
  simulation: FlaskConical,
  world: Globe2,
  documents: FileSearch,
  agents: Bot,
  context: Monitor,
  developer: Wrench,
};

export default function PluginsPage() {
  const [plugins, setPlugins] = useState<PluginStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("all");
  const [agentGoal, setAgentGoal] = useState("");
  const [agentTeam, setAgentTeam] = useState<any>(null);
  const [agentBusy, setAgentBusy] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/plugins", { cache: "no-store" });
      const json = await res.json();
      setPlugins(Array.isArray(json?.plugins) ? json.plugins : []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const categories = useMemo(
    () => ["all", ...Array.from(new Set(plugins.map((item) => item.manifest.category))).sort()],
    [plugins],
  );

  const visible = useMemo(
    () => plugins.filter((item) => category === "all" || item.manifest.category === category),
    [plugins, category],
  );

  const configured = plugins.filter((item) => item.configured).length;
  const optional = plugins.filter((item) => item.manifest.optional).length;

  async function planTeam() {
    if (!agentGoal.trim()) return;
    setAgentBusy(true);
    setAgentTeam(null);
    try {
      const res = await fetch("/api/plugins", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          pluginId: "agent-studio",
          action: "plan-team",
          input: { goal: agentGoal },
        }),
      });
      const json = await res.json();
      setAgentTeam(json?.ok ? json.data : json);
    } finally {
      setAgentBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f4f7fb] px-4 py-6 text-[#102447] md:px-8 md:py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-3xl border border-[#dce6f2] bg-[linear-gradient(135deg,#071d35,#0b3156_62%,#14558d)] p-6 text-white shadow-[0_20px_55px_rgba(7,33,61,.18)] md:p-8">
          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[.16em]">
                <Puzzle className="h-4 w-4" /> Plugin Platform
              </div>
              <h1 className="mt-3 text-3xl font-black tracking-tight">Plugin Hub</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#cee3f6]">
                Capacidades internas e sidecars externos com ações allowlisted, permissões explícitas e configuração separada.
                Nenhum plugin executa código remoto arbitrário dentro do LexisPredict.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Metric label="Plugins" value={plugins.length} />
              <Metric label="Ativos" value={configured} />
              <Metric label="Opcionais" value={optional} />
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-[#dce6f2] bg-white p-3 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            {categories.map((item) => (
              <button
                key={item}
                onClick={() => setCategory(item)}
                className={"rounded-xl px-3 py-2 text-xs font-bold transition " + (
                  category === item
                    ? "bg-[#1769ff] text-white"
                    : "bg-[#eef3f9] text-[#58718f] hover:bg-[#e4edf8]"
                )}
              >
                {item === "all" ? "Todos" : item}
              </button>
            ))}
            <button
              onClick={() => void load()}
              className="ml-auto inline-flex items-center gap-2 rounded-xl border border-[#d6e1ed] px-3 py-2 text-xs font-bold text-[#45617f]"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Atualizar
            </button>
          </div>
        </section>

        <section className="rounded-3xl border border-[#dce6f1] bg-white p-5 shadow-[0_12px_36px_rgba(15,48,84,.06)] md:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eef4ff] text-[#1769ff]">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-black">Agent Studio</h2>
              <p className="mt-1 text-xs leading-5 text-[#687e98]">
                Descreva um objetivo e o orquestrador monta o menor time especializado com ferramentas e gates.
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-2 md:flex-row">
            <input
              value={agentGoal}
              onChange={(e) => setAgentGoal(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void planTeam()}
              placeholder="Ex.: pesquisar fontes, simular cenários e implementar uma tela"
              className="h-11 min-w-0 flex-1 rounded-xl border border-[#d8e3ef] px-3 text-sm outline-none focus:border-[#1769ff]"
            />
            <button
              onClick={() => void planTeam()}
              disabled={agentBusy || !agentGoal.trim()}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#0d3157] px-4 text-sm font-bold text-white disabled:opacity-50"
            >
              {agentBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
              Planejar equipe
            </button>
          </div>
          {agentTeam?.roles ? (
            <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {agentTeam.roles.map((role: any) => (
                <div key={role.id} className="rounded-xl border border-[#e0e8f1] bg-[#f8fafc] p-3">
                  <p className="text-xs font-black">{role.label}</p>
                  <p className="mt-1 text-[11px] leading-5 text-[#647a94]">{role.mission}</p>
                  <p className="mt-2 text-[10px] font-semibold text-[#476687]">{role.tools.join(" · ")}</p>
                </div>
              ))}
            </div>
          ) : null}
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((item) => {
            const Icon = categoryIcon[item.manifest.category] || Puzzle;
            return (
              <article
                key={item.manifest.id}
                className="rounded-2xl border border-[#dfe7f1] bg-white p-5 shadow-[0_10px_30px_rgba(15,48,84,.05)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#edf4ff] text-[#1769ff]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className={"inline-flex items-center gap-1 rounded-full px-2 py-1 text-[9px] font-black uppercase " + (
                    item.enabled ? "bg-[#e8f8ef] text-[#157a47]" : "bg-[#fff2df] text-[#986312]"
                  )}>
                    {item.enabled ? <CheckCircle2 className="h-3 w-3" /> : <CircleOff className="h-3 w-3" />}
                    {item.enabled ? "ativo" : "não configurado"}
                  </span>
                </div>

                <div className="mt-4">
                  <div className="flex items-baseline justify-between gap-2">
                    <h2 className="font-black">{item.manifest.name}</h2>
                    <span className="text-[10px] font-bold text-[#7890aa]">v{item.manifest.version}</span>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-[#627892]">{item.manifest.description}</p>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 text-[10px]">
                  <DataBadge label="runtime" value={item.manifest.runtime} />
                  <DataBadge label="categoria" value={item.manifest.category} />
                </div>

                <div className="mt-4">
                  <p className="text-[10px] font-black uppercase tracking-[.12em] text-[#7a8ea7]">Ações</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {item.manifest.actions.map((action) => (
                      <span key={action} className="rounded-lg bg-[#f0f4f9] px-2 py-1 text-[10px] font-semibold text-[#526b88]">
                        {action}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-4">
                  <p className="text-[10px] font-black uppercase tracking-[.12em] text-[#7a8ea7]">Permissões</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {item.manifest.permissions.map((permission) => (
                      <span key={permission} className="inline-flex items-center gap-1 rounded-lg border border-[#e0e7ef] px-2 py-1 text-[10px] font-semibold text-[#536b86]">
                        <ShieldCheck className="h-3 w-3" />
                        {permission}
                      </span>
                    ))}
                  </div>
                </div>

                <details className="mt-4 rounded-xl border border-[#e2e9f1] bg-[#f8fafc]">
                  <summary className="cursor-pointer px-3 py-2 text-[11px] font-bold text-[#4e6886]">Fontes e configuração</summary>
                  <div className="space-y-2 border-t border-[#e6edf4] px-3 py-3 text-[10px] text-[#617792]">
                    {item.manifest.sourceRepos.map((source) => (
                      <p key={source} className="break-all font-mono">{source}</p>
                    ))}
                    {item.reason ? (
                      <p className="rounded-lg bg-[#fff5e6] p-2 font-semibold text-[#8b611d]">{item.reason}</p>
                    ) : null}
                  </div>
                </details>
              </article>
            );
          })}
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-20 rounded-2xl border border-white/15 bg-white/10 px-3 py-3 text-center">
      <p className="text-2xl font-black">{value}</p>
      <p className="mt-1 text-[9px] font-bold uppercase tracking-[.12em] text-[#bed6ec]">{label}</p>
    </div>
  );
}

function DataBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[#f1f5fa] px-3 py-2">
      <p className="font-bold uppercase tracking-[.1em] text-[#8a9bad]">{label}</p>
      <p className="mt-1 font-black text-[#3b5878]">{value}</p>
    </div>
  );
}
