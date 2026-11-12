"use client";

import { useEffect, useState } from "react";
import { Activity, Gauge, ShieldCheck, Waves } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  DEFAULT_SWARM_REBUILD_PREFERENCES,
  getSwarmRebuildProfile,
  loadSwarmRebuildPreferences,
  saveSwarmRebuildPreferences,
  type SwarmRebuildPreferences,
  type SwarmRebuildSpeed,
} from "@/lib/swarm-rebuild-preferences";

const SPEED_LABELS = [
  "Muito lenta",
  "Lenta",
  "Normal",
  "Rápida",
  "Muito rápida",
] as const;

export function SwarmRebuildSettingsPanel() {
  const [preferences, setPreferences] = useState<SwarmRebuildPreferences>(
    DEFAULT_SWARM_REBUILD_PREFERENCES,
  );
  const [speedDraft, setSpeedDraft] = useState<SwarmRebuildSpeed>(1);

  useEffect(() => {
    const saved = loadSwarmRebuildPreferences();
    setPreferences(saved);
    setSpeedDraft(saved.speed);
  }, []);

  const changeEnabled = (enabled: boolean) => {
    const next = saveSwarmRebuildPreferences({ enabled });
    setPreferences(next);
  };

  const commitSpeed = (values: number[]) => {
    const speed = Math.min(5, Math.max(1, Math.round(values[0] ?? 1))) as SwarmRebuildSpeed;
    setSpeedDraft(speed);
    const next = saveSwarmRebuildPreferences({ speed });
    setPreferences(next);
  };

  const profile = getSwarmRebuildProfile(speedDraft);

  return (
    <section className="max-w-3xl space-y-6" aria-label="Configurações do Swarm Rebuild">
      <header className="space-y-2">
        <h2 className="flex items-center gap-2 text-xl font-bold">
          <Waves size={20} className="text-primary" />
          Swarm Rebuild
        </h2>
        <p className="text-sm text-muted-foreground">
          Reconstrução visual gradual dos elementos reais da página. O recurso é opcional e fica desligado até você ativá-lo.
        </p>
      </header>

      <div className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-card p-4">
        <div className="min-w-0 space-y-1">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Activity size={16} className="text-primary" />
            Ativar reconstrução visual
          </p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {preferences.enabled
              ? "Ativado. Será executado ao abrir uma página e ao trocar de aba compatível."
              : "Desativado. Nenhum elemento será capturado, medido ou animado; não haverá observadores nem ouvintes de abas."}
          </p>
        </div>
        <Switch
          id="swarm-rebuild-enabled"
          checked={preferences.enabled}
          onCheckedChange={changeEnabled}
          aria-label="Ativar Swarm Rebuild"
        />
      </div>

      <div className="space-y-4 rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <Gauge size={17} className="text-primary" />
          <h3 className="text-sm font-semibold">Velocidade da reconstrução</h3>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">Mais lenta</span>
          <span className="rounded-lg bg-primary/10 px-3 py-1 text-xs font-bold text-foreground">
            {profile.label}
          </span>
          <span className="text-xs text-muted-foreground">Mais rápida</span>
        </div>
        <Slider
          min={1}
          max={5}
          step={1}
          value={[speedDraft]}
          onValueChange={(values) => setSpeedDraft(
            Math.min(5, Math.max(1, Math.round(values[0] ?? 1))) as SwarmRebuildSpeed,
          )}
          onValueCommit={commitSpeed}
          aria-label="Velocidade do Swarm Rebuild"
        />
        <div className="grid grid-cols-5 gap-1 text-center">
          {SPEED_LABELS.map((label, index) => (
            <span
              key={label}
              className={speedDraft === index + 1 ? "text-[10px] font-bold text-primary" : "text-[10px] text-muted-foreground"}
            >
              {label}
            </span>
          ))}
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          A velocidade escolhida vale para a próxima troca de página ou aba. A opção mais lenta mantém cada elemento visível por cerca de 820 ms e distribui o trabalho em quatro agentes, para dar tempo de acompanhar o movimento.
        </p>
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
        <ShieldCheck size={18} className="mt-0.5 shrink-0 text-emerald-700" />
        <div className="space-y-1">
          <p className="text-sm font-semibold">Proteção de desempenho</p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            O modo desligado encerra a rotina antes de consultar o DOM. Quando ligado, limita a leitura a 180 candidatos e a animação a 48 elementos por página, com no máximo quatro agentes. Sidebar, cabeçalho e dados continuam fora da reconstrução.
          </p>
        </div>
      </div>
    </section>
  );
}
