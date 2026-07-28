// Courbe « Mesure dans le temps » (SPEC §4, écran 8). SVG en propre — pas de
// librairie de graphes (cf. measureChartGeometry.ts pour la géométrie, pure et testée).

import { buildMeasureChart, DEFAULT_LAYOUT, type MeasurePoint } from "./measureChartGeometry";

interface Props {
  measures: MeasurePoint[];
  /** Unité de l'epic (INV-20 : commune à toutes ses mesures), pour l'axe Y. */
  unite?: string;
}

export function MeasureChart({ measures, unite }: Props) {
  const g = buildMeasureChart(measures);
  const { width, height } = DEFAULT_LAYOUT;

  if (g.points.length === 0) {
    return <p className="muted">Aucune mesure : la courbe s'affichera dès la première saisie.</p>;
  }

  return (
    <svg
      className="measure-chart"
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      role="img"
      aria-label={`Évolution de la mesure dans le temps (${g.points.length} point${g.points.length > 1 ? "s" : ""})`}
    >
      {/* Repères horizontaux + graduations de l'axe Y */}
      {g.yTicks.map((t) => (
        <g key={`y${t.y}`}>
          <line x1={g.plot.x0} y1={t.y} x2={g.plot.x1} y2={t.y} className="measure-chart-grid" />
          <text x={g.plot.x0 - 8} y={t.y + 4} className="measure-chart-label" textAnchor="end">
            {t.label}
          </text>
        </g>
      ))}

      {/* Axes */}
      <line x1={g.plot.x0} y1={g.plot.y0} x2={g.plot.x0} y2={g.plot.y1} className="measure-chart-axis" />
      <line x1={g.plot.x0} y1={g.plot.y1} x2={g.plot.x1} y2={g.plot.y1} className="measure-chart-axis" />

      {/* Graduations de l'axe X */}
      {g.xTicks.map((t) => (
        <text
          key={`x${t.x}`}
          x={t.x}
          y={g.plot.y1 + 18}
          className="measure-chart-label"
          textAnchor={t.x === g.plot.x0 ? "start" : t.x === g.plot.x1 ? "end" : "middle"}
        >
          {t.label}
        </text>
      ))}

      {/* La série : la polyligne n'a de sens qu'à partir de deux points */}
      {g.points.length > 1 && <path d={g.path} className="measure-chart-line" />}
      {g.points.map((p) => (
        <circle key={`${p.date}-${p.valeur}`} cx={p.x} cy={p.y} r={3.5} className="measure-chart-dot">
          <title>{`${p.date} — ${p.valeur}${unite ? ` ${unite}` : ""}`}</title>
        </circle>
      ))}

      {unite && (
        <text x={g.plot.x0 - 8} y={g.plot.y0 - 2} className="measure-chart-label" textAnchor="end">
          {unite}
        </text>
      )}
    </svg>
  );
}
