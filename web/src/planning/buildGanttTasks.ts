import type { Task as GanttTask } from "gantt-task-react";
import type { Epic, Milestone, Project, Task } from "../types";
import { toDate } from "./dates";
import { DEFAULT_EPIC_COLOR, adjustBrightness, stylesFor } from "./ganttStyles";

// Transforme l'état du planning en tableau de tâches que gantt-task-react affiche.
// Logique PURE (pas de DOM). Extrait de GanttPage.tsx (C9, Phase 1). C'est la
// couche d'adaptation vers la lib actuelle — la partie à réécrire pour SVAR
// (produire des ITask[]) ; la logique de sélection/hiérarchie/filtre, elle, porte.

const MILESTONE_COLOR = "#f57c00";

export interface BuildGanttTasksInput {
  epics: Epic[];
  projects: Project[];
  /** projet_id → tâches du projet (déjà ordonnées). */
  tasksByProject: Map<number, Task[]>;
  milestones: Milestone[];
  /** aval_task_id → [amont_task_ids] (FS), pour les flèches. */
  depsByAval: Map<number, number[]>;
  expandedProjects: Set<number>;
  editMode: boolean;
  groupByEpic: boolean;
  collapsedEpics: Set<string>;
  /** null = pas de filtre équipe. Sinon : ids de tâches/projets dans le scope. */
  teamFilterTaskIds: Set<number> | null;
  teamFilterProjectIds: Set<number> | null;
  /** Nombre de lignes réservées à la swimlane jalons (≥ 1). */
  milestoneRowCount: number;
}

export function buildGanttTasks(input: BuildGanttTasksInput): GanttTask[] {
  const {
    epics, projects, tasksByProject, milestones, depsByAval,
    expandedProjects, editMode, groupByEpic, collapsedEpics,
    teamFilterTaskIds, teamFilterProjectIds, milestoneRowCount,
  } = input;

  const out: GanttTask[] = [];
  const epicByTri = new Map(epics.map((e) => [e.trigramme, e]));

  // Swimlane jalons : une ligne d'ancre (jalon le plus tôt) + des espaceuses ;
  // les jalons sont repositionnés ensuite par update() côté GanttPage.
  const sortedMs = [...milestones].sort((a, b) => a.date.localeCompare(b.date));
  if (sortedMs.length > 0) {
    for (let r = 0; r < milestoneRowCount; r++) {
      out.push({
        id: r === 0 ? "milestone-anchor" : `milestone-spacer-${r}`,
        name: r === 0 ? "Jalons" : "",
        type: "milestone",
        start: toDate(sortedMs[0].date),
        end: toDate(sortedMs[0].date),
        progress: 0,
        isDisabled: true,
        styles: {
          backgroundColor: MILESTONE_COLOR,
          backgroundSelectedColor: MILESTONE_COLOR,
          progressColor: MILESTONE_COLOR,
          progressSelectedColor: MILESTONE_COLOR,
        },
      });
    }
  }

  const byEpic = new Map<string, Project[]>();
  for (const p of projects) {
    if (!byEpic.has(p.epic_trigramme)) byEpic.set(p.epic_trigramme, []);
    byEpic.get(p.epic_trigramme)!.push(p);
  }

  const sortedTris = Array.from(byEpic.keys()).sort((a, b) => {
    const na = epicByTri.get(a)?.nom ?? a;
    const nb = epicByTri.get(b)?.nom ?? b;
    return na.localeCompare(nb, "fr", { sensitivity: "base" });
  });

  for (const tri of sortedTris) {
    const epic = epicByTri.get(tri);
    const epicProjects = byEpic.get(tri)!;
    if (epicProjects.length === 0) continue;
    const color = epic?.couleur ?? DEFAULT_EPIC_COLOR;
    const taskColor = adjustBrightness(color, 1.6);

    // Ordre stable par id pour ne pas permuter quand on drag une barre.
    const sortedProjects = [...epicProjects].sort((a, b) => a.id - b.id);

    // Filtre équipes au niveau epic : si aucun projet dans le scope, epic sauté.
    const visibleProjects = teamFilterProjectIds
      ? sortedProjects.filter((p) => teamFilterProjectIds.has(p.id))
      : sortedProjects;
    if (visibleProjects.length === 0) continue;

    // Ligne d'en-tête epic (mode groupé) : bracket sur la plage de ses projets.
    if (groupByEpic) {
      const starts = visibleProjects.map((p) => p.date_debut).sort();
      const ends = visibleProjects.map((p) => p.date_fin).sort();
      out.push({
        id: `epic-${tri}`,
        name: epic?.nom ?? tri,
        type: "project",
        start: toDate(starts[0]),
        end: toDate(ends[ends.length - 1]),
        progress: 0,
        isDisabled: true,
        styles: {
          backgroundColor: color,
          backgroundSelectedColor: color,
          progressColor: color,
          progressSelectedColor: color,
        },
      });
      if (collapsedEpics.has(tri)) continue; // epic replié → projets masqués
    }

    for (const p of sortedProjects) {
      if (teamFilterProjectIds && !teamFilterProjectIds.has(p.id)) continue;
      out.push({
        id: `proj-${p.id}`,
        name: p.nom,
        type: "task",
        start: toDate(p.date_debut),
        end: toDate(p.date_fin),
        progress: 0,
        isDisabled: !editMode,
        styles: stylesFor(color),
      });
      if (expandedProjects.has(p.id)) {
        const pTasks = tasksByProject.get(p.id) ?? [];
        for (const t of pTasks) {
          if (teamFilterTaskIds && !teamFilterTaskIds.has(t.id)) continue;
          const dependsOn = depsByAval.get(t.id) ?? [];
          out.push({
            id: `task-${t.id}`,
            name: t.nom,
            type: "task",
            start: toDate(t.date_debut),
            end: toDate(t.date_fin),
            progress: 0,
            isDisabled: !editMode,
            styles: stylesFor(taskColor),
            dependencies: dependsOn.map((amontId) => `task-${amontId}`),
          });
        }
      }
    }
  }
  return out;
}
