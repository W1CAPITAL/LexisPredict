"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BrainCircuit,
  ExternalLink,
  FlaskConical,
  Image as ImageIcon,
  Loader2,
  Search,
  Sparkles,
  Video,
  Waves,
} from "lucide-react";

type Capability = {
  id: string;
  label: string;
  description: string;
  runtime: string;
  zeroToken: boolean;
  optional: boolean;
};

type Source = {
  repo: string;
  area: string;
  mode: string;
  purpose: string;
};

const DEFAULT_SIMULATION = JSON.stringify(
  {
    seed: "lexis-demo",
    iterations: 5000,
    options: [
      {
        id: "a",
        label: "Estratégia A",
        baseScore: 10,
        factors: [
          { name: "impacto", min: 1, likely: 3, max: 5, weight: 2 },
          { name: "custo", min: -4, likely: -2, max: -1, weight: 1 },
        ],
      },
      {
        id: "b",
        label: "Estratégia B",
        baseScore: 9,
        factors: [
          { name: "impacto", min: 2, likely: 3, max: 4, weight: 1.6 },
          { name: "custo", min: -3, likely: -1.5, max: -0.5, weight: 1 },
        ],
      },
    ],
  },
  null,
  2,
);

export default function AiLabPage() {
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [firecrawlConfigured, setFirecrawlConfigured] = useState(false);
  const [comfy, setComfy] = useState<any>(null);

  const [researchQuery, setResearchQuery] = useState("");
  const [researchBusy, setResearchBusy] = useState(false);
  const [researchResult, setResearchResult] = useState<any>(null);

  const [mediaKind, setMediaKind] = useState<"image" | "video">("image");
  const [mediaPrompt, setMediaPrompt] = useState("");
  const [mediaBusy, setMediaBusy] = useState(false);
  const [mediaResult, setMediaResult] = useState<any>(null);
  const [mediaHistory, setMediaHistory] = useState<any>(null);

  const [simulationText, setSimulationText] = useState(DEFAULT_SIMULATION);
  const [simulationBusy, setSimulationBusy] = useState(false);
  const [simulationResult, setSimulationResult] = useState<any>(null);

  useEffect(() => {
    void Promise.all([
      fetch("/api/ai/capabilities", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/research", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/media/comfy", { cache: "no-store" }).then((r) => r.json()),
    ]).then(([catalog, research, media]) => {
      setCapabilities(Array.isArray(catalog?.capabilities) ? catalog.capabilities : []);
      setSources(Array.isArray(catalog?.sources) ? catalog.sources : []);
      setFirecrawlConfigured(Boolean(research?.configured));
      setComfy(media);
    }).catch(() => {
      // Cada módulo continua utilizável separadamente se outro status falhar.
    });
  }, []);

  const byRuntime = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of capabilities) counts[item.runtime] = (counts[item.runtime] || 0) + 1;
    return counts;
  }, [capabilities]);

  async function runResearch() {
    if (!researchQuery.trim()) return;
    setResearchBusy(true);
    setResearchResult(null);
    try {
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "search", query: researchQuery, limit: 6 }),
      });
      setResearchResult(await res.json());
    } finally {
      setResearchBusy(false);
    }
  }

  async function runMedia() {
    if (!mediaPrompt.trim()) return;
    setMediaBusy(true);
    setMediaResult(null);
    setMediaHistory(null);
    try {
      const res = await fetch("/api/media/comfy", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: mediaKind,
          prompt: mediaPrompt,
          width: mediaKind === "image" ? 1024 : 1280,
          height: mediaKind === "image" ? 1024 : 720,
          frames: mediaKind === "video" ? 81 : 1,
        }),
      });
      setMediaResult(await res.json());
    } finally {
      setMediaBusy(false);
    }
  }

  async function refreshMedia() {
    const promptId = mediaResult?.promptId;
    if (!promptId) return;
    const res = await fetch(`/api/media/comfy?prompt_id=${encodeURIComponent(promptId)}`, { cache: "no-store" });
    setMediaHistory(await res.json());
  }

  async function runSimulation() {
    setSimulationBusy(true);
    setSimulationResult(null);
    try {
      const payload = JSON.parse(simulationText);
      const res = await fetch("/api/simulate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      setSimulationResult(await res.json());
    } catch (error: any) {
      setSimulationResult({ ok: false, error: error?.message || "JSON inválido" });
    } finally {
      setSimulationBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f4f7fb] px-4 py-6 text-[#102447] md:px-8 md:py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="overflow-hidden rounded-3xl border border-[#dce6f3] bg-[linear-gradient(135deg,#071d35_0%,#0b3156_60%,#124b80_100%)] p-6 text-white shadow-[0_20px_50px_rgba(4,30,58,.18)] md:p-8">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[.16em]">
                <BrainCircuit className="h-4 w-4" /> Cognitive Platform v4
              </div>
              <h1 className="text-3xl font-black tracking-tight md:text-4xl">AI Lab</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[#cfe3f7] md:text-base">
                Pesquisa, simulação e mídia generativa no mesmo núcleo de capacidades do LexisPredict.
                Motores pesados rodam fora do bundle principal e continuam opcionais.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <Metric label="Motores" value={capabilities.length} />
              <Metric label="Fontes" value={sources.length} />
              <Metric label="Zero-token" value={capabilities.filter((c) => c.zeroToken).length} />
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatusCard
            title="Firecrawl"
            detail="Pesquisa e scrape web"
            ok={firecrawlConfigured}
            icon={<Search className="h-5 w-5" />}
          />
          <StatusCard
            title="ComfyUI"
            detail="Imagem + vídeo por workflow"
            ok={Boolean(comfy?.configured && comfy?.ok)}
            icon={<Sparkles className="h-5 w-5" />}
          />
          <StatusCard
            title="Simulador"
            detail="Monte Carlo local"
            ok
            icon={<Waves className="h-5 w-5" />}
          />
          <StatusCard
            title="Memória + Council"
            detail="Contexto, evidência e revisão"
            ok={capabilities.some((c) => c.id === "memory-v2") && capabilities.some((c) => c.id === "council")}
            icon={<BrainCircuit className="h-5 w-5" />}
          />
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <LabCard
            title="Pesquisa web"
            subtitle="Firecrawl: busca web em conteúdo limpo e estruturado."
            icon={<Search className="h-5 w-5" />}
          >
            <div className="flex gap-2">
              <input
                value={researchQuery}
                onChange={(e) => setResearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void runResearch()}
                placeholder="Ex.: mudanças recentes no portal do CNJ"
                className="h-11 min-w-0 flex-1 rounded-xl border border-[#d8e3ef] bg-white px-3 text-sm outline-none focus:border-[#1769ff]"
              />
              <button
                onClick={() => void runResearch()}
                disabled={researchBusy || !researchQuery.trim()}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#1769ff] px-4 text-sm font-bold text-white disabled:opacity-50"
              >
                {researchBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Pesquisar
              </button>
            </div>
            {!firecrawlConfigured ? (
              <Hint>Configure FIRECRAWL_API_KEY ou FIRECRAWL_BASE_URL para habilitar este motor.</Hint>
            ) : null}
            {researchResult?.error ? <ErrorBox>{researchResult.error}</ErrorBox> : null}
            <div className="mt-4 space-y-2">
              {(researchResult?.data || []).map((item: any) => (
                <a
                  key={item.url}
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block rounded-xl border border-[#e0e8f2] bg-white p-3 hover:border-[#9ec4ff]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-bold text-[#173c69]">{item.title}</p>
                    <ExternalLink className="h-4 w-4 shrink-0 text-[#6581a3]" />
                  </div>
                  {item.description ? <p className="mt-1 text-xs leading-5 text-[#60748f]">{item.description}</p> : null}
                </a>
              ))}
            </div>
          </LabCard>

          <LabCard
            title="Gerador de imagem e vídeo"
            subtitle="ComfyUI recebe workflows configurados no servidor; nenhum modelo pesado entra no Vercel."
            icon={mediaKind === "image" ? <ImageIcon className="h-5 w-5" /> : <Video className="h-5 w-5" />}
          >
            <div className="mb-3 flex rounded-xl bg-[#edf3fb] p-1">
              {(["image", "video"] as const).map((kind) => (
                <button
                  key={kind}
                  onClick={() => setMediaKind(kind)}
                  className={`flex-1 rounded-lg px-3 py-2 text-xs font-bold ${mediaKind === kind ? "bg-white text-[#1769ff] shadow-sm" : "text-[#6b7f98]"}`}
                >
                  {kind === "image" ? "Imagem" : "Vídeo"}
                </button>
              ))}
            </div>
            <textarea
              value={mediaPrompt}
              onChange={(e) => setMediaPrompt(e.target.value)}
              placeholder="Descreva a imagem ou o vídeo..."
              className="min-h-28 w-full rounded-xl border border-[#d8e3ef] bg-white p-3 text-sm outline-none focus:border-[#1769ff]"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() => void runMedia()}
                disabled={mediaBusy || !mediaPrompt.trim()}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#0d3157] px-4 text-sm font-bold text-white disabled:opacity-50"
              >
                {mediaBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Enfileirar
              </button>
              {mediaResult?.promptId ? (
                <button onClick={() => void refreshMedia()} className="h-10 rounded-xl border border-[#cddbea] bg-white px-4 text-sm font-bold">
                  Consultar resultado
                </button>
              ) : null}
            </div>
            {!comfy?.configured ? <Hint>Configure COMFYUI_BASE_URL e os workflows JSON de imagem/vídeo.</Hint> : null}
            {mediaResult ? (
              <pre className="mt-3 max-h-40 overflow-auto rounded-xl bg-[#071d35] p-3 text-[11px] text-[#d7e9fa]">
                {JSON.stringify(mediaResult, null, 2)}
              </pre>
            ) : null}
            {mediaHistory ? (
              <pre className="mt-3 max-h-52 overflow-auto rounded-xl bg-[#071d35] p-3 text-[11px] text-[#d7e9fa]">
                {JSON.stringify(mediaHistory, null, 2)}
              </pre>
            ) : null}
          </LabCard>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.15fr_.85fr]">
          <LabCard
            title="Simulador de cenários"
            subtitle="Motor Monte Carlo local. Os números são cenários matemáticos, não previsão garantida."
            icon={<FlaskConical className="h-5 w-5" />}
          >
            <textarea
              value={simulationText}
              onChange={(e) => setSimulationText(e.target.value)}
              spellCheck={false}
              className="min-h-[330px] w-full rounded-xl border border-[#d8e3ef] bg-[#071d35] p-3 font-mono text-xs leading-5 text-[#d7e9fa] outline-none"
            />
            <button
              onClick={() => void runSimulation()}
              disabled={simulationBusy}
              className="mt-3 inline-flex h-10 items-center gap-2 rounded-xl bg-[#1769ff] px-4 text-sm font-bold text-white disabled:opacity-50"
            >
              {simulationBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />}
              Simular
            </button>
            {simulationResult?.error ? <ErrorBox>{simulationResult.error}</ErrorBox> : null}
            {simulationResult?.result?.options ? (
              <div className="mt-4 overflow-x-auto rounded-xl border border-[#dfe7f1]">
                <table className="w-full min-w-[620px] text-left text-xs">
                  <thead className="bg-[#eef4fb] text-[#54708f]">
                    <tr>
                      <th className="px-3 py-2">Opção</th>
                      <th className="px-3 py-2">Média</th>
                      <th className="px-3 py-2">P10</th>
                      <th className="px-3 py-2">P50</th>
                      <th className="px-3 py-2">P90</th>
                      <th className="px-3 py-2">Topo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {simulationResult.result.options.map((row: any) => (
                      <tr key={row.id} className="border-t border-[#e4eaf2] bg-white">
                        <td className="px-3 py-2 font-bold">{row.label}</td>
                        <td className="px-3 py-2">{row.mean.toFixed(2)}</td>
                        <td className="px-3 py-2">{row.p10.toFixed(2)}</td>
                        <td className="px-3 py-2">{row.p50.toFixed(2)}</td>
                        <td className="px-3 py-2">{row.p90.toFixed(2)}</td>
                        <td className="px-3 py-2">{(row.topRate * 100).toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </LabCard>

          <LabCard
            title="Mapa de inteligência"
            subtitle="Capacidades e fontes adotadas pelo núcleo."
            icon={<BrainCircuit className="h-5 w-5" />}
          >
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(byRuntime).map(([runtime, total]) => (
                <div key={runtime} className="rounded-xl border border-[#dfe7f1] bg-white p-3">
                  <p className="text-[10px] font-bold uppercase tracking-[.15em] text-[#71849d]">{runtime}</p>
                  <p className="mt-1 text-2xl font-black">{total}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 max-h-[420px] space-y-2 overflow-y-auto pr-1">
              {capabilities.map((capability) => (
                <div key={capability.id} className="rounded-xl border border-[#e0e8f2] bg-white p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-black">{capability.label}</p>
                    <span className="rounded-full bg-[#eef4fb] px-2 py-1 text-[9px] font-bold uppercase text-[#5d7693]">
                      {capability.runtime}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-[#637892]">{capability.description}</p>
                </div>
              ))}
            </div>
          </LabCard>
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-20 rounded-2xl border border-white/15 bg-white/10 px-3 py-3">
      <p className="text-2xl font-black">{value}</p>
      <p className="mt-1 text-[9px] font-bold uppercase tracking-[.12em] text-[#bcd5ec]">{label}</p>
    </div>
  );
}

function StatusCard({
  title,
  detail,
  ok,
  icon,
}: {
  title: string;
  detail: string;
  ok: boolean;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[#dfe7f1] bg-white p-4 shadow-[0_8px_26px_rgba(18,53,91,.05)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eef5ff] text-[#1769ff]">{icon}</div>
        <span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase ${ok ? "bg-[#e8f8ef] text-[#15824a]" : "bg-[#fff3df] text-[#9a6714]"}`}>
          {ok ? "ativo" : "opcional"}
        </span>
      </div>
      <p className="mt-3 font-black">{title}</p>
      <p className="mt-1 text-xs text-[#687e98]">{detail}</p>
    </div>
  );
}

function LabCard({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-[#dce6f1] bg-white p-5 shadow-[0_14px_40px_rgba(18,53,91,.06)] md:p-6">
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#edf4ff] text-[#1769ff]">{icon}</div>
        <div>
          <h2 className="text-lg font-black">{title}</h2>
          <p className="mt-1 text-xs leading-5 text-[#687e98]">{subtitle}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 rounded-xl bg-[#fff7e9] px-3 py-2 text-xs font-semibold text-[#8b6218]">{children}</p>;
}

function ErrorBox({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 rounded-xl bg-[#fff0f0] px-3 py-2 text-xs font-semibold text-[#b33737]">{children}</p>;
}
