
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bot, ChevronDown, ChevronLeft, ChevronRight, ChevronUp,
  FlaskConical, Globe2, Loader2, RefreshCw, Trees
} from "lucide-react";

type Tile = {
  x: number;
  z: number;
  height: number;
  biome: string;
  resource: string | null;
  marker?: string | null;
};

type WorldEdit = {
  x: number;
  z: number;
  biome?: string;
  resource?: string | null;
  walkable?: boolean;
  marker?: string | null;
};

type Chunk = {
  seed: number;
  chunkX: number;
  chunkZ: number;
  size: number;
  tiles: Tile[];
};

const biomeClass: Record<string, string> = {
  ocean: "bg-[#2f7dd1]",
  beach: "bg-[#e5c97c]",
  plains: "bg-[#88b85c]",
  forest: "bg-[#39764a]",
  desert: "bg-[#d6ad55]",
  swamp: "bg-[#56735c]",
  mountain: "bg-[#727b86]",
  snow: "bg-[#e8f0f4]",
};

const resourceMark: Record<string, string> = {
  wood: "●",
  stone: "◆",
  coal: "■",
  iron: "✦",
  food: "✿",
  water: "≈",
};

export default function WorldLabPage() {
  const [seed, setSeed] = useState("lexis-world");
  const [chunkX, setChunkX] = useState(0);
  const [chunkZ, setChunkZ] = useState(0);
  const [chunk, setChunk] = useState<Chunk | null>(null);
  const [busy, setBusy] = useState(false);
  const [ticks, setTicks] = useState(150);
  const [agents, setAgents] = useState(12);
  const [simulation, setSimulation] = useState<any>(null);
  const [simBusy, setSimBusy] = useState(false);
  const [edits, setEdits] = useState<WorldEdit[]>([]);
  const [tool, setTool] = useState<"structure" | "forest" | "water" | "iron" | "clear">("structure");

  async function callPlugin(action: string, input: Record<string, unknown>) {
    const res = await fetch("/api/plugins", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pluginId: "world-sandbox", action, input }),
    });
    return res.json();
  }

  async function loadChunk(nextX = chunkX, nextZ = chunkZ) {
    setBusy(true);
    try {
      const json = await callPlugin("chunk", { seed, chunkX: nextX, chunkZ: nextZ, size: 16, edits });
      if (json?.ok) setChunk(json.data);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    try {
      const raw = localStorage.getItem("lexis_world_edits_v1:" + seed);
      setEdits(raw ? JSON.parse(raw) : []);
    } catch {
      setEdits([]);
    }
  }, [seed]);

  useEffect(() => {
    void loadChunk(0, 0);
    // Navegação posterior é explícita.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function persistEdits(next: WorldEdit[]) {
    setEdits(next);
    try {
      localStorage.setItem("lexis_world_edits_v1:" + seed, JSON.stringify(next));
    } catch {
      // O sandbox continua funcional sem persistência local.
    }
  }

  async function editTile(tile: Tile) {
    const base: WorldEdit = { x: tile.x, z: tile.z };
    let edit: WorldEdit = base;

    if (tool === "structure") edit = { ...base, marker: "structure", biome: "plains", walkable: true };
    if (tool === "forest") edit = { ...base, biome: "forest", resource: "wood", walkable: true, marker: null };
    if (tool === "water") edit = { ...base, biome: "ocean", resource: "water", walkable: false, marker: null };
    if (tool === "iron") edit = { ...base, resource: "iron", marker: null };
    if (tool === "clear") edit = { ...base, resource: null, marker: null };

    const next = edits.filter((item) => item.x !== tile.x || item.z !== tile.z).concat(edit);
    persistEdits(next);
    setBusy(true);
    try {
      const json = await callPlugin("chunk", { seed, chunkX, chunkZ, size: 16, edits: next });
      if (json?.ok) setChunk(json.data);
    } finally {
      setBusy(false);
    }
  }

  async function move(dx: number, dz: number) {
    const x = chunkX + dx;
    const z = chunkZ + dz;
    setChunkX(x);
    setChunkZ(z);
    await loadChunk(x, z);
  }

  async function simulate() {
    setSimBusy(true);
    setSimulation(null);
    try {
      const json = await callPlugin("simulate", {
        seed,
        ticks,
        agents,
        goals: ["explore", "gather", "build"],
        edits,
      });
      setSimulation(json?.ok ? json.data : json);
    } finally {
      setSimBusy(false);
    }
  }

  const biomeStats = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const tile of chunk?.tiles || []) {
      counts[tile.biome] = (counts[tile.biome] || 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [chunk]);

  return (
    <main className="min-h-screen bg-[#f4f7fb] px-4 py-6 text-[#102447] md:px-8 md:py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-3xl border border-[#dce6f2] bg-[radial-gradient(circle_at_20%_10%,rgba(55,154,104,.32),transparent_32%),linear-gradient(135deg,#071d35,#0a3657_55%,#125b67)] p-6 text-white shadow-[0_20px_50px_rgba(4,28,50,.18)] md:p-8">
          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[.16em]">
                <Globe2 className="h-4 w-4" /> World Sandbox
              </div>
              <h1 className="mt-3 text-3xl font-black">Mundo procedural</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#d0e7ef]">
                Qualquer coordenada de chunk é gerada sob demanda a partir da seed. Agentes exploram,
                coletam e constroem em episódios reproduzíveis.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <HeaderMetric label="Chunk X" value={chunkX} />
              <HeaderMetric label="Chunk Z" value={chunkZ} />
              <HeaderMetric label="Seed" value={chunk?.seed ?? "—"} compact />
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.35fr_.65fr]">
          <div className="rounded-3xl border border-[#dce6f1] bg-white p-5 shadow-[0_14px_40px_rgba(18,53,91,.06)]">
            <div className="flex flex-col gap-3 md:flex-row md:items-end">
              <label className="flex-1">
                <span className="text-[10px] font-black uppercase tracking-[.12em] text-[#71849d]">Seed</span>
                <input
                  value={seed}
                  onChange={(e) => setSeed(e.target.value)}
                  className="mt-1 h-10 w-full rounded-xl border border-[#d8e3ef] px-3 text-sm outline-none focus:border-[#1769ff]"
                />
              </label>
              <button
                onClick={() => void loadChunk()}
                disabled={busy}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#1769ff] px-4 text-sm font-bold text-white disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Gerar
              </button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {[
                ["structure", "Construir"],
                ["forest", "Floresta"],
                ["water", "Água"],
                ["iron", "Ferro"],
                ["clear", "Limpar"],
              ].map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setTool(id as typeof tool)}
                  className={"rounded-xl px-3 py-2 text-xs font-bold " + (
                    tool === id ? "bg-[#0d3157] text-white" : "bg-[#eef3f8] text-[#59718d]"
                  )}
                >
                  {label}
                </button>
              ))}
              <button
                onClick={() => {
                  persistEdits([]);
                  void loadChunk();
                }}
                className="rounded-xl border border-[#d7e2ed] px-3 py-2 text-xs font-bold text-[#6a7f98]"
              >
                Resetar edições
              </button>
              <span className="self-center text-[10px] font-semibold text-[#7b8ea5]">
                Clique no mapa para editar. Edições salvas localmente por seed.
              </span>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-[auto_1fr]">
              <div className="flex flex-col items-center justify-center gap-1">
                <NavButton onClick={() => void move(0, -1)}><ChevronUp className="h-4 w-4" /></NavButton>
                <div className="flex gap-1">
                  <NavButton onClick={() => void move(-1, 0)}><ChevronLeft className="h-4 w-4" /></NavButton>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#d7e2ed] bg-[#f4f7fb] text-[10px] font-black">
                    {chunkX},{chunkZ}
                  </div>
                  <NavButton onClick={() => void move(1, 0)}><ChevronRight className="h-4 w-4" /></NavButton>
                </div>
                <NavButton onClick={() => void move(0, 1)}><ChevronDown className="h-4 w-4" /></NavButton>
              </div>

              {chunk ? (
                <div
                  className="grid aspect-square w-full max-w-[680px] overflow-hidden rounded-2xl border border-[#cfdbe8] bg-[#dce8f2] shadow-inner"
                  style={{ gridTemplateColumns: "repeat(" + chunk.size + ", minmax(0, 1fr))" }}
                >
                  {chunk.tiles.map((tile) => (
                    <button
                      type="button"
                      onClick={() => void editTile(tile)}
                      key={tile.x + ":" + tile.z}
                      title={tile.x + "," + tile.z + " · " + tile.biome + (tile.resource ? " · " + tile.resource : "")}
                      className={"relative aspect-square border border-black/[.035] " + (biomeClass[tile.biome] || "bg-slate-300")}
                      style={{ opacity: Math.max(0.62, Math.min(1, 0.72 + tile.height * 0.28)) }}
                    >
                      {tile.marker === "structure" ? (
                        <span className="absolute inset-0 flex items-center justify-center text-[8px] font-black text-white drop-shadow sm:text-[10px]">⌂</span>
                      ) : null}
                      {tile.resource ? (
                        <span className="absolute inset-0 flex items-center justify-center text-[7px] font-black text-black/55 sm:text-[9px]">
                          {resourceMark[tile.resource] || "·"}
                        </span>
                      ) : null}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex aspect-square w-full max-w-[680px] items-center justify-center rounded-2xl border border-dashed border-[#c9d8e7] text-sm text-[#7287a0]">
                  Gere um chunk
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <section className="rounded-3xl border border-[#dce6f1] bg-white p-5 shadow-[0_14px_40px_rgba(18,53,91,.05)]">
              <div className="flex items-center gap-2">
                <Trees className="h-5 w-5 text-[#25744a]" />
                <h2 className="font-black">Biomas do chunk</h2>
              </div>
              <div className="mt-4 space-y-2">
                {biomeStats.map(([biome, count]) => (
                  <div key={biome} className="flex items-center gap-3">
                    <span className={"h-3 w-3 rounded-full " + (biomeClass[biome] || "bg-slate-300")} />
                    <span className="flex-1 text-xs font-bold capitalize text-[#526b87]">{biome}</span>
                    <span className="text-xs font-black">{count}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-3xl border border-[#dce6f1] bg-white p-5 shadow-[0_14px_40px_rgba(18,53,91,.05)]">
              <h2 className="font-black">Recursos</h2>
              <div className="mt-4 grid grid-cols-2 gap-2 text-[10px] font-semibold text-[#59718d]">
                {Object.entries(resourceMark).map(([name, mark]) => (
                  <div key={name} className="rounded-xl bg-[#f3f6fa] px-3 py-2">
                    <span className="mr-2 font-black">{mark}</span>{name}
                  </div>
                ))}
              </div>
            </section>
          </div>
        </section>

        <section className="rounded-3xl border border-[#dce6f1] bg-white p-5 shadow-[0_14px_40px_rgba(18,53,91,.06)] md:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eef4ff] text-[#1769ff]">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-black">Sociedade de agentes</h2>
              <p className="mt-1 text-xs leading-5 text-[#687e98]">
                Agentes exploradores, coletores e construtores agem no mesmo mundo procedural.
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <RangeField label="Ticks" value={ticks} min={10} max={1000} onChange={setTicks} />
            <RangeField label="Agentes" value={agents} min={1} max={64} onChange={setAgents} />
            <div className="flex items-end">
              <button
                onClick={() => void simulate()}
                disabled={simBusy}
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#0d3157] px-4 text-sm font-bold text-white disabled:opacity-50"
              >
                {simBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />}
                Rodar episódio
              </button>
            </div>
          </div>

          {simulation?.totals ? (
            <>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <ResultMetric label="Recursos finais" value={simulation.totals.gathered} />
                <ResultMetric label="Estruturas" value={simulation.totals.structures} />
                <ResultMetric label="Distância" value={simulation.totals.distance} />
              </div>
              <div className="mt-4 overflow-x-auto rounded-2xl border border-[#dfe7f1]">
                <table className="w-full min-w-[720px] text-left text-xs">
                  <thead className="bg-[#eef4fb] text-[#58708c]">
                    <tr>
                      <th className="px-3 py-2">Agente</th>
                      <th className="px-3 py-2">Objetivo</th>
                      <th className="px-3 py-2">Posição</th>
                      <th className="px-3 py-2">Energia</th>
                      <th className="px-3 py-2">Estruturas</th>
                      <th className="px-3 py-2">Distância</th>
                    </tr>
                  </thead>
                  <tbody>
                    {simulation.agents.map((agent: any) => (
                      <tr key={agent.id} className="border-t border-[#e3eaf2]">
                        <td className="px-3 py-2 font-black">{agent.id}</td>
                        <td className="px-3 py-2">{agent.goal}</td>
                        <td className="px-3 py-2">{agent.x}, {agent.z}</td>
                        <td className="px-3 py-2">{agent.energy.toFixed(1)}</td>
                        <td className="px-3 py-2">{agent.structures}</td>
                        <td className="px-3 py-2">{agent.distance}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </section>
      </div>
    </main>
  );
}

function NavButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#d7e2ed] bg-white text-[#476482] hover:bg-[#eef5ff] hover:text-[#1769ff]"
    >
      {children}
    </button>
  );
}

function HeaderMetric({
  label,
  value,
  compact = false,
}: {
  label: string;
  value: string | number;
  compact?: boolean;
}) {
  return (
    <div className="min-w-20 rounded-2xl border border-white/15 bg-white/10 px-3 py-3 text-center">
      <p className={compact ? "max-w-28 truncate text-sm font-black" : "text-xl font-black"} title={String(value)}>
        {value}
      </p>
      <p className="mt-1 text-[9px] font-bold uppercase tracking-[.12em] text-[#bdd7e3]">{label}</p>
    </div>
  );
}

function RangeField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <label>
      <span className="flex justify-between text-[10px] font-black uppercase tracking-[.12em] text-[#71849d]">
        {label}<b className="text-[#254e7b]">{value}</b>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-3 w-full"
      />
    </label>
  );
}

function ResultMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-[#f1f6fb] p-4">
      <p className="text-2xl font-black">{value}</p>
      <p className="mt-1 text-[10px] font-bold uppercase tracking-[.12em] text-[#71849d]">{label}</p>
    </div>
  );
}
