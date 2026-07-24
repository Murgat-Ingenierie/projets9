import { describe, it, expect } from "vitest";
import { buildGanttTasks, type BuildGanttTasksInput } from "./buildGanttTasks";
import type { Epic, Milestone, Project, Task } from "../types";

const epic = (trigramme: string, nom: string, couleur: string | null = null): Epic =>
  ({ trigramme, nom, couleur }) as unknown as Epic;
const proj = (id: number, tri: string, nom: string, d1 = "2026-01-01", d2 = "2026-02-01"): Project =>
  ({ id, epic_trigramme: tri, nom, date_debut: d1, date_fin: d2 }) as unknown as Project;
const task = (id: number, projet_id: number, nom: string, d1 = "2026-01-01", d2 = "2026-01-15"): Task =>
  ({ id, projet_id, nom, date_debut: d1, date_fin: d2 }) as unknown as Task;
const ms = (id: number, date: string): Milestone => ({ id, date }) as unknown as Milestone;

function base(over: Partial<BuildGanttTasksInput> = {}): BuildGanttTasksInput {
  return {
    epics: [], projects: [], tasksByProject: new Map(), milestones: [],
    depsByAval: new Map(), expandedProjects: new Set(), editMode: false,
    groupByEpic: false, collapsedEpics: new Set(),
    teamFilterTaskIds: null, teamFilterProjectIds: null, milestoneRowCount: 1,
    ...over,
  };
}
const ids = (rows: { id: string }[]) => rows.map((r) => r.id);

describe("buildGanttTasks", () => {
  it("entrée vide → aucune ligne", () => {
    expect(buildGanttTasks(base())).toEqual([]);
  });

  it("jalons : milestoneRowCount lignes (ancre « Jalons » + espaceuses), ancrées au plus tôt", () => {
    const out = buildGanttTasks(base({ milestones: [ms(1, "2026-03-01"), ms(2, "2026-02-01")], milestoneRowCount: 3 }));
    expect(ids(out)).toEqual(["milestone-anchor", "milestone-spacer-1", "milestone-spacer-2"]);
    expect(out[0].name).toBe("Jalons");
    expect(out[1].name).toBe("");
    expect(out[0].start).toEqual(new Date("2026-02-01T00:00:00"));
  });

  it("sans groupByEpic : projets = lignes (type task), pas d'en-tête epic", () => {
    const out = buildGanttTasks(base({
      epics: [epic("O50", "Optimisation")],
      projects: [proj(1, "O50", "Capteurs"), proj(2, "O50", "Regulation")],
    }));
    expect(ids(out)).toEqual(["proj-1", "proj-2"]);
    expect(out.every((r) => r.type === "task")).toBe(true);
  });

  it("avec groupByEpic : en-tête epic (type project) + projets ; replié masque les projets", () => {
    const input = base({
      epics: [epic("O50", "Optimisation")],
      projects: [proj(1, "O50", "Capteurs"), proj(2, "O50", "Regulation")],
      groupByEpic: true,
    });
    expect(ids(buildGanttTasks(input))).toEqual(["epic-O50", "proj-1", "proj-2"]);
    expect(buildGanttTasks(input)[0].type).toBe("project");
    const collapsed = buildGanttTasks({ ...input, collapsedEpics: new Set(["O50"]) });
    expect(ids(collapsed)).toEqual(["epic-O50"]);
  });

  it("projet déplié → tâches visibles avec dépendances mappées", () => {
    const out = buildGanttTasks(base({
      epics: [epic("O50", "Optimisation")],
      projects: [proj(1, "O50", "Capteurs")],
      tasksByProject: new Map([[1, [task(11, 1, "Choix"), task(12, 1, "Pose")]]]),
      expandedProjects: new Set([1]),
      depsByAval: new Map([[12, [11]]]),
    }));
    expect(ids(out)).toEqual(["proj-1", "task-11", "task-12"]);
    expect(out.find((r) => r.id === "task-12")!.dependencies).toEqual(["task-11"]);
  });

  it("filtre équipe (projets) : masque hors scope, saute l'epic sans projet visible", () => {
    const out = buildGanttTasks(base({
      epics: [epic("O50", "A"), epic("RDR", "B")],
      projects: [proj(1, "O50", "P1"), proj(2, "RDR", "P2")],
      teamFilterProjectIds: new Set([1]),
    }));
    expect(ids(out)).toEqual(["proj-1"]);
  });

  it("filtre équipe (tâches) : seules les tâches en scope sont rendues", () => {
    const out = buildGanttTasks(base({
      epics: [epic("O50", "A")],
      projects: [proj(1, "O50", "P1")],
      tasksByProject: new Map([[1, [task(11, 1, "T1"), task(12, 1, "T2")]]]),
      expandedProjects: new Set([1]),
      teamFilterTaskIds: new Set([11]),
      teamFilterProjectIds: new Set([1]),
    }));
    expect(ids(out)).toEqual(["proj-1", "task-11"]);
  });

  it("ordonne les epics par nom (fr) et les projets par id", () => {
    const out = buildGanttTasks(base({
      epics: [epic("ZZZ", "Alpha"), epic("AAA", "Zeta")],
      projects: [proj(5, "AAA", "p5"), proj(3, "AAA", "p3"), proj(9, "ZZZ", "p9")],
    }));
    expect(ids(out)).toEqual(["proj-9", "proj-3", "proj-5"]);
  });

  it("editMode pilote isDisabled des barres", () => {
    expect(buildGanttTasks(base({ epics: [epic("O50", "A")], projects: [proj(1, "O50", "P")], editMode: false }))[0].isDisabled).toBe(true);
    expect(buildGanttTasks(base({ epics: [epic("O50", "A")], projects: [proj(1, "O50", "P")], editMode: true }))[0].isDisabled).toBe(false);
  });
});
