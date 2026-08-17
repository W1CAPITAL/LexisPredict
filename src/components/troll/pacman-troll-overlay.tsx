"use client";

/**
 * Pac-Man só com ?troll=1 (nada automático).
 * Visual estilo Tela Azul do Windows (BSOD).
 * Dificuldade alta — dá para perder.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";

const COLS = 19;
const ROWS = 15;
const CELL = 24;
const TICK_MS = 110; // mais rápido = mais difícil
const GHOST_EVERY = 1; // fantasmas andam todo tick
const GRACE_TICKS = 8; // pouco tempo de graça

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

/** Perseguição agressiva — quase sem aleatório */
function ghostPick(grid: number[][], pos: Pos, dir: Dir, target: Pos, scared: boolean): Dir {
  const options = (["U", "D", "L", "R"] as Dir[]).filter((d) => {
    if (d === opposite(dir) && !scared) return false;
    const n = wrap({ r: pos.r + DIRS[d].r, c: pos.c + DIRS[d].c });
    return canWalk(grid, n);
  });
  if (options.length === 0) {
    const back = opposite(dir);
    const n = wrap({ r: pos.r + DIRS[back].r, c: pos.c + DIRS[back].c });
    return canWalk(grid, n) ? back : dir;
  }
  if (scared) {
    // foge do pac
    let best = options[0];
    let bestDist = -1;
    for (const d of options) {
      const n = wrap({ r: pos.r + DIRS[d].r, c: pos.c + DIRS[d].c });
      const dist = Math.abs(n.r - target.r) + Math.abs(n.c - target.c);
      if (dist > bestDist) {
        bestDist = dist;
        best = d;
      }
    }
    return best;
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

/** ÚNICA forma de abrir: ?troll=1 na URL. Limpa qualquer flag antiga. */
function shouldOpenGame(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const q = new URLSearchParams(window.location.search);
    if (q.get("troll") === "1") return true;
    window.localStorage.removeItem("lexis_troll");
    return false;
  } catch {
    return false;
  }
}

export function PacmanTrollOverlay() {
  const [active, setActive] = useState(false);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(2); // só 2 vidas — mais difícil
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
  const graceRef = useRef(GRACE_TICKS);
  const pausedRef = useRef(false);
  const wonRef = useRef(false);
  const deadRef = useRef(false);
  const tickRef = useRef(0);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);
  useEffect(() => {
    wonRef.current = won;
  }, [won]);
  useEffect(() => {
    deadRef.current = dead;
  }, [dead]);

  const exitTroll = useCallback(() => {
    try {
      window.localStorage.removeItem("lexis_troll");
      const url = new URL(window.location.href);
      url.searchParams.delete("troll");
      window.history.replaceState({}, "", url.pathname + (url.search || ""));
    } catch {
      /* ignore */
    }
    setActive(false);
  }, []);

  useEffect(() => {
    setActive(shouldOpenGame());
  }, []);

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
      const dir = map[e.key];
      if (!dir) return;
      e.preventDefault();
      nextDirRef.current = dir; // controles normais, sem inverter
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
    graceRef.current = GRACE_TICKS;
    setGrace(GRACE_TICKS);
  }, []);

  const fullReset = useCallback(() => {
    gridRef.current = cloneMaze();
    setScore(0);
    setLives(2);
    setWon(false);
    setDead(false);
    setPaused(false);
    resetPositions();
  }, [resetPositions]);

  useEffect(() => {
    if (!active) return;
    fullReset();
    const id = window.setInterval(() => {
      tickRef.current += 1;
      if (!pausedRef.current && !wonRef.current && !deadRef.current) {
        const grid = gridRef.current;
        mouthRef.current = (mouthRef.current + 1) % 4;

        if (graceRef.current > 0) {
          graceRef.current -= 1;
          setGrace(graceRef.current);
        }

        // Pac move 1x por tick
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
          powerRef.current = 28; // power curto
        }
        if (powerRef.current > 0) powerRef.current--;

        const scared = powerRef.current > 0;

        if (graceRef.current <= 0 && tickRef.current % GHOST_EVERY === 0) {
          // 4 fantasmas agressivos; a cada 20 ticks um “pinky” mira 4 casas à frente
          const ahead = {
            r: pacRef.current.r + DIRS[pacDirRef.current].r * 4,
            c: pacRef.current.c + DIRS[pacDirRef.current].c * 4,
          };
          ghostsRef.current.forEach((g, i) => {
            const target = i === 1 ? ahead : pacRef.current;
            g.dir = ghostPick(grid, { r: g.r, c: g.c }, g.dir, target, scared);
            // no hard mode, 2 fantasmas dão passo extra ocasional
            const n = step(grid, { r: g.r, c: g.c }, g.dir);
            g.r = n.r;
            g.c = n.c;
            if (!scared && i < 2 && tickRef.current % 3 === 0) {
              g.dir = ghostPick(grid, { r: g.r, c: g.c }, g.dir, pacRef.current, false);
              const n2 = step(grid, { r: g.r, c: g.c }, g.dir);
              g.r = n2.r;
              g.c = n2.c;
            }
          });

          for (const g of ghostsRef.current) {
            if (g.r === pacRef.current.r && g.c === pacRef.current.c) {
              if (scared) {
                setScore((s) => s + 200);
                g.r = GHOST_HOME[1].r;
                g.c = GHOST_HOME[1].c;
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

      ctx.fillStyle = "#000082"; // azul BSOD no tabuleiro
      ctx.fillRect(0, 0, W, H);

      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const v = grid[r][c];
          const x = c * CELL;
          const y = r * CELL;
          if (v === 1) {
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(x + 1, y + 1, CELL - 2, CELL - 2);
            ctx.fillStyle = "#000082";
            ctx.fillRect(x + 3, y + 3, CELL - 6, CELL - 6);
          } else if (v === 0) {
            ctx.fillStyle = "#ffffff";
            ctx.beginPath();
            ctx.arc(x + CELL / 2, y + CELL / 2, 2.2, 0, Math.PI * 2);
            ctx.fill();
          } else if (v === 3) {
            ctx.fillStyle = "#ffff00";
            ctx.beginPath();
            ctx.arc(x + CELL / 2, y + CELL / 2, 6, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      for (const g of ghostsRef.current) {
        const gx = g.c * CELL + CELL / 2;
        const gy = g.r * CELL + CELL / 2;
        ctx.fillStyle = scared ? "#55ffff" : g.color;
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
      if (pacDirRef.current === "D") rot = Math.PI / 2;
      else if (pacDirRef.current === "L") rot = Math.PI;
      else if (pacDirRef.current === "U") rot = -Math.PI / 2;
      ctx.fillStyle = "#ffff00";
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

  return (
    <>
      <style>{`
        .lexis-bsod-root {
          position: fixed; inset: 0; z-index: 2147483646;
          background: #000082;
          color: #ffffff;
          font-family: "Lucida Console", "Courier New", monospace;
          display: flex; flex-direction: column; align-items: center;
          justify-content: center; padding: 16px; overflow: auto;
        }
        .lexis-bsod-title {
          background: #ffffff; color: #000082; font-weight: 700;
          padding: 2px 10px; margin-bottom: 16px; font-size: 14px;
        }
        .lexis-bsod-text {
          max-width: 640px; font-size: 13px; line-height: 1.5; margin-bottom: 12px;
          text-align: left; width: 100%;
        }
        .lexis-bsod-panel {
          border: 2px solid #fff; padding: 12px; background: #000082;
        }
        .lexis-bsod-hud {
          display: flex; flex-wrap: wrap; gap: 10px; justify-content: space-between;
          margin-bottom: 8px; font-size: 12px;
        }
        .lexis-bsod-btn {
          background: #000082; color: #fff; border: 1px solid #fff;
          padding: 6px 10px; font-family: inherit; font-size: 11px; cursor: pointer;
        }
        .lexis-bsod-btn:hover { background: #fff; color: #000082; }
        .lexis-bsod-canvas-wrap { position: relative; line-height: 0; margin: 0 auto; }
        .lexis-bsod-msg {
          position: absolute; inset: 0; display: flex; flex-direction: column;
          align-items: center; justify-content: center; background: rgba(0,0,130,0.85);
          font-size: 20px; font-weight: 700; gap: 12px;
        }
        .lexis-bsod-help { margin-top: 10px; font-size: 11px; opacity: 0.95; text-align: center; }
      `}</style>

      <div className="lexis-bsod-root" role="dialog" aria-label="BSOD Pac-Man">
        <div className="lexis-bsod-title">Windows</div>
        <div className="lexis-bsod-text">
          A problem has been detected and Lexis has been shut down to prevent damage
          to your carteira.
          <br />
          <br />
          PACMAN_EXCEPTION_NOT_HANDLED
          <br />
          <br />
          If this is the first time you&apos;ve seen this stop error screen, press ESC to
          return to the gabinete. If controls freeze, use on-screen arrows.
        </div>

        <div className="lexis-bsod-panel">
          <div className="lexis-bsod-hud">
            <span>SCORE: {score}</span>
            <span>LIVES: {lives}</span>
            <span>{grace > 0 ? `START IN ${grace}` : "HUNT MODE"}</span>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <button type="button" className="lexis-bsod-btn" onClick={() => setPaused((p) => !p)}>
                {paused ? "RESUME" : "PAUSE"}
              </button>
              <button type="button" className="lexis-bsod-btn" onClick={fullReset}>
                RESTART
              </button>
              <button type="button" className="lexis-bsod-btn" onClick={exitTroll}>
                ESC / EXIT
              </button>
            </div>
          </div>

          <div className="lexis-bsod-canvas-wrap">
            <canvas
              ref={canvasRef}
              width={W}
              height={H}
              style={{ width: "min(96vw, 456px)", height: "auto", imageRendering: "pixelated" }}
            />
            {(won || dead || paused) && (
              <div className="lexis-bsod-msg">
                {won && <span>YOU WIN — SYSTEM RESTORED</span>}
                {dead && <span>GAME OVER — DUMP COMPLETE</span>}
                {paused && !won && !dead && <span>PAUSED</span>}
                {(won || dead) && (
                  <button type="button" className="lexis-bsod-btn" onClick={fullReset}>
                    PLAY AGAIN
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="lexis-bsod-help">
            Arrows / WASD · Yellow pill = power (short) · 2 lives · Ghosts are fast
            <br />
            Only opens with <code>?troll=1</code> · ESC exits to Lexis
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
            <button type="button" className="lexis-bsod-btn" onClick={() => { nextDirRef.current = "U"; }}>
              ↑
            </button>
            <span />
            <button type="button" className="lexis-bsod-btn" onClick={() => { nextDirRef.current = "L"; }}>
              ←
            </button>
            <button type="button" className="lexis-bsod-btn" onClick={() => { nextDirRef.current = "D"; }}>
              ↓
            </button>
            <button type="button" className="lexis-bsod-btn" onClick={() => { nextDirRef.current = "R"; }}>
              →
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
