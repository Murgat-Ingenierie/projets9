import type { ITask } from "@svar-ui/react-gantt";
import type { Epic, Milestone, Project, Task } from "../types";
import { toDate } from "./dates";
import { DEFAULT_EPIC_COLOR, adjustBrightness } from "./ganttStyles";

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
  /** true (défaut) = lignes d'en-tête epic (projets sous l'epic) ; false = projets
   *  à plat au niveau racine (pas de ligne epic), triés par nom d'epic puis id. */
  groupByEpic?: boolean;
  /** État déplié par id de ligne ("epic:<tri>", "proj:<id>") ; surcharge le défaut
   *  (epic ouvert, projet replié) pour survivre aux reconstructions de l'arbre. */
  openState?: Map<string, boolean>;
}

export function buildSvarTasks(input: BuildSvarTasksInput): ITask[] {
  const { epics, projects, tasksByProject, milestones, teamFilterProjectIds, teamFilterTaskIds, groupByEpic = true, openState } = input;
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
    const epicColor = epic?.couleur ?? DEFAULT_EPIC_COLOR;
    const epicProjects = [...byEpic.get(tri)!].sort((a, b) => a.id - b.id);
    if (epicProjects.length === 0) continue;

    // Ligne d'en-tête epic seulement en mode groupé ; sinon projets à la racine.
    // barColor / archived : champs custom lus par le taskTemplate pour la déco.
    if (groupByEpic) {
      out.push({
        id: `epic:${tri}`,
        text: epic?.nom ?? tri,
        type: "summary",
        open: openState?.get(`epic:${tri}`) ?? true,
        barColor: epicColor,
      });
    }

    for (const p of epicProjects) {
      const pTasks = (tasksByProject.get(p.id) ?? []).filter(
        (t) => !teamFilterTaskIds || teamFilterTaskIds.has(t.id),
      );
      out.push({
        id: `proj:${p.id}`,
        text: p.nom,
        // Summary seulement s'il a des sous-tâches ; sinon feuille (SVAR refuse
        // un summary sans sous-tâches). Le projet garde ses dates propres.
        type: pTasks.length > 0 ? "summary" : "task",
        parent: groupByEpic ? `epic:${tri}` : undefined,
        start: toDate(p.date_debut),
        end: toDate(p.date_fin),
        open: openState?.get(`proj:${p.id}`) ?? false, // repliés par défaut
        barColor: epicColor, // projet = couleur de l'epic
      });
      for (const t of pTasks) {
        const archived = t.statut === "archive";
        out.push({
          id: `task:${t.id}`,
          text: t.nom,
          type: "task",
          parent: `proj:${p.id}`,
          start: toDate(t.date_debut),
          end: toDate(t.date_fin),
          barColor: adjustBrightness(epicColor, 1.6), // tâche = couleur epic éclaircie
          archived, // tâche terminée → hachure + coche « fait » dans le template
        });
      }
    }
  }

  return out;
}
