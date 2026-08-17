"use client";

/**
 * Mini Pac-Man OPCIONAL — não bloqueia o CRM.
 * Ativar só com ?troll=1 (não grava forçado em atendimento).
 * Sair: ESC, botão Sair, ?troll=0
 * Flip desligado por padrão (controles normais).
 */
import React, { useCallback, useEffect, useRef, useState } from "react";

const COLS = 19;
const ROWS = 15;
const CELL = 24;
const TICK_MS = 160;

// 1 parede | 0 pastilha | 2 vazio | 3 power
const MAZE: number[][] = [
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,1],
  [1,3,1,1,0,1,1,1,0,1,0,1,1,1,0,1,1,3,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,1,1,0,1,0,1,1,1,1,1,0,1,0,1,1,0,1],
  [1,0,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,0,1],
  [1,1,1,1,0,1,1,1,2,1,2,1,1,1,0,1,1,1,1],
  [1,2,2,1,0,1,2,2,2,2,2,2,2,1,0,1,2,2,1],
  [1,1,1,1,0,1,2,1,1,2,1,1,2,1,0,1,1,1,1],
  [1,0,0,0,0,0,2,1,2,2,2,1,2,0,0,0,0,0,1],
  [1,0,1,1,0,1,1,1,2,1,2,1,1,1,0,1,1,0,1],
  [1,3,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,3,1],
  [1,0,1,1,1,1,0,1,1,1,1,1,0,1,1,1,1,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
];

type Dir = "U" | "D" | "L" | "R";
type Pos = { r: number; c: number };

const DIRS: Record<Dir, Pos> = {
  U: { r: -1, c: 0 },
  D: { r: 1, c: 0 },
  L: { r: 0, c: -1 },
  R: { r: 0, c: 1 },
};

const PAC_START: Pos = { r: 13, c: 9 };
const GHOST_HOME: Pos[] = [
  { r: 7, c: 8 },
  { r: 7, c: 9 },
  { r: 7, c: 10 },
  { r: 8, c: 9 },
];

function cloneMaze() {
  return MAZE.map((row) => row.slice());
}

function countDots(grid: number[][]) {
  let n = 0;
  for (const row of grid) for (const v of row) if (v === 0 || v === 3) n++;
  return n;
}

function wrap(p: Pos): Pos {
  let { r, c } = p;
  if (c < 0) c = COLS - 1;
  if (c >= COLS) c = 0;
  return { r, c };
}

function canWalk(grid: number[][], p: Pos) {
  if (p.r < 0 || p.r >= ROWS) return false;
  return grid[p.r]?.[p.c] !== 1;
}

function step(grid: number[][], p: Pos, d: Dir): Pos {
  const n = wrap({ r: p.r + DIRS[d].r, c: p.c + DIRS[d].c });
  return canWalk(grid, n) ? n : p;
}

function opposite(d: Dir): Dir {
  return ({ U: "D", D: "U", L: "R", R: "L" } as const)[d];
}

function ghostPick(grid: number[][], pos: Pos, dir: Dir, target: Pos, scared: boolean): Dir {
  const options = (["U", "D", "L", "R"] as Dir[]).filter((d) => {
    if (d === opposite(dir)) return false;
    const n = wrap({ r: pos.r + DIRS[d].r, c: pos.c + DIRS[d].c });
    return canWalk(grid, n);
  });
  if (options.length === 0) {
    const back = opposite(dir);
    const n = wrap({ r: pos.r + DIRS[back].r, c: pos.c + DIRS[back].c });
    return canWalk(grid, n) ? back : dir;
  }
  if (scared || Math.random() < 0.25) {
    return options[Math.floor(Math.random() * options.length)];
  }
  let best = options[0];
  let bestDist = Infinity;
  for (const d of options) {
    const n = wrap({ r: pos.r + DIRS[d].r, c: pos.c + DIRS[d].c });
    const dist = Math.abs(n.r - target.r) + Math.abs(n.c - target.c);
    if (dist < bestDist) {
      bestDist = dist;
      best = d;
    }
  }
  return best;
}

