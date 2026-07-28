// Géométrie de la courbe « Mesure dans le temps » (SPEC §4, écran 8).
//
// Pur : ne dépend ni du DOM ni de React → testable directement. Le rendu SVG
// correspondant est dans MeasureChart.tsx. Choix délibéré de ne PAS ajouter de
// librairie de graphes : une série temporelle simple ne le justifie pas, et le
// projet évite les dépendances superflues (bundle, supply-chain, CSP).

export interface MeasurePoint {
  /** ISO `YYYY-MM-DD`. */
  date: string;
  valeur: number;
}

export interface ChartLayout {
  width: number;
  height: number;
  padding: { top: number; right: number; bottom: number; left: number };
}

export interface PlottedPoint {
  x: number;
  y: number;
  date: string;
  valeur: number;
}

export interface ChartGeometry {
  /** Points triés par date croissante, projetés dans le repère SVG. */
  points: PlottedPoint[];
  /** Chemin `d` de la polyligne ("" si aucun point). */
  path: string;
  xTicks: { x: number; label: string }[];
  yTicks: { y: number; label: string }[];
  /** Zone de tracé (hors marges), pour les axes. */
  plot: { x0: number; y0: number; x1: number; y1: number };
}

export const DEFAULT_LAYOUT: ChartLayout = {
  width: 640,
  height: 220,
  padding: { top: 12, right: 16, bottom: 28, left: 48 },
};

function dayNumber(iso: string): number {
  return Math.floor(Date.parse(`${iso}T00:00:00Z`) / 86_400_000);
}

/** `2026-07-28` → `28/07`. */
function shortDate(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

/** Évite « 12.300000000000001 » sans imposer de décimales inutiles. */
function fmtValue(v: number): string {
  return String(Math.round(v * 100) / 100);
}

export function buildMeasureChart(
  measures: MeasurePoint[],
  layout: ChartLayout = DEFAULT_LAYOUT,
): ChartGeometry {
  const { width, height, padding } = layout;
  const plot = {
    x0: padding.left,
    y0: padding.top,
    x1: width - padding.right,
    y1: height - padding.bottom,
  };

  const sorted = [...measures].sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length === 0) {
    return { points: [], path: "", xTicks: [], yTicks: [], plot };
  }

  const days = sorted.map((m) => dayNumber(m.date));
  const values = sorted.map((m) => m.valeur);
  const dMin = Math.min(...days);
  const dMax = Math.max(...days);
  const vMin = Math.min(...values);
  const vMax = Math.max(...values);

  // Séries dégénérées (un seul point, ou toutes les dates/valeurs identiques) :
  // on centre au lieu de diviser par zéro.
  const spanX = dMax - dMin;
  const spanY = vMax - vMin;
  const midX = (plot.x0 + plot.x1) / 2;
  const midY = (plot.y0 + plot.y1) / 2;

  const points: PlottedPoint[] = sorted.map((m, i) => ({
    x: spanX === 0 ? midX : plot.x0 + ((days[i] - dMin) / spanX) * (plot.x1 - plot.x0),
    // y inversé : l'origine SVG est en haut à gauche.
    y: spanY === 0 ? midY : plot.y1 - ((m.valeur - vMin) / spanY) * (plot.y1 - plot.y0),
    date: m.date,
    valeur: m.valeur,
  }));

  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");

  // Axe Y : min / milieu / max (un seul repère si la série est plate).
  const yTicks =
    spanY === 0
      ? [{ y: midY, label: fmtValue(vMin) }]
      : [
          { y: plot.y1, label: fmtValue(vMin) },
          { y: (plot.y0 + plot.y1) / 2, label: fmtValue((vMin + vMax) / 2) },
          { y: plot.y0, label: fmtValue(vMax) },
        ];

  // Axe X : première et dernière date (une seule si elles coïncident).
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const xTicks =
    spanX === 0
      ? [{ x: midX, label: shortDate(first.date) }]
      : [
          { x: plot.x0, label: shortDate(first.date) },
          { x: plot.x1, label: shortDate(last.date) },
        ];

  return { points, path, xTicks, yTicks, plot };
}
