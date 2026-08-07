"use client";

/**
 * Tooltip de gráfico com contraste garantido.
 * Fundo claro + texto preto — não herda a cor da série (bug do Recharts).
 */
import React from "react";

type PayloadItem = {
  name?: string;
  value?: string | number;
  dataKey?: string | number;
  color?: string;
  payload?: Record<string, unknown>;
};

type Props = {
  active?: boolean;
  payload?: PayloadItem[];
  label?: string | number;
};

export function LexisChartTooltip({ active, payload, label }: Props) {
  if (!active || !payload?.length) return null;

  return (
    <div
      className="lexis-chart-tooltip"
      style={{
        backgroundColor: "#ffffff",
        border: "1px solid #cbd5e1",
        borderRadius: 12,
        padding: "10px 14px",
        boxShadow: "0 12px 28px rgba(15,23,42,0.18)",
        minWidth: 120,
        maxWidth: 260,
        color: "#0f172a",
        pointerEvents: "none",
      }}
    >
      {label != null && String(label).length > 0 && (
        <p
          style={{
            margin: 0,
            marginBottom: 6,
            fontSize: 10,
            fontWeight: 900,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "#0f172a",
          }}
        >
          {String(label)}
        </p>
      )}
      <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
        {payload.map((p, i) => {
          const name = p.name ?? String(p.dataKey ?? "Valor");
          const value = p.value ?? "—";
          const swatch = p.color || "#64748b";
          return (
            <li
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginTop: i === 0 ? 0 : 4,
                fontSize: 12,
                fontWeight: 700,
                color: "#0f172a",
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 999,
                  backgroundColor: swatch,
                  flexShrink: 0,
                  border: "1px solid #94a3b8",
                }}
              />
              <span style={{ color: "#334155" }}>{name}</span>
              <span style={{ marginLeft: "auto", color: "#0f172a", fontWeight: 900 }}>
                {typeof value === "number" ? value.toLocaleString("pt-BR") : String(value)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Props para <Tooltip content={<LexisChartTooltip />} ... /> */
export const lexisTooltipSlotProps = {
  content: <LexisChartTooltip />,
  cursor: { fill: "rgba(148,163,184,0.2)" },
  wrapperStyle: { outline: "none", zIndex: 50 },
};
