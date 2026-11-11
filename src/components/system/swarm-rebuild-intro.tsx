"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { MousePointer2 } from "lucide-react";
import { shouldPlaySwarmRebuild } from "@/lib/swarm-rebuild-policy";

const AGENTS = [
  { label: "HERMES", className: "lx-swarm-rebuild__cursor--a" },
  { label: "DJEN", className: "lx-swarm-rebuild__cursor--b" },
  { label: "DATAJUD", className: "lx-swarm-rebuild__cursor--c" },
  { label: "INDEXER", className: "lx-swarm-rebuild__cursor--d" },
  { label: "QUEUE", className: "lx-swarm-rebuild__cursor--e" },
  { label: "AUDIÊNCIAS", className: "lx-swarm-rebuild__cursor--f" },
];

export function SwarmRebuildIntro() {
  const pathname = usePathname() || "/";
  const visited = useRef(new Set<string>());
  const [activePath, setActivePath] = useState<string | null>(null);

  useEffect(() => {
    if (shouldPlaySwarmRebuild(pathname, visited.current)) {
      setActivePath(pathname);
    } else {
      setActivePath(null);
    }
    return () => setActivePath(null);
  }, [pathname]);

  if (!activePath) return null;

  const finish = () => setActivePath(null);

  return (
    <div
      className="lx-swarm-rebuild"
      role="status"
      aria-live="polite"
      aria-label="Swarm Rebuild reconstruindo a interface"
      onAnimationEnd={(event) => {
        if (event.target === event.currentTarget) finish();
      }}
    >
      <div className="lx-swarm-rebuild__grid" aria-hidden="true" />
      <div className="lx-swarm-rebuild__stage" aria-hidden="true">
        <div className="lx-swarm-rebuild__window">
          <aside className="lx-swarm-rebuild__sidebar">
            <div className="lx-swarm-rebuild__brandmark">L</div>
            <span className="lx-swarm-rebuild__nav lx-swarm-rebuild__nav--active" />
            <span className="lx-swarm-rebuild__nav" />
            <span className="lx-swarm-rebuild__nav" />
            <span className="lx-swarm-rebuild__nav" />
            <span className="lx-swarm-rebuild__nav" />
            <span className="lx-swarm-rebuild__nav" />
          </aside>
          <section className="lx-swarm-rebuild__main">
            <header className="lx-swarm-rebuild__topbar">
              <span>LEXISPREDICT</span>
              <span className="lx-swarm-rebuild__topbar-pill">GABINETE DIGITAL</span>
              <span className="lx-swarm-rebuild__avatar">W1</span>
            </header>
            <div className="lx-swarm-rebuild__heading lx-swarm-rebuild__piece">
              <div>
                <span className="lx-swarm-rebuild__eyebrow">SWARM REBUILD · NATIVE 1.1.0</span>
                <strong>Reconstruindo a interface</strong>
                <p>Sincronizando módulos, dados e rotas do gabinete</p>
              </div>
              <div className="lx-swarm-rebuild__heading-orb" />
            </div>
            <div className="lx-swarm-rebuild__stats">
              <div className="lx-swarm-rebuild__stat lx-swarm-rebuild__piece">
                <span>PROCESSOS</span><strong>2.732</strong><i />
              </div>
              <div className="lx-swarm-rebuild__stat lx-swarm-rebuild__piece">
                <span>AUDIÊNCIAS</span><strong>14</strong><i />
              </div>
              <div className="lx-swarm-rebuild__stat lx-swarm-rebuild__piece">
                <span>AGENTES</span><strong>06</strong><i />
              </div>
            </div>
            <div className="lx-swarm-rebuild__board">
              <div className="lx-swarm-rebuild__panel lx-swarm-rebuild__piece">
                <div className="lx-swarm-rebuild__panel-title"><span>FILA OPERACIONAL</span><i /></div>
                <div className="lx-swarm-rebuild__row"><b /><span /><em /></div>
                <div className="lx-swarm-rebuild__row"><b /><span /><em /></div>
                <div className="lx-swarm-rebuild__row"><b /><span /><em /></div>
                <div className="lx-swarm-rebuild__row"><b /><span /><em /></div>
              </div>
              <div className="lx-swarm-rebuild__panel lx-swarm-rebuild__panel--side lx-swarm-rebuild__piece">
                <div className="lx-swarm-rebuild__panel-title"><span>FONTES</span><i /></div>
                <div className="lx-swarm-rebuild__source"><b /> DATAJUD</div>
                <div className="lx-swarm-rebuild__source"><b /> DJEN</div>
                <div className="lx-swarm-rebuild__source"><b /> PJe / EPROC</div>
              </div>
            </div>
          </section>
        </div>
      </div>

      {AGENTS.map((agent) => (
        <span key={agent.label} className={"lx-swarm-rebuild__cursor " + agent.className} aria-hidden="true">
          <MousePointer2 size={19} strokeWidth={2.7} />
          <span>{agent.label}</span>
        </span>
      ))}

      <div className="lx-swarm-rebuild__hud">
        <div className="lx-swarm-rebuild__hud-title">
          <span className="lx-swarm-rebuild__live-dot" />
          SWARM REBUILD
          <small>1.1.0 · NATIVO</small>
        </div>
        <div className="lx-swarm-rebuild__progress"><span /></div>
        <p>Enxame de agentes reconstruindo esta aba</p>
        <button type="button" onClick={finish}>Pular</button>
      </div>
    </div>
  );
}
