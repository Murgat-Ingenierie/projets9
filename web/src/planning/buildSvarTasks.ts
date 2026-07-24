import type { ITask } from "@svar-ui/react-gantt";
import type { Epic, Milestone, Project, Task } from "../types";
import { toDate } from "./dates";

// État du planning → arbre de tâches SVAR (ITask[]), via la hiérarchie NATIVE de
// SVAR (`parent` + `type`) : epic (summary) → projet (summary) → tâche. Les jalons
// sont des `milestone` au niveau racine (le rendu multi-projets est un point de
// conception à traiter plus tard). C9 Phase 2b — pendant SVAR de buildGanttTasks.
export interface BuildSvarTasksInput {
  epics: Epic[];
  projects: Project[];
  /** projet_id → tâches du projet. */
  tasksByProject: Map<number, Task[]>;
  milestones: Milestone[];
  /** null = pas de filtre équipe. */
  teamFilterProjectIds: Set<number> | null;
  teamFilterTaskIds: Set<number> | null;
}

export function buildSvarTasks(input: BuildSvarTasksInput): ITask[] {
  const { epics, projects, tasksByProject, milestones, teamFilterProjectIds, teamFilterTaskIds } = input;
  const out: ITask[] = [];
  const epicByTri = new Map(epics.map((e) => [e.trigramme, e]));

  // Jalons en tête (comme la swimlane actuelle), un par jalon.
  for (const m of [...milestones].sort((a, b) => a.date.localeCompare(b.date))) {
    out.push({ id: `ms:${m.id}`, text: m.nom, type: "milestone", start: toDate(m.date) });
  }

  // Projets groupés par epic (filtre équipe au niveau projet).
  const byEpic = new Map<string, Project[]>();
  for (const p of projects) {
    if (teamFilterProjectIds && !teamFilterProjectIds.has(p.id)) continue;
    if (!byEpic.has(p.epic_trigramme)) byEpic.set(p.epic_trigramme, []);
    byEpic.get(p.epic_trigramme)!.push(p);
  }

  const sortedTris = [...byEpic.keys()].sort((a, b) => {
    const na = epicByTri.get(a)?.nom ?? a;
    const nb = epicByTri.get(b)?.nom ?? b;
    return na.localeCompare(nb, "fr", { sensitivity: "base" });
  });

  for (const tri of sortedTris) {
    const epic = epicByTri.get(tri);
    const epicProjects = [...byEpic.get(tri)!].sort((a, b) => a.id - b.id);
    if (epicProjects.length === 0) continue;

    out.push({ id: `epic:${tri}`, text: epic?.nom ?? tri, type: "summary", open: true });

    for (const p of epicProjects) {
      out.push({
        id: `proj:${p.id}`,
        text: p.nom,
        type: "summary",
        parent: `epic:${tri}`,
        start: toDate(p.date_debut),
        end: toDate(p.date_fin),
        open: false, // projets repliés par défaut (parité avec l'actuel)
      });
      for (const t of tasksByProject.get(p.id) ?? []) {
        if (teamFilterTaskIds && !teamFilterTaskIds.has(t.id)) continue;
        out.push({
          id: `task:${t.id}`,
          text: t.nom,
          type: "task",
          parent: `proj:${p.id}`,
          start: toDate(t.date_debut),
          end: toDate(t.date_fin),
          progress: t.statut === "archive" ? 100 : 0,
        });
      }
    }
  }

  return out;
}
