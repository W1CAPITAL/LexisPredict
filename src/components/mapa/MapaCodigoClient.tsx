"use client";

/**
 * Embed do graphify (coloque graph.html em public/mapa/graph.html)
 * + painel de módulos densos derivados do grafo.
 */
const HOT_PATHS = [
  { path: "src/lib", nodes: 2142, color: "#4E79A7", label: "Núcleo / libs" },
  { path: "src/app", nodes: 912, color: "#F28E2B", label: "Rotas Next" },
  { path: "src/components", nodes: 866, color: "#E15759", label: "UI" },
  { path: "src/app/actions", nodes: 495, color: "#76B7B2", label: "Server actions" },
  { path: "src/components/ui", nodes: 372, color: "#59A14F", label: "Design system" },
  { path: "src/lib/ai", nodes: 159, color: "#EDC948", label: "IA" },
  { path: "src/lib/data-provider", nodes: 58, color: "#B07AA1", label: "Data provider" },
  { path: "src/lib/hybrid", nodes: 34, color: "#FF9DA7", label: "Hybrid / Sheets" },
];

export function MapaCodigoClient() {
  return (
    <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
      <aside
        className="lx-sidebar"
        style={{ borderRight: "1px solid var(--lx-border)", overflow: "auto" }}
      >
        <div style={{ padding: 12, borderBottom: "1px solid var(--lx-border)" }}>
          <div style={{ fontSize: 13, color: "var(--lx-text-muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Densidade por pasta
          </div>
          {HOT_PATHS.map((h) => (
            <div
              key={h.path}
              className="lx-card"
              style={{ marginBottom: 8, padding: "10px 12px" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: h.color,
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: 13, fontWeight: 600 }}>{h.label}</span>
              </div>
              <div className="lx-cnj" style={{ marginTop: 4 }}>
                {h.path}
              </div>
              <div style={{ marginTop: 6, fontSize: 12, color: "var(--lx-text-muted)" }}>
                ~{h.nodes} símbolos no grafo
              </div>
            </div>
          ))}
        </div>
        <div style={{ padding: 12, fontSize: 11, color: "var(--lx-text-dim)" }}>
          Grafo gerado via graphify. Use para achar acoplamento antes de lotes grandes.
        </div>
      </aside>
      <main style={{ flex: 1, position: "relative", background: "var(--lx-bg)" }}>
        <iframe
          title="Lexis graphify"
          src="/mapa/graph.html"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            border: "none",
            background: "#0f0f1a",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: 12,
            right: 12,
            background: "rgba(26,26,46,0.92)",
            border: "1px solid #2a2a4e",
            borderRadius: 8,
            padding: "8px 12px",
            fontSize: 11,
            color: "#aaa",
          }}
        >
          Se o iframe estiver vazio: copie <code>graph.html</code> → <code>public/mapa/graph.html</code>
        </div>
      </main>
    </div>
  );
}
