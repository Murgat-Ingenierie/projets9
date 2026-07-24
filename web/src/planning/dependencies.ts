// Dérivations pures du graphe de dépendances. Extrait de GanttPage.tsx (C9, Phase 1).
import type { Dependency } from "../types";

export interface DependencyMaps {
  /** aval_task_id → [amont_task_ids] (pilote `task.dependencies` côté Gantt). */
  depsByAval: Map<number, number[]>;
  /** amont_task_id → [aval_task_ids] (pour cascader un décalage vers l'aval). */
  dependentsByAmont: Map<number, number[]>;
}

// Seules les dépendances FS pilotent la cascade et le tracé des flèches.
export function buildDependencyMaps(deps: Dependency[]): DependencyMaps {
  const depsByAval = new Map<number, number[]>();
  const dependentsByAmont = new Map<number, number[]>();
  for (const d of deps) {
    if (d.type !== "FS") continue;
    if (!depsByAval.has(d.tache_aval_id)) depsByAval.set(d.tache_aval_id, []);
    depsByAval.get(d.tache_aval_id)!.push(d.tache_amont_id);
    if (!dependentsByAmont.has(d.tache_amont_id)) dependentsByAmont.set(d.tache_amont_id, []);
    dependentsByAmont.get(d.tache_amont_id)!.push(d.tache_aval_id);
  }
  return { depsByAval, dependentsByAmont };
}

// Retrouve l'id d'une dépendance par sa paire (amont, aval) — pour la
// suppression au clic sur une flèche. `null` si aucune FS ne correspond.
export function findDependencyId(deps: Dependency[], amontId: number, avalId: number): number | null {
  const d = deps.find(
    (x) => x.tache_amont_id === amontId && x.tache_aval_id === avalId && x.type === "FS",
  );
  return d?.id ?? null;
}
