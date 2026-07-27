// Dérivation du filtre équipe pour le planning : à partir des équipes sélectionnées
// et des allocations tâche↔équipe, produit les ensembles de tâches et de projets
// « en scope ». Pur et testable ; partagé par les deux Gantt. C9 Phase 2b.
import type { TacheEquipe, Task } from "../types";

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
