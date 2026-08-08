/**
 * Estilos de contraste para gráficos Recharts.
 * Preferir content={<LexisChartTooltip />} — o itemStyle nativo
 * herda a cor da série e pode ficar preto no preto.
 */
import type { CSSProperties } from "react";

/** Fallback se não usar o componente custom */
export const CHART_TOOLTIP_STYLE: CSSProperties = {
  backgroundColor: "#ffffff",
  border: "1px solid #cbd5e1",
  borderRadius: 12,
  boxShadow: "0 12px 28px rgba(15,23,42,0.18)",
  fontSize: 12,
  fontWeight: 800,
  color: "#0f172a",
  padding: "10px 14px",
};

export const CHART_TOOLTIP_ITEM_STYLE: CSSProperties = {
  color: "#0f172a",
  fontWeight: 700,
};

export const CHART_TOOLTIP_LABEL_STYLE: CSSProperties = {
  color: "#0f172a",
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

/** @deprecated Preferir content={<LexisChartTooltip />} */
export const chartTooltipProps = {
  contentStyle: CHART_TOOLTIP_STYLE,
  itemStyle: CHART_TOOLTIP_ITEM_STYLE,
  labelStyle: CHART_TOOLTIP_LABEL_STYLE,
  cursor: { fill: "rgba(148,163,184,0.2)" },
  // força cor do texto mesmo quando a série é escura
  wrapperStyle: { outline: "none", zIndex: 40 },
};
