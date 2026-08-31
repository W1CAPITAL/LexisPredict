"use client";
import React from "react";
import Link from "next/link";

/** Vitrine de scroll em tela cheia — não substitui o menu do gabinete. */
const SECTIONS = [
  { t: "Carteira", d: "Painel, fila e processos no mesmo gabinete." },
  { t: "Chat da equipe", d: "Texto, áudio, PDF e mídia entre a mesma empresa." },
  { t: "Tribunal", d: "DataJud + DJEN sem inventar volume." },
];

export default function VitrineFxPage() {
  return (
    <main className="min-h-screen bg-black text-white">
      {SECTIONS.map((s) => (
        <section key={s.t} className="min-h-screen flex flex-col items-center justify-center p-8 border-b border-white/10">
          <p className="text-[10px] uppercase tracking-[0.3em] text-white/50">LexisPredict</p>
          <h1 className="text-5xl font-black uppercase">{s.t}</h1>
          <p className="mt-3 max-w-md text-center text-white/70">{s.d}</p>
        </section>
      ))}
      <div className="p-8 text-center">
        <Link href="/mensagens" className="underline">Ir ao chat</Link>
      </div>
    </main>
  );
}
