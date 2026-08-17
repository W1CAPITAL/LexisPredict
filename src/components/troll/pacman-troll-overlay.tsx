"use client";

/**
 * Modo troll — app de cabeça para baixo + Pac-Man obrigatório.
 * Ativar: NEXT_PUBLIC_TROLL_MODE=1  OU  constante FORCE abaixo.
 * Não há botão de fechar (não opcional enquanto ativo).
 */
import React, { useEffect, useState } from "react";

/** true = sempre ligado neste build (versão trolagem). false = só com env. */
const FORCE_TROLL = true;

function isTrollOn(): boolean {
  if (FORCE_TROLL) return true;
  if (typeof process !== "undefined" && process.env.NEXT_PUBLIC_TROLL_MODE === "1") {
    return true;
  }
  if (typeof window !== "undefined") {
    try {
      if (window.localStorage.getItem("lexis_troll") === "1") return true;
      if (window.location.search.includes("troll=1")) {
        window.localStorage.setItem("lexis_troll", "1");
        return true;
      }
    } catch {
      /* ignore */
    }
  }
  return false;
}

export function PacmanTrollOverlay() {
  const [on, setOn] = useState(false);
  const [lane, setLane] = useState(0);

  useEffect(() => {
    setOn(isTrollOn());
  }, []);

  useEffect(() => {
    if (!on || typeof document === "undefined") return;

    const html = document.documentElement;
    const body = document.body;
    html.classList.add("lexis-troll-mode");
    body.classList.add("lexis-troll-mode");

    // troca de "faixa" do Pac-Man a cada ciclo
    const id = window.setInterval(() => {
      setLane((n) => (n + 1) % 5);
    }, 9000);

    return () => {
      html.classList.remove("lexis-troll-mode");
      body.classList.remove("lexis-troll-mode");
      window.clearInterval(id);
    };
  }, [on]);

  if (!on) return null;

  const topPct = 8 + lane * 18;

  return (
    <>
      <style jsx global>{`
        html.lexis-troll-mode,
        body.lexis-troll-mode {
          transform: rotate(180deg) !important;
          transform-origin: center center !important;
          min-height: 100% !important;
        }
        /* texto e cursor também “virados” de propósito */
        body.lexis-troll-mode * {
          cursor: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3Ccircle cx='12' cy='12' r='10' fill='%23FFD700'/%3E%3Cpolygon points='12,12 24,6 24,18' fill='%23000'/%3E%3C/svg%3E") 12 12, auto !important;
        }
        @keyframes lexis-pacman-run {
          0% {
            left: -8%;
            transform: scaleX(1);
          }
          49% {
            left: 102%;
            transform: scaleX(1);
          }
          50% {
            left: 102%;
            transform: scaleX(-1);
          }
          100% {
            left: -8%;
            transform: scaleX(-1);
          }
        }
        @keyframes lexis-pacman-chomp {
          0%,
          100% {
            clip-path: polygon(100% 0, 100% 100%, 0 100%, 0 0, 55% 50%);
          }
          50% {
            clip-path: polygon(100% 15%, 100% 85%, 0 100%, 0 0, 55% 50%);
          }
        }
        @keyframes lexis-ghost-bob {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-6px);
          }
        }
        .lexis-pacman-layer {
          position: fixed;
          inset: 0;
          z-index: 2147483000;
          pointer-events: none;
          overflow: hidden;
        }
        .lexis-pacman {
          position: absolute;
          width: 42px;
          height: 42px;
          border-radius: 50%;
          background: #ffd700;
          animation: lexis-pacman-run 9s linear infinite,
            lexis-pacman-chomp 0.28s steps(2) infinite;
          box-shadow: 0 0 12px #ffd700aa;
        }
        .lexis-pacman::after {
          content: "";
          position: absolute;
          top: 10px;
          right: 12px;
          width: 6px;
          height: 6px;
          background: #111;
          border-radius: 50%;
        }
        .lexis-ghost {
          position: absolute;
          width: 36px;
          height: 40px;
          border-radius: 18px 18px 4px 4px;
          animation: lexis-pacman-run 11s linear infinite reverse,
            lexis-ghost-bob 0.6s ease-in-out infinite;
          opacity: 0.95;
        }
        .lexis-ghost::before,
        .lexis-ghost::after {
          content: "";
          position: absolute;
          top: 12px;
          width: 8px;
          height: 8px;
          background: #fff;
          border-radius: 50%;
        }
        .lexis-ghost::before {
          left: 8px;
        }
        .lexis-ghost::after {
          right: 8px;
        }
        .lexis-troll-banner {
          position: fixed;
          left: 0;
          right: 0;
          top: 0;
          z-index: 2147483001;
          pointer-events: none;
          text-align: center;
          font-family: ui-monospace, monospace;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: #ffd700;
          background: linear-gradient(90deg, #000, #1a0033, #000);
          padding: 6px 8px;
          border-bottom: 2px solid #ffd700;
        }
        .lexis-dot-trail span {
          position: absolute;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #ffd700;
          opacity: 0.35;
        }
      `}</style>

      <div className="lexis-troll-banner" aria-hidden>
        LEXIS TROLL MODE · CABEÇA PRA BAIXO · PAC-MAN NÃO É OPCIONAL · WAKA WAKA
      </div>

      <div className="lexis-pacman-layer" aria-hidden>
        <div className="lexis-pacman" style={{ top: `${topPct}%` }} />
        <div
          className="lexis-ghost"
          style={{
            top: `${(topPct + 12) % 90}%`,
            background: "#ff4d6d",
            animationDelay: "-2s",
          }}
        />
        <div
          className="lexis-ghost"
          style={{
            top: `${(topPct + 28) % 90}%`,
            background: "#4cc9f0",
            animationDelay: "-4.5s",
            animationDuration: "13s, 0.6s",
          }}
        />
        <div
          className="lexis-ghost"
          style={{
            top: `${(topPct + 44) % 90}%`,
            background: "#b5179e",
            animationDelay: "-7s",
            animationDuration: "15s, 0.6s",
          }}
        />
        {/* pastilhas */}
        {Array.from({ length: 12 }).map((_, i) => (
          <span
            key={i}
            className="lexis-dot-trail"
            style={{
              position: "absolute",
              top: `${10 + (i % 5) * 18}%`,
              left: `${8 + i * 7}%`,
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "#ffd700",
              opacity: 0.4,
            }}
          />
        ))}
      </div>
    </>
  );
}
