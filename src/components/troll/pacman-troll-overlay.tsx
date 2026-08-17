"use client";

/**
 * Pac-Man jogável + cabeça pra baixo (toggle).
 * Entrar: ?troll=1  |  Sair: ESC, botão Sair, ?troll=0
 */
import React, { useCallback, useEffect, useRef, useState } from "react";

const COLS = 19;
const ROWS = 15;
const CELL = 22;
const TICK_MS = 140;

const MAZE: number[][] = [
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,1],
  [1,3,1,1,0,1,1,1,0,1,0,1,1,1,0,1,1,3,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,1,1,0,1,0,1,1,1,1,1,0,1,0,1,1,0,1],
  [1,0,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,0,1],
  [1,1,1,1,0,1,1,1,2,1,2,1,1,1,0,1,1,1,1],
  [2,2,2,1,0,1,2,2,2,2,2,2,2,1,0,1,2,2,2],
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
  return grid[p.r][p.c] !== 1;
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
  if (options.length === 0) return opposite(dir);
  if (scared) return options[Math.floor(Math.random() * options.length)];
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

function readTrollFlag(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const q = new URLSearchParams(window.location.search);
    if (q.get("troll") === "0") {
      window.localStorage.removeItem("lexis_troll");
      return false;
    }
    if (q.get("troll") === "1") {
      window.localStorage.setItem("lexis_troll", "1");
      return true;
    }
    if (window.localStorage.getItem("lexis_troll") === "1") return true;
  } catch {
    /* ignore */
  }
  return process.env.NEXT_PUBLIC_TROLL_MODE === "1";
}

