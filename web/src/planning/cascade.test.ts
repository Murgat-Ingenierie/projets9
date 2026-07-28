import { describe, it, expect } from "vitest";
import { computeCascade } from "./cascade";
import type { Dependency } from "../types";

// Helper local : amont → [avals], FS uniquement. Reprend la sémantique de l'ex
// `buildDependencyMaps` (module retiré à la bascule SVAR : il ne servait plus qu'à
// l'ancien Gantt). En production, cette table est construite par `cascadeShifts`.
function dependentsByAmontFrom(deps: Dependency[]): Map<number, number[]> {
  const m = new Map<number, number[]>();
  for (const d of deps) {
    if (d.type !== "FS") continue;
    if (!m.has(d.tache_amont_id)) m.set(d.tache_amont_id, []);
    m.get(d.tache_amont_id)!.push(d.tache_aval_id);
  }
  return m;
}

const dep = (id: number, amont: number, aval: number): Dependency => ({
  id, tache_amont_id: amont, tache_aval_id: aval, type: "FS",
});

// Construit les entrées de computeCascade à partir d'une liste de deps et d'une
// table id → date_debut, comme le faisait GanttPage au moment du drag.
function cascade(deps: Dependency[], starts: Record<number, string>, movedId: number, oldStartIso: string) {
  const dependentsByAmont = dependentsByAmontFrom(deps);
  const tasksById = new Map(
    Object.entries(starts).map(([id, date_debut]) => [Number(id), { date_debut }]),
  );
  return computeCascade({ movedId, oldStartIso, dependentsByAmont, tasksById });
}

describe("computeCascade", () => {
  it("propage sur une chaîne A→B→C (postérieures)", () => {
    const r = cascade([dep(1, 1, 2), dep(2, 2, 3)], { 1: "2026-01-01", 2: "2026-02-01", 3: "2026-03-01" }, 1, "2026-01-01");
    expect(r).toEqual(new Set([2, 3]));
  });

  it("exclut la tâche déplacée du résultat", () => {
    const r = cascade([dep(1, 1, 2)], { 1: "2026-01-01", 2: "2026-02-01" }, 1, "2026-01-01");
    expect(r.has(1)).toBe(false);
    expect(r).toEqual(new Set([2]));
  });

  it("ne décale pas une dépendante ANTÉRIEURE au début original", () => {
    const r = cascade([dep(1, 1, 2)], { 1: "2026-06-01", 2: "2026-01-01" }, 1, "2026-06-01");
    expect(r.size).toBe(0);
  });

  it("gère le branchement A→B, A→C", () => {
    const r = cascade([dep(1, 1, 2), dep(2, 1, 3)], { 1: "2026-01-01", 2: "2026-02-01", 3: "2026-03-01" }, 1, "2026-01-01");
    expect(r).toEqual(new Set([2, 3]));
  });

  it("diamant A→B, A→C, B→D, C→D : D collectée une seule fois", () => {
    const r = cascade(
      [dep(1, 1, 2), dep(2, 1, 3), dep(3, 2, 4), dep(4, 3, 4)],
      { 1: "2026-01-01", 2: "2026-02-01", 3: "2026-02-15", 4: "2026-03-01" },
      1, "2026-01-01",
    );
    expect(r).toEqual(new Set([2, 3, 4]));
  });

  it("robuste à un cycle A→B→A (pas de boucle infinie)", () => {
    const r = cascade([dep(1, 1, 2), dep(2, 2, 1)], { 1: "2026-01-01", 2: "2026-02-01" }, 1, "2026-01-01");
    expect(r).toEqual(new Set([2]));
  });

  it("ignore une dépendante absente de tasksById", () => {
    const r = cascade([dep(1, 1, 2)], { 1: "2026-01-01" }, 1, "2026-01-01");
    expect(r.size).toBe(0);
  });

  it("un maillon intermédiaire antérieur stoppe la propagation à travers lui (comportement actuel)", () => {
    // A(moved, début 06-01) → B(01-01, antérieure) → C(12-01, postérieure).
    // B n'est ni décalée ni mise en file → C n'est jamais atteinte.
    const r = cascade(
      [dep(1, 1, 2), dep(2, 2, 3)],
      { 1: "2026-06-01", 2: "2026-01-01", 3: "2026-12-01" },
      1, "2026-06-01",
    );
    expect(r.size).toBe(0);
  });
});
