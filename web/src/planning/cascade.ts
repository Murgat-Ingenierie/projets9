// Cascade FS : quand une tâche est déplacée, ses dépendantes POSTÉRIEURES sont
// décalées du même delta, de proche en proche. Logique pure (ni DOM, ni API).
// Extrait de GanttPage.tsx (C9, Phase 1).
import { toDate } from "./dates";

export interface CascadeInput {
  /** Id de la tâche déplacée (exclue du résultat). */
  movedId: number;
  /** Sa date_debut ORIGINALE (avant déplacement), ISO "YYYY-MM-DD". */
  oldStartIso: string;
  /** amont → [aval] (cf. buildDependencyMaps). */
  dependentsByAmont: Map<number, number[]>;
  /** id → tâche (on n'y lit que date_debut). */
  tasksById: Map<number, { date_debut: string }>;
}

// Renvoie l'ensemble des ids de tâches à décaler. BFS amont→aval, chaque tâche
// visitée une seule fois (robuste aux cycles) ; on ne retient que les tâches
// dont le début est ≥ au début original de la tâche déplacée (« postérieures »).
export function computeCascade(input: CascadeInput): Set<number> {
  const { movedId, oldStartIso, dependentsByAmont, tasksById } = input;
  const oldStartMs = toDate(oldStartIso).getTime();
  const toShift = new Set<number>();
  const queue: number[] = [movedId];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const dep of dependentsByAmont.get(cur) ?? []) {
      if (toShift.has(dep) || dep === movedId) continue;
      const t = tasksById.get(dep);
      if (!t) continue;
      if (toDate(t.date_debut).getTime() >= oldStartMs) {
        toShift.add(dep);
        queue.push(dep);
      }
    }
  }
  return toShift;
}
