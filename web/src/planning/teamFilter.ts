// Dérivation du filtre équipe pour le planning : à partir des équipes sélectionnées
// et des allocations tâche↔équipe, produit les ensembles de tâches et de projets
// « en scope ». Pur et testable ; partagé par les deux Gantt. C9 Phase 2b.
import type { TacheEquipe, Task } from "../types";
import type { ValeurResponsable } from "../components/FiltreResponsable";

export interface TeamFilter {
  /** null = pas de filtre (aucune équipe sélectionnée). */
  taskIds: Set<number> | null;
  /** null = pas de filtre. Sinon : projets ayant ≥1 tâche en scope. */
  projectIds: Set<number> | null;
}

// Sémantique d'UNION : une tâche allouée à AU MOINS UNE équipe cochée passe le
// filtre. `selectedTeamIds` vide → { null, null } (surtout PAS un Set vide, qui
// masquerait tout). Un projet est en scope s'il a au moins une tâche en scope.
export function deriveTeamFilter(input: {
  allocations: Pick<TacheEquipe, "tache_id" | "equipe_id">[];
  tasks: Pick<Task, "id" | "projet_id">[];
  selectedTeamIds: Set<number>;
}): TeamFilter {
  const { allocations, tasks, selectedTeamIds } = input;
  if (selectedTeamIds.size === 0) return { taskIds: null, projectIds: null };

  const taskIds = new Set<number>();
  for (const a of allocations) {
    if (selectedTeamIds.has(a.equipe_id)) taskIds.add(a.tache_id);
  }

  const projectIds = new Set<number>();
  for (const t of tasks) {
    if (taskIds.has(t.id)) projectIds.add(t.projet_id);
  }

  return { taskIds, projectIds };
}

// Restriction par responsable (#155), appliquée PAR-DESSUS le filtre équipe :
// INTERSECTION (« mes tâches dans telle équipe »), là où les équipes entre elles
// font une union. `garde` absent → filtre inchangé, surtout pas un Set vide.
// Comme pour les équipes, un projet n'est en scope que s'il garde une tâche en
// scope : un projet vide sous filtre ne ferait qu'encombrer le planning.
export function restreindreParResponsable(
  filtre: TeamFilter,
  tasks: Pick<Task, "id" | "projet_id" | "responsable_id">[],
  garde: ((t: Pick<Task, "responsable_id">) => boolean) | undefined,
): TeamFilter {
  if (!garde) return filtre;

  const taskIds = new Set<number>();
  const projectIds = new Set<number>();
  for (const t of tasks) {
    if (filtre.taskIds && !filtre.taskIds.has(t.id)) continue;
    if (!garde(t)) continue;
    taskIds.add(t.id);
    projectIds.add(t.projet_id);
  }

  return { taskIds, projectIds };
}

/** Valeur d'ouverture du planning (#155) : l'utilisateur connecté, s'il porte au
 *  moins une tâche ; sinon « Tous ».
 *
 *  Le repli compte : un admin ou un nouveau venu sans tâche ouvrirait sinon un
 *  planning VIDE, qui se lit comme une panne et non comme un filtre.
 */
export function responsableParDefaut(
  userId: number | undefined,
  taches: { responsable_id?: number | null }[],
): ValeurResponsable {
  if (userId === undefined) return "";
  return taches.some((t) => t.responsable_id === userId) ? `${userId}` : "";
}
