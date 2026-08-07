/**
 * Estilos de contraste para gráficos Recharts.
 * Tooltip escuro + texto branco — legível em light e dark.
 */
import type { CSSProperties } from "react";

export const CHART_TOOLTIP_STYLE: CSSProperties = {
  backgroundColor: "#0f172a",
  border: "1px solid #334155",
  borderRadius: 12,
  boxShadow: "0 12px 28px rgba(0,0,0,0.35)",
  fontSize: 11,
  fontWeight: 800,
  color: "#f8fafc",
  padding: "10px 12px",
};

export const CHART_TOOLTIP_ITEM_STYLE: CSSProperties = {
  color: "#f8fafc",
  fontWeight: 700,
};

export const CHART_TOOLTIP_LABEL_STYLE: CSSProperties = {
  color: "#e2e8f0",
  fontWeight: 900,
  marginBottom: 4,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  fontSize: 10,
};

export const CHART_TICK_STYLE = {
  fill: "currentColor",
  fontSize: 10,
  fontWeight: 700 as const,
};

/** Props prontas para <Tooltip ... /> do Recharts */
export const chartTooltipProps = {
  contentStyle: CHART_TOOLTIP_STYLE,
  itemStyle: CHART_TOOLTIP_ITEM_STYLE,
  labelStyle: CHART_TOOLTIP_LABEL_STYLE,
  cursor: { fill: "rgba(148,163,184,0.25)" },
};
