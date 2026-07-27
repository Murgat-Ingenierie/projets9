import { describe, it, expect } from "vitest";
import { planBlockShift, planCascadeShifts, planGroupShifts, type FsEdge, type TaskDates } from "./cascadeShifts";

const dates = (entries: [number, string, string][]): Map<number, TaskDates> =>
  new Map(entries.map(([id, d, f]) => [id, { date_debut: d, date_fin: f }]));

describe("planCascadeShifts", () => {
  it("delta nul → aucun décalage", () => {
    const edges: FsEdge[] = [{ amontId: 1, avalId: 2 }];
    const taskDates = dates([[1, "2026-01-01", "2026-01-05"], [2, "2026-01-06", "2026-01-10"]]);
    expect(planCascadeShifts({ movedId: 1, oldStartIso: "2026-01-01", deltaDays: 0, edges, taskDates })).toEqual([]);
  });

  it("chaîne A→B→C : décale B et C du delta (pas A)", () => {
    const edges: FsEdge[] = [{ amontId: 1, avalId: 2 }, { amontId: 2, avalId: 3 }];
    const taskDates = dates([
      [1, "2026-01-01", "2026-01-05"],
      [2, "2026-01-06", "2026-01-10"],
      [3, "2026-01-11", "2026-01-15"],
    ]);
    const shifts = planCascadeShifts({ movedId: 1, oldStartIso: "2026-01-01", deltaDays: 2, edges, taskDates });
    expect(shifts).toEqual([
      { id: 2, date_debut: "2026-01-08", date_fin: "2026-01-12" },
      { id: 3, date_debut: "2026-01-13", date_fin: "2026-01-17" },
    ]);
  });

  it("delta négatif (avance) décale aussi vers l'amont dans le temps", () => {
    const edges: FsEdge[] = [{ amontId: 1, avalId: 2 }];
    const taskDates = dates([[1, "2026-01-10", "2026-01-15"], [2, "2026-01-16", "2026-01-20"]]);
    const shifts = planCascadeShifts({ movedId: 1, oldStartIso: "2026-01-10", deltaDays: -3, edges, taskDates });
    expect(shifts).toEqual([{ id: 2, date_debut: "2026-01-13", date_fin: "2026-01-17" }]);
  });

  it("ignore une dépendante ANTÉRIEURE au début original de la tâche déplacée", () => {
    // La dépendante 2 commence avant le début original de 1 → non décalée.
    const edges: FsEdge[] = [{ amontId: 1, avalId: 2 }];
    const taskDates = dates([[1, "2026-02-10", "2026-02-15"], [2, "2026-01-01", "2026-01-05"]]);
    expect(planCascadeShifts({ movedId: 1, oldStartIso: "2026-02-10", deltaDays: 4, edges, taskDates })).toEqual([]);
  });

  it("robuste aux cycles (chaque tâche décalée une seule fois)", () => {
    const edges: FsEdge[] = [{ amontId: 1, avalId: 2 }, { amontId: 2, avalId: 1 }];
    const taskDates = dates([[1, "2026-01-01", "2026-01-05"], [2, "2026-01-06", "2026-01-10"]]);
    const shifts = planCascadeShifts({ movedId: 1, oldStartIso: "2026-01-01", deltaDays: 1, edges, taskDates });
    expect(shifts.map((s) => s.id)).toEqual([2]);
  });
});

describe("planGroupShifts", () => {
  const taskDates = dates([
    [1, "2026-01-01", "2026-01-05"],
    [2, "2026-02-01", "2026-02-10"],
    [3, "2026-03-01", "2026-03-03"],
  ]);

  it("décale les sélectionnées SAUF la tâche déplacée, du même delta", () => {
    const shifts = planGroupShifts({ movedId: 1, deltaDays: 3, selectedIds: [1, 2, 3], taskDates });
    expect(shifts).toEqual([
      { id: 2, date_debut: "2026-02-04", date_fin: "2026-02-13" },
      { id: 3, date_debut: "2026-03-04", date_fin: "2026-03-06" },
    ]);
  });

  it("delta nul → aucun décalage", () => {
    expect(planGroupShifts({ movedId: 1, deltaDays: 0, selectedIds: [1, 2], taskDates })).toEqual([]);
  });

  it("ignore les ids sélectionnés sans dates connues", () => {
    const shifts = planGroupShifts({ movedId: 1, deltaDays: -1, selectedIds: [1, 2, 99], taskDates });
    expect(shifts.map((s) => s.id)).toEqual([2]);
  });
});

