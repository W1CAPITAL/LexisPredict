import { MapaCodigoClient } from "@/components/mapa/MapaCodigoClient";

export const metadata = {
  title: "Mapa do código · LexisPredict",
  description: "Grafo de dependências do Lexis — visão operacional do código",
};

export default function MapaCodigoPage() {
  return (
    <div className="lx-shell" style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <header
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid var(--lx-border)",
          background: "var(--lx-bg-elevated)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div>
          <div style={{ fontSize: 13, color: "var(--lx-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            LexisPredict · arquitetura
          </div>
          <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Mapa do código</h1>
        </div>
        <div className="lx-pipeline">
          <span>4.378 nós</span>
          <span className="arrow">·</span>
          <span>13.547 arestas</span>
          <span className="arrow">·</span>
          <span>225 comunidades</span>
        </div>
      </header>
      <MapaCodigoClient />
    </div>
  );
}