/** Só ativa com ?troll=1 explícito — NÃO grava se já existir flag velha quebrada ao abrir o app. */
function shouldOpenGame(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const q = new URLSearchParams(window.location.search);
    if (q.get("troll") === "0") {
      window.localStorage.removeItem("lexis_troll");
      return false;
    }
    // limpa flag antiga que prendia o usuário
    if (q.get("troll") !== "1") {
      window.localStorage.removeItem("lexis_troll");
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function PacmanTrollOverlay() {
  const [active, setActive] = useState(false);
  const [upsideDown, setUpsideDown] = useState(false);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [won, setWon] = useState(false);
  const [dead, setDead] = useState(false);
  const [paused, setPaused] = useState(false);
  const [grace, setGrace] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gridRef = useRef(cloneMaze());
  const pacRef = useRef<Pos>({ ...PAC_START });
  const pacDirRef = useRef<Dir>("L");
  const nextDirRef = useRef<Dir>("L");
  const ghostsRef = useRef(
    GHOST_HOME.map((p, i) => ({
      ...p,
      dir: "U" as Dir,
      color: ["#ff4d6d", "#4cc9f0", "#b5179e", "#f4a261"][i],
    }))
  );
  const powerRef = useRef(0);
  const mouthRef = useRef(0);
  const graceRef = useRef(20);
  const pausedRef = useRef(false);
  const wonRef = useRef(false);
  const deadRef = useRef(false);
  const upsideRef = useRef(false);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);
  useEffect(() => {
    wonRef.current = won;
  }, [won]);
  useEffect(() => {
    deadRef.current = dead;
  }, [dead]);
  useEffect(() => {
    upsideRef.current = upsideDown;
  }, [upsideDown]);
  useEffect(() => {
    graceRef.current = grace;
  }, [grace]);

  const exitTroll = useCallback(() => {
    try {
      window.localStorage.removeItem("lexis_troll");
      const url = new URL(window.location.href);
      url.searchParams.delete("troll");
      window.history.replaceState({}, "", url.pathname + url.search);
    } catch {
      /* ignore */
    }
    document.documentElement.classList.remove("lexis-troll-flip");
    document.body.classList.remove("lexis-troll-flip");
    setActive(false);
  }, []);

  useEffect(() => {
    // limpa lixo de versões antigas sempre que o componente monta
    try {
      if (!window.location.search.includes("troll=1")) {
        window.localStorage.removeItem("lexis_troll");
      }
    } catch {
      /* ignore */
    }
    setActive(shouldOpenGame());
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const html = document.documentElement;
    const body = document.body;
    if (active && upsideDown) {
      html.classList.add("lexis-troll-flip");
      body.classList.add("lexis-troll-flip");
    } else {
      html.classList.remove("lexis-troll-flip");
      body.classList.remove("lexis-troll-flip");
    }
    return () => {
      html.classList.remove("lexis-troll-flip");
      body.classList.remove("lexis-troll-flip");
    };
  }, [active, upsideDown]);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        exitTroll();
        return;
      }
      if (e.key === "p" || e.key === "P") {
        setPaused((p) => !p);
        return;
      }
      if (e.key === "f" || e.key === "F") {
        setUpsideDown((u) => !u);
        return;
      }
      const map: Record<string, Dir> = {
        ArrowUp: "U",
        ArrowDown: "D",
        ArrowLeft: "L",
        ArrowRight: "R",
        w: "U",
        W: "U",
        s: "D",
        S: "D",
        a: "L",
        A: "L",
        d: "R",
        D: "R",
      };
      let dir = map[e.key];
      if (!dir) return;
      e.preventDefault();
      // só inverte se flip estiver ligado
      if (upsideRef.current) {
        const inv: Record<Dir, Dir> = { U: "D", D: "U", L: "R", R: "L" };
        dir = inv[dir];
      }
      nextDirRef.current = dir;
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [active, exitTroll]);

  const resetPositions = useCallback(() => {
    pacRef.current = { ...PAC_START };
    pacDirRef.current = "L";
    nextDirRef.current = "L";
    ghostsRef.current = GHOST_HOME.map((p, i) => ({
      ...p,
      dir: "U" as Dir,
      color: ["#ff4d6d", "#4cc9f0", "#b5179e", "#f4a261"][i],
    }));
    powerRef.current = 0;
    graceRef.current = 25;
    setGrace(25);
  }, []);

  const fullReset = useCallback(() => {
    gridRef.current = cloneMaze();
    setScore(0);
    setLives(3);
    setWon(false);
    setDead(false);
    setPaused(false);
    resetPositions();
  }, [resetPositions]);

  useEffect(() => {
    if (!active) return;
    fullReset();
    const id = window.setInterval(() => {
      if (pausedRef.current || wonRef.current || deadRef.current) {
        // ainda desenha se pausado
      } else {
        const grid = gridRef.current;
        mouthRef.current = (mouthRef.current + 1) % 4;

        if (graceRef.current > 0) {
          graceRef.current -= 1;
          setGrace(graceRef.current);
        }

        const tryDir = nextDirRef.current;
        const turned = step(grid, pacRef.current, tryDir);
        if (turned.r !== pacRef.current.r || turned.c !== pacRef.current.c) {
          pacDirRef.current = tryDir;
          pacRef.current = turned;
        } else {
          pacRef.current = step(grid, pacRef.current, pacDirRef.current);
        }

        const cell = grid[pacRef.current.r][pacRef.current.c];
        if (cell === 0) {
          grid[pacRef.current.r][pacRef.current.c] = 2;
          setScore((s) => s + 10);
        } else if (cell === 3) {
          grid[pacRef.current.r][pacRef.current.c] = 2;
          setScore((s) => s + 50);
          powerRef.current = 45;
        }
        if (powerRef.current > 0) powerRef.current--;

        const scared = powerRef.current > 0;
        // fantasmas só se movem depois do grace (evita game over imediato)
        if (graceRef.current <= 0) {
          for (const g of ghostsRef.current) {
            g.dir = ghostPick(grid, { r: g.r, c: g.c }, g.dir, pacRef.current, scared);
            const n = step(grid, { r: g.r, c: g.c }, g.dir);
            g.r = n.r;
            g.c = n.c;
          }

          for (const g of ghostsRef.current) {
            if (g.r === pacRef.current.r && g.c === pacRef.current.c) {
              if (scared) {
                setScore((s) => s + 200);
                g.r = GHOST_HOME[0].r;
                g.c = GHOST_HOME[0].c;
              } else {
                setLives((L) => {
                  const next = L - 1;
                  if (next <= 0) setDead(true);
                  else resetPositions();
                  return Math.max(0, next);
                });
                break;
              }
            }
          }
        }

        if (countDots(grid) === 0) setWon(true);
      }

      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const W = COLS * CELL;
      const H = ROWS * CELL;
      const grid = gridRef.current;
      const scared = powerRef.current > 0;

      ctx.fillStyle = "#050510";
      ctx.fillRect(0, 0, W, H);

      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const v = grid[r][c];
          const x = c * CELL;
          const y = r * CELL;
          if (v === 1) {
            ctx.fillStyle = "#1e3a8a";
            ctx.fillRect(x + 1, y + 1, CELL - 2, CELL - 2);
          } else if (v === 0) {
            ctx.fillStyle = "#fbbf24";
            ctx.beginPath();
            ctx.arc(x + CELL / 2, y + CELL / 2, 2.5, 0, Math.PI * 2);
            ctx.fill();
          } else if (v === 3) {
            ctx.fillStyle = "#fde68a";
            ctx.beginPath();
            ctx.arc(x + CELL / 2, y + CELL / 2, 6, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      for (const g of ghostsRef.current) {
        const gx = g.c * CELL + CELL / 2;
        const gy = g.r * CELL + CELL / 2;
        ctx.fillStyle = scared ? "#93c5fd" : g.color;
        ctx.beginPath();
        ctx.arc(gx, gy - 2, 9, Math.PI, 0);
        ctx.lineTo(gx + 9, gy + 9);
        ctx.lineTo(gx + 4, gy + 5);
        ctx.lineTo(gx, gy + 9);
        ctx.lineTo(gx - 4, gy + 5);
        ctx.lineTo(gx - 9, gy + 9);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(gx - 3, gy - 3, 2.2, 0, Math.PI * 2);
        ctx.arc(gx + 3, gy - 3, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }

      const px = pacRef.current.c * CELL + CELL / 2;
      const py = pacRef.current.r * CELL + CELL / 2;
      const open = mouthRef.current < 2 ? 0.4 : 0.05;
      let rot = 0;
      if (pacDirRef.current === "R") rot = 0;
      else if (pacDirRef.current === "D") rot = Math.PI / 2;
      else if (pacDirRef.current === "L") rot = Math.PI;
      else rot = -Math.PI / 2;
      ctx.fillStyle = "#fbbf24";
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.arc(px, py, 10, rot + open, rot + Math.PI * 2 - open, false);
      ctx.closePath();
      ctx.fill();
    }, TICK_MS);

    return () => window.clearInterval(id);
  }, [active, fullReset, resetPositions]);

  if (!active) return null;

  const W = COLS * CELL;
  const H = ROWS * CELL;

  const setDir = (dir: Dir) => {
    let d = dir;
    if (upsideRef.current) {
      const inv: Record<Dir, Dir> = { U: "D", D: "U", L: "R", R: "L" };
      d = inv[dir];
    }
    nextDirRef.current = d;
  };

  return (
    <>
      <style>{`
        html.lexis-troll-flip, body.lexis-troll-flip {
          transform: rotate(180deg) !important;
          transform-origin: center center !important;
        }
        .lexis-pac-root {
          position: fixed; inset: 0; z-index: 2147483646;
          display: flex; align-items: center; justify-content: center;
          background: rgba(0,0,0,0.82);
          font-family: ui-monospace, Menlo, monospace; color: #fbbf24;
        }
        .lexis-pac-panel {
          background: #0a0a12; border: 3px solid #fbbf24; border-radius: 12px;
          padding: 12px 16px 16px; box-shadow: 0 0 40px #fbbf2444; max-width: 96vw;
        }
        .lexis-pac-hud {
          display: flex; flex-wrap: wrap; gap: 10px; justify-content: space-between;
          align-items: center; margin-bottom: 8px; font-size: 13px; font-weight: 800;
        }
        .lexis-pac-btn {
          background: #1a1a2e; color: #fbbf24; border: 1px solid #fbbf24;
          border-radius: 6px; padding: 6px 10px; font-size: 11px; font-weight: 800;
          cursor: pointer; text-transform: uppercase;
        }
        .lexis-pac-btn:hover { background: #fbbf24; color: #000; }
        .lexis-pac-btn.danger { border-color: #f87171; color: #f87171; }
        .lexis-pac-btn.danger:hover { background: #f87171; color: #000; }
        .lexis-pac-help { margin-top: 8px; font-size: 10px; opacity: 0.8; text-align: center; line-height: 1.45; }
        .lexis-pac-overlay-msg {
          position: absolute; inset: 0; display: flex; flex-direction: column;
          align-items: center; justify-content: center; background: rgba(0,0,0,0.75);
          font-size: 22px; font-weight: 900; gap: 12px;
        }
        .lexis-pac-canvas-wrap { position: relative; line-height: 0; margin: 0 auto; }
      `}</style>

      <div className="lexis-pac-root" role="dialog" aria-label="Pac-Man opcional">
        <div className="lexis-pac-panel">
          <div className="lexis-pac-hud">
            <span>SCORE {score}</span>
            <span>VIDAS {lives}</span>
            <span>{grace > 0 ? `PREPARE… ${grace}` : "JOGUE"}</span>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <button type="button" className="lexis-pac-btn" onClick={() => setPaused((p) => !p)}>
                {paused ? "Continuar" : "Pausar"}
              </button>
              <button type="button" className="lexis-pac-btn" onClick={() => setUpsideDown((u) => !u)}>
                {upsideDown ? "Flip OFF" : "Flip ON"}
              </button>
              <button type="button" className="lexis-pac-btn" onClick={fullReset}>
                Reiniciar
              </button>
              <button type="button" className="lexis-pac-btn danger" onClick={exitTroll}>
                Sair (ESC)
              </button>
            </div>
          </div>

          <div className="lexis-pac-canvas-wrap">
            <canvas
              ref={canvasRef}
              width={W}
              height={H}
              style={{ width: "min(96vw, 456px)", height: "auto", imageRendering: "pixelated" }}
            />
            {(won || dead || paused) && (
              <div className="lexis-pac-overlay-msg">
                {won && <span>VOCÊ GANHOU</span>}
                {dead && <span>GAME OVER</span>}
                {paused && !won && !dead && <span>PAUSADO</span>}
                {(won || dead) && (
                  <button type="button" className="lexis-pac-btn" onClick={fullReset}>
                    Jogar de novo
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="lexis-pac-help">
            Setas / WASD · Power pill amarela grande · P pausa · F flip · ESC sai
            <br />
            <strong>Não bloqueia atendimento.</strong> Só abre com <code>?troll=1</code>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 52px)",
              gap: 6,
              justifyContent: "center",
              marginTop: 10,
            }}
          >
            <span />
            <button type="button" className="lexis-pac-btn" onClick={() => setDir("U")}>
              ↑
            </button>
            <span />
            <button type="button" className="lexis-pac-btn" onClick={() => setDir("L")}>
              ←
            </button>
            <button type="button" className="lexis-pac-btn" onClick={() => setDir("D")}>
              ↓
            </button>
            <button type="button" className="lexis-pac-btn" onClick={() => setDir("R")}>
              →
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