export function PacmanTrollOverlay() {
  const [active, setActive] = useState(false);
  const [upsideDown, setUpsideDown] = useState(true);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [won, setWon] = useState(false);
  const [dead, setDead] = useState(false);
  const [paused, setPaused] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gridRef = useRef(cloneMaze());
  const pacRef = useRef<Pos>({ r: 9, c: 9 });
  const pacDirRef = useRef<Dir>("L");
  const nextDirRef = useRef<Dir>("L");
  const ghostsRef = useRef([
    { r: 7, c: 9, dir: "U" as Dir, color: "#ff4d6d" },
    { r: 7, c: 8, dir: "L" as Dir, color: "#4cc9f0" },
    { r: 7, c: 10, dir: "R" as Dir, color: "#b5179e" },
    { r: 8, c: 9, dir: "D" as Dir, color: "#f4a261" },
  ]);
  const powerRef = useRef(0);
  const mouthRef = useRef(0);
  const pausedRef = useRef(false);
  const wonRef = useRef(false);
  const deadRef = useRef(false);

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
      window.history.replaceState({}, "", url.toString());
    } catch {
      /* ignore */
    }
    document.documentElement.classList.remove("lexis-troll-flip");
    document.body.classList.remove("lexis-troll-flip");
    setActive(false);
  }, []);

  useEffect(() => {
    setActive(readTrollFlag());
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
      if (upsideDown) {
        const inv: Record<Dir, Dir> = { U: "D", D: "U", L: "R", R: "L" };
        dir = inv[dir];
      }
      nextDirRef.current = dir;
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [active, exitTroll, upsideDown]);

  const resetPositions = useCallback(() => {
    pacRef.current = { r: 9, c: 9 };
    pacDirRef.current = "L";
    nextDirRef.current = "L";
    ghostsRef.current = [
      { r: 7, c: 9, dir: "U", color: "#ff4d6d" },
      { r: 7, c: 8, dir: "L", color: "#4cc9f0" },
      { r: 7, c: 10, dir: "R", color: "#b5179e" },
      { r: 8, c: 9, dir: "D", color: "#f4a261" },
    ];
    powerRef.current = 0;
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
      if (pausedRef.current || wonRef.current || deadRef.current) return;
      const grid = gridRef.current;
      mouthRef.current = (mouthRef.current + 1) % 4;

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
        powerRef.current = 40;
      }
      if (powerRef.current > 0) powerRef.current--;

      const scared = powerRef.current > 0;
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
            g.r = 7;
            g.c = 9;
          } else {
            setLives((L) => {
              const next = L - 1;
              if (next <= 0) setDead(true);
              else resetPositions();
              return next;
            });
            break;
          }
        }
      }

      if (countDots(grid) === 0) setWon(true);

      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const W = COLS * CELL;
      const H = ROWS * CELL;
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, W, H);

      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const v = grid[r][c];
          const x = c * CELL;
          const y = r * CELL;
          if (v === 1) {
            ctx.fillStyle = "#1a3a8a";
            ctx.fillRect(x + 1, y + 1, CELL - 2, CELL - 2);
            ctx.strokeStyle = "#3b82f6";
            ctx.strokeRect(x + 2, y + 2, CELL - 4, CELL - 4);
          } else if (v === 0) {
            ctx.fillStyle = "#fbbf24";
            ctx.beginPath();
            ctx.arc(x + CELL / 2, y + CELL / 2, 2.5, 0, Math.PI * 2);
            ctx.fill();
          } else if (v === 3) {
            ctx.fillStyle = "#fbbf24";
            ctx.beginPath();
            ctx.arc(x + CELL / 2, y + CELL / 2, 6, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      for (const g of ghostsRef.current) {
        const gx = g.c * CELL + CELL / 2;
        const gy = g.r * CELL + CELL / 2;
        ctx.fillStyle = scared ? "#60a5fa" : g.color;
        ctx.beginPath();
        ctx.arc(gx, gy - 2, 9, Math.PI, 0);
        ctx.lineTo(gx + 9, gy + 8);
        ctx.lineTo(gx + 5, gy + 4);
        ctx.lineTo(gx, gy + 8);
        ctx.lineTo(gx - 5, gy + 4);
        ctx.lineTo(gx - 9, gy + 8);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(gx - 3, gy - 3, 2.5, 0, Math.PI * 2);
        ctx.arc(gx + 3, gy - 3, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      const px = pacRef.current.c * CELL + CELL / 2;
      const py = pacRef.current.r * CELL + CELL / 2;
      const open = mouthRef.current < 2 ? 0.35 : 0.08;
      let start = open;
      let end = Math.PI * 2 - open;
      if (pacDirRef.current === "L") {
        start = Math.PI + open;
        end = Math.PI - open;
      } else if (pacDirRef.current === "U") {
        start = -Math.PI / 2 + open;
        end = (-Math.PI / 2 - open + Math.PI * 2) as number;
      } else if (pacDirRef.current === "D") {
        start = Math.PI / 2 + open;
        end = (Math.PI / 2 - open + Math.PI * 2) as number;
      }
      ctx.fillStyle = "#fbbf24";
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.arc(px, py, 10, start, end, false);
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
        html.lexis-troll-flip,
        body.lexis-troll-flip {
          transform: rotate(180deg) !important;
          transform-origin: center center !important;
        }
        .lexis-pac-root {
          position: fixed;
          inset: 0;
          z-index: 2147483646;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: rgba(0,0,0,0.88);
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          color: #fbbf24;
        }
        .lexis-pac-panel {
          background: #0a0a12;
          border: 3px solid #fbbf24;
          border-radius: 12px;
          padding: 12px 16px 16px;
          box-shadow: 0 0 40px #fbbf2444;
          max-width: 96vw;
        }
        .lexis-pac-hud {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
          font-size: 13px;
          font-weight: 800;
        }
        .lexis-pac-btn {
          background: #1a1a2e;
          color: #fbbf24;
          border: 1px solid #fbbf24;
          border-radius: 6px;
          padding: 6px 10px;
          font-size: 11px;
          font-weight: 800;
          cursor: pointer;
          text-transform: uppercase;
        }
        .lexis-pac-btn:hover { background: #fbbf24; color: #000; }
        .lexis-pac-btn.danger { border-color: #f87171; color: #f87171; }
        .lexis-pac-btn.danger:hover { background: #f87171; color: #000; }
        .lexis-pac-help {
          margin-top: 8px;
          font-size: 10px;
          opacity: 0.75;
          text-align: center;
          line-height: 1.4;
        }
        .lexis-pac-overlay-msg {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: rgba(0,0,0,0.72);
          font-size: 22px;
          font-weight: 900;
          gap: 12px;
        }
        .lexis-pac-canvas-wrap {
          position: relative;
          line-height: 0;
          margin: 0 auto;
        }
      `}</style>

      <div className="lexis-pac-root" role="dialog" aria-label="Pac-Man Lexis">
        <div className="lexis-pac-panel">
          <div className="lexis-pac-hud">
            <span>SCORE {score}</span>
            <span>VIDAS {"❤️".repeat(Math.max(0, lives))}</span>
            <span>{upsideDown ? "FLIP ON" : "FLIP OFF"}</span>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <button type="button" className="lexis-pac-btn" onClick={() => setPaused((p) => !p)}>
                {paused ? "Continuar" : "Pausar"}
              </button>
              <button type="button" className="lexis-pac-btn" onClick={() => setUpsideDown((u) => !u)}>
                Cabeça p/ baixo
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
              style={{ width: "min(96vw, 418px)", height: "auto", imageRendering: "pixelated" }}
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
            Setas ou WASD · Power = come fantasma · P pausa · F flip · ESC sai
            <br />
            Entrar: ?troll=1 · Sair: ?troll=0 ou botão Sair
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 48px)",
              gap: 4,
              justifyContent: "center",
              marginTop: 10,
            }}
          >
            <span />
            <button
              type="button"
              className="lexis-pac-btn"
              onClick={() => {
                nextDirRef.current = upsideDown ? "D" : "U";
              }}
            >
              ↑
            </button>
            <span />
            <button
              type="button"
              className="lexis-pac-btn"
              onClick={() => {
                nextDirRef.current = upsideDown ? "R" : "L";
              }}
            >
              ←
            </button>
            <button
              type="button"
              className="lexis-pac-btn"
              onClick={() => {
                nextDirRef.current = upsideDown ? "U" : "D";
              }}
            >
              ↓
            </button>
            <button
              type="button"
              className="lexis-pac-btn"
              onClick={() => {
                nextDirRef.current = upsideDown ? "L" : "R";
              }}
            >
              →
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
