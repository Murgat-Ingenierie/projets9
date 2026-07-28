import { describe, expect, it } from "vitest";
import { buildMeasureChart, DEFAULT_LAYOUT, type MeasurePoint } from "./measureChartGeometry";

const L = DEFAULT_LAYOUT;
const plotX0 = L.padding.left;
const plotX1 = L.width - L.padding.right;
const plotY0 = L.padding.top;
const plotY1 = L.height - L.padding.bottom;

describe("buildMeasureChart", () => {
  it("série vide : rien à tracer, pas de repères", () => {
    const g = buildMeasureChart([]);
    expect(g.points).toEqual([]);
    expect(g.path).toBe("");
    expect(g.xTicks).toEqual([]);
    expect(g.yTicks).toEqual([]);
  });

  it("trie par date croissante, quel que soit l'ordre d'entrée", () => {
    const m: MeasurePoint[] = [
      { date: "2026-03-01", valeur: 3 },
      { date: "2026-01-01", valeur: 1 },
      { date: "2026-02-01", valeur: 2 },
    ];
    const g = buildMeasureChart(m);
    expect(g.points.map((p) => p.date)).toEqual(["2026-01-01", "2026-02-01", "2026-03-01"]);
    // x strictement croissant
    expect(g.points[0].x).toBeLessThan(g.points[1].x);
    expect(g.points[1].x).toBeLessThan(g.points[2].x);
  });

  it("place les extrêmes sur les bords de la zone de tracé", () => {
    const g = buildMeasureChart([
      { date: "2026-01-01", valeur: 10 },
      { date: "2026-12-31", valeur: 50 },
    ]);
    expect(g.points[0].x).toBeCloseTo(plotX0);
    expect(g.points[1].x).toBeCloseTo(plotX1);
    // y INVERSÉ : la plus grande valeur est en HAUT (y le plus petit)
    expect(g.points[0].y).toBeCloseTo(plotY1); // valeur min -> bas
    expect(g.points[1].y).toBeCloseTo(plotY0); // valeur max -> haut
  });

  it("une valeur plus grande est TOUJOURS plus haute à l'écran", () => {
    const g = buildMeasureChart([
      { date: "2026-01-01", valeur: 5 },
      { date: "2026-02-01", valeur: 80 },
      { date: "2026-03-01", valeur: 40 },
    ]);
    const [a, b, c] = g.points;
    expect(b.y).toBeLessThan(a.y); // 80 au-dessus de 5
    expect(b.y).toBeLessThan(c.y); // 80 au-dessus de 40
    expect(c.y).toBeLessThan(a.y); // 40 au-dessus de 5
  });

  it("un seul point : centré, sans division par zéro", () => {
    const g = buildMeasureChart([{ date: "2026-05-05", valeur: 7 }]);
    expect(g.points).toHaveLength(1);
    expect(Number.isFinite(g.points[0].x)).toBe(true);
    expect(Number.isFinite(g.points[0].y)).toBe(true);
    expect(g.points[0].x).toBeCloseTo((plotX0 + plotX1) / 2);
    expect(g.xTicks).toHaveLength(1);
    expect(g.yTicks).toHaveLength(1);
  });

  it("série plate (valeurs identiques) : ligne médiane, pas de NaN", () => {
    const g = buildMeasureChart([
      { date: "2026-01-01", valeur: 42 },
      { date: "2026-02-01", valeur: 42 },
    ]);
    expect(g.points.every((p) => Number.isFinite(p.y))).toBe(true);
    expect(g.points[0].y).toBeCloseTo(g.points[1].y);
    expect(g.yTicks).toEqual([{ y: (plotY0 + plotY1) / 2, label: "42" }]);
  });

  it("dates identiques : pas de NaN en x", () => {
    const g = buildMeasureChart([
      { date: "2026-01-01", valeur: 1 },
      { date: "2026-01-01", valeur: 9 },
    ]);
    expect(g.points.every((p) => Number.isFinite(p.x))).toBe(true);
    expect(g.xTicks).toHaveLength(1);
  });

  it("construit un chemin SVG qui commence par M puis enchaîne des L", () => {
    const g = buildMeasureChart([
      { date: "2026-01-01", valeur: 1 },
      { date: "2026-02-01", valeur: 2 },
      { date: "2026-03-01", valeur: 3 },
    ]);
    expect(g.path.startsWith("M")).toBe(true);
    expect(g.path.match(/L/g)).toHaveLength(2);
    expect(g.path).not.toMatch(/NaN/);
  });

  it("étiquettes : dates en JJ/MM, valeurs arrondies au centième", () => {
    const g = buildMeasureChart([
      { date: "2026-01-09", valeur: 0 },
      { date: "2026-11-24", valeur: 1 / 3 },
    ]);
    expect(g.xTicks.map((t) => t.label)).toEqual(["09/01", "24/11"]);
    expect(g.yTicks.map((t) => t.label)).toEqual(["0", "0.17", "0.33"]);
  });

  it("ne modifie pas le tableau reçu", () => {
    const m: MeasurePoint[] = [
      { date: "2026-03-01", valeur: 3 },
      { date: "2026-01-01", valeur: 1 },
    ];
    buildMeasureChart(m);
    expect(m.map((x) => x.date)).toEqual(["2026-03-01", "2026-01-01"]);
  });
});