describe("planBlockShift", () => {
  const projects = [
    { id: 1, epic_trigramme: "O50", date_debut: "2026-01-01", date_fin: "2026-02-01" },
    { id: 2, epic_trigramme: "O50", date_debut: "2026-03-01", date_fin: "2026-03-20" },
    { id: 3, epic_trigramme: "RDR", date_debut: "2026-05-01", date_fin: "2026-05-10" },
    { id: 4, epic_trigramme: "RDR", date_debut: "2026-06-01", date_fin: "2026-06-15" }, // sans tâche
  ];
  const tasks = [
    { id: 11, projet_id: 1, date_debut: "2026-01-05", date_fin: "2026-01-20" },
    { id: 12, projet_id: 1, date_debut: "2026-01-21", date_fin: "2026-01-30" },
    { id: 21, projet_id: 2, date_debut: "2026-03-02", date_fin: "2026-03-10" },
    { id: 31, projet_id: 3, date_debut: "2026-05-02", date_fin: "2026-05-08" },
  ];

  it("delta nul → aucun décalage", () => {
    expect(planBlockShift({ kind: "proj", ref: "1", deltaDays: 0, projects, tasks })).toEqual({ projects: [], tasks: [] });
  });

  it("projet : décale le projet + SES tâches (pas les autres projets)", () => {
    const res = planBlockShift({ kind: "proj", ref: "1", deltaDays: 2, projects, tasks });
    expect(res.projects).toEqual([
      { id: 1, before: { date_debut: "2026-01-01", date_fin: "2026-02-01" }, after: { date_debut: "2026-01-03", date_fin: "2026-02-03" } },
    ]);
    expect(res.tasks).toEqual([
      { id: 11, before: { date_debut: "2026-01-05", date_fin: "2026-01-20" }, after: { date_debut: "2026-01-07", date_fin: "2026-01-22" } },
      { id: 12, before: { date_debut: "2026-01-21", date_fin: "2026-01-30" }, after: { date_debut: "2026-01-23", date_fin: "2026-02-01" } },
    ]);
  });

  it("epic : décale TOUS les projets de l'epic + leurs tâches", () => {
    const res = planBlockShift({ kind: "epic", ref: "O50", deltaDays: -1, projects, tasks });
    expect(res.projects.map((p) => p.id)).toEqual([1, 2]); // pas le projet 3 (epic RDR)
    expect(res.tasks.map((t) => t.id)).toEqual([11, 12, 21]); // pas la tâche 31
    expect(res.projects[1].after).toEqual({ date_debut: "2026-02-28", date_fin: "2026-03-19" });
    expect(res.tasks[2].after).toEqual({ date_debut: "2026-03-01", date_fin: "2026-03-09" });
  });

  it("tâches masquées comprises : décale même les tâches hors filtre (bloc entier)", () => {
    // Le filtre équipe ne réduit PAS l'entrée `tasks` ici : on passe l'état complet,
    // donc toutes les tâches du projet suivent le bloc, visibles ou non.
    const res = planBlockShift({ kind: "proj", ref: "1", deltaDays: 5, projects, tasks });
    expect(res.tasks.map((t) => t.id)).toEqual([11, 12]);
  });

  it("projet sans tâche : décale le projet seul (tasks vide)", () => {
    const res = planBlockShift({ kind: "proj", ref: "4", deltaDays: 4, projects, tasks });
    expect(res.projects).toEqual([
      { id: 4, before: { date_debut: "2026-06-01", date_fin: "2026-06-15" }, after: { date_debut: "2026-06-05", date_fin: "2026-06-19" } },
    ]);
    expect(res.tasks).toEqual([]);
  });
});
