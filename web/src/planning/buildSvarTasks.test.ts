import { describe, it, expect } from "vitest";
import { buildSvarTasks, type BuildSvarTasksInput } from "./buildSvarTasks";
import type { Epic, Milestone, Project, Task } from "../types";

const epic = (trigramme: string, nom: string): Epic => ({ trigramme, nom }) as unknown as Epic;
const proj = (id: number, tri: string, nom: string): Project =>
  ({ id, epic_trigramme: tri, nom, date_debut: "2026-01-01", date_fin: "2026-02-01" }) as unknown as Project;
const task = (id: number, projet_id: number, nom: string, statut = "ouvert"): Task =>
  ({ id, projet_id, nom, date_debut: "2026-01-05", date_fin: "2026-01-20", statut }) as unknown as Task;
const ms = (id: number, date: string): Milestone => ({ id, date, nom: `J${id}` }) as unknown as Milestone;

function base(over: Partial<BuildSvarTasksInput> = {}): BuildSvarTasksInput {
  return {
    epics: [], projects: [], tasksByProject: new Map(), milestones: [],
    teamFilterProjectIds: null, teamFilterTaskIds: null, ...over,
  };
}
const byId = (rows: { id?: unknown }[]) => new Map(rows.map((r) => [r.id, r]));

describe("buildSvarTasks", () => {
  it("vide → []", () => {
    expect(buildSvarTasks(base())).toEqual([]);
  });

  it("arbre epic (summary) → projet (summary) → tâche, relié par parent", () => {
    const out = buildSvarTasks(base({
      epics: [epic("O50", "Optimisation")],
      projects: [proj(1, "O50", "Capteurs")],
      tasksByProject: new Map([[1, [task(11, 1, "Choix")]]]),
    }));
    const m = byId(out);
    expect(m.get("epic:O50")).toMatchObject({ type: "summary", text: "Optimisation" });
    expect(m.get("proj:1")).toMatchObject({ type: "summary", parent: "epic:O50", text: "Capteurs" });
    expect(m.get("task:11")).toMatchObject({ type: "task", parent: "proj:1", text: "Choix" });
  });

  it("jalons en type milestone, triés par date, en tête", () => {
    const out = buildSvarTasks(base({ milestones: [ms(1, "2026-03-01"), ms(2, "2026-02-01")] }));
    expect(out.map((r) => r.id)).toEqual(["ms:2", "ms:1"]);
    expect(out[0]).toMatchObject({ type: "milestone", start: new Date("2026-02-01T00:00:00") });
  });

  it("progress 100 pour une tâche archivée", () => {
    const out = buildSvarTasks(base({
      epics: [epic("O50", "A")], projects: [proj(1, "O50", "P")],
      tasksByProject: new Map([[1, [task(11, 1, "T", "archive")]]]),
    }));
    expect(byId(out).get("task:11")).toMatchObject({ progress: 100 });
  });

  it("filtre équipe (projet) : masque hors scope et saute l'epic vide", () => {
    const out = buildSvarTasks(base({
      epics: [epic("O50", "A"), epic("RDR", "B")],
      projects: [proj(1, "O50", "P1"), proj(2, "RDR", "P2")],
      teamFilterProjectIds: new Set([1]),
    }));
    const ids = out.map((r) => r.id);
    expect(ids).toContain("epic:O50");
    expect(ids).toContain("proj:1");
    expect(ids).not.toContain("epic:RDR");
    expect(ids).not.toContain("proj:2");
  });

  it("filtre équipe (tâche) : seules les tâches en scope", () => {
    const out = buildSvarTasks(base({
      epics: [epic("O50", "A")], projects: [proj(1, "O50", "P")],
      tasksByProject: new Map([[1, [task(11, 1, "T1"), task(12, 1, "T2")]]]),
      teamFilterTaskIds: new Set([11]),
    }));
    const ids = out.map((r) => r.id);
    expect(ids).toContain("task:11");
    expect(ids).not.toContain("task:12");
  });

  it("ordonne les epics par nom (fr) et les projets par id", () => {
    const out = buildSvarTasks(base({
      epics: [epic("ZZZ", "Alpha"), epic("AAA", "Zeta")],
      projects: [proj(5, "AAA", "p5"), proj(3, "AAA", "p3"), proj(9, "ZZZ", "p9")],
    }));
    const structural = out.filter((r) => r.type !== "milestone").map((r) => r.id);
    expect(structural).toEqual(["epic:ZZZ", "proj:9", "epic:AAA", "proj:3", "proj:5"]);
  });

  it("epic ouvert (open:true) ; projet avec tâches = summary replié (open:false)", () => {
    const out = buildSvarTasks(base({
      epics: [epic("O50", "A")], projects: [proj(1, "O50", "P")],
      tasksByProject: new Map([[1, [task(11, 1, "T")]]]),
    }));
    const m = byId(out);
    expect(m.get("epic:O50")).toMatchObject({ open: true });
    expect(m.get("proj:1")).toMatchObject({ type: "summary", open: false });
  });

  it("un projet sans tâche est une feuille (type task), pas un summary vide", () => {
    const out = buildSvarTasks(base({ epics: [epic("O50", "A")], projects: [proj(1, "O50", "P")] }));
    expect(byId(out).get("proj:1")).toMatchObject({ type: "task" });
  });

  it("groupByEpic:false → aucune ligne epic ; projets à la racine (parent absent)", () => {
    const out = buildSvarTasks(base({
      epics: [epic("O50", "Optimisation")],
      projects: [proj(1, "O50", "Capteurs")],
      tasksByProject: new Map([[1, [task(11, 1, "Choix")]]]),
      groupByEpic: false,
    }));
    expect(out.map((r) => r.id)).not.toContain("epic:O50");
    expect(byId(out).get("proj:1")).toMatchObject({ type: "summary", parent: undefined });
    expect(byId(out).get("task:11")).toMatchObject({ parent: "proj:1" });
  });

  it("groupByEpic:false garde le tri (epic par nom, projets par id)", () => {
    const out = buildSvarTasks(base({
      epics: [epic("ZZZ", "Alpha"), epic("AAA", "Zeta")],
      projects: [proj(5, "AAA", "p5"), proj(3, "AAA", "p3"), proj(9, "ZZZ", "p9")],
      groupByEpic: false,
    }));
    expect(out.filter((r) => r.type !== "milestone").map((r) => r.id)).toEqual(["proj:9", "proj:3", "proj:5"]);
  });

  it("filtres équipe combinés (projet + tâche) : masque hors scope", () => {
    const out = buildSvarTasks(base({
      epics: [epic("O50", "A")],
      projects: [proj(1, "O50", "P1"), proj(2, "O50", "P2")],
      tasksByProject: new Map([[1, [task(11, 1, "T1"), task(12, 1, "T2")]]]),
      teamFilterProjectIds: new Set([1]),
      teamFilterTaskIds: new Set([11]),
    }));
    const ids = out.map((r) => r.id);
    expect(ids).toContain("proj:1");
    expect(ids).not.toContain("proj:2");
    expect(ids).toContain("task:11");
    expect(ids).not.toContain("task:12");
  });

  it("openState surcharge l'état déplié par défaut (epic ouvert, projet replié)", () => {
    const out = buildSvarTasks(base({
      epics: [epic("O50", "A")],
      projects: [proj(1, "O50", "P")],
      tasksByProject: new Map([[1, [task(11, 1, "T")]]]),
      openState: new Map([["epic:O50", false], ["proj:1", true]]),
    }));
    const m = byId(out);
    expect(m.get("epic:O50")).toMatchObject({ open: false }); // surcharge du défaut (true)
    expect(m.get("proj:1")).toMatchObject({ open: true }); // surcharge du défaut (false)
  });
});
