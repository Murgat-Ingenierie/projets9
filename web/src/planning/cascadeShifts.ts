// Cascade FS pour le planning SVAR : à partir d'une tâche déplacée et de l'état
// courant (arêtes FS + dates des tâches), calcule les décalages à appliquer aux
// tâches POSTÉRIEURES dépendantes. S'appuie sur computeCascade (Phase 1). Pur et
// testable ; les données viennent du store SVAR (source de vérité après drags).
// C9 Phase 2b.
import { computeCascade } from "./cascade";
import { shiftIso } from "./dates";

/** Arête FS amont → aval (dépendance « fin-début »). */
export interface FsEdge {
  amontId: number;
  avalId: number;
}

export interface TaskDates {
  date_debut: string;
  date_fin: string;
}

export interface CascadeShift {
  id: number;
  date_debut: string;
  date_fin: string;
}

export interface PlanCascadeInput {
  /** Tâche déplacée (exclue du résultat). */
  movedId: number;
  /** Son début ORIGINAL (avant déplacement), ISO "YYYY-MM-DD". */
  oldStartIso: string;
  /** Décalage à propager en jours : variation de la FIN de la tâche déplacée (contrainte FS). */
  deltaDays: number;
  /** Arêtes FS (amont → aval) de l'état courant. */
  edges: FsEdge[];
  /** id → dates courantes de chaque tâche du graphe. */
  taskDates: Map<number, TaskDates>;
}

// Renvoie les décalages { id, date_debut, date_fin } des tâches FS-postérieures à
// appliquer, chacune décalée de `deltaDays`. Vide si delta nul.
export function planCascadeShifts(input: PlanCascadeInput): CascadeShift[] {
  const { movedId, oldStartIso, deltaDays, edges, taskDates } = input;
  if (deltaDays === 0) return [];

  const dependentsByAmont = new Map<number, number[]>();
  for (const e of edges) {
    if (!dependentsByAmont.has(e.amontId)) dependentsByAmont.set(e.amontId, []);
    dependentsByAmont.get(e.amontId)!.push(e.avalId);
  }

  const toShift = computeCascade({ movedId, oldStartIso, dependentsByAmont, tasksById: taskDates });

  const shifts: CascadeShift[] = [];
  for (const id of toShift) {
    const t = taskDates.get(id);
    if (!t) continue;
    shifts.push({
      id,
      date_debut: shiftIso(t.date_debut, deltaDays),
      date_fin: shiftIso(t.date_fin, deltaDays),
    });
  }
  return shifts;
}

/** Changement de dates d'une entité (projet ou tâche) : avant/après, pour undo. */
export interface BlockDateChange {
  id: number;
  before: TaskDates;
  after: TaskDates;
}

export interface BlockShiftResult {
  projects: BlockDateChange[];
  tasks: BlockDateChange[];
}

// Décalage en BLOC d'un summary (projet ou epic). SVAR déplace nativement TOUT le
// sous-arbre d'un summary glissé (ses dates sont dérivées des enfants), en ré-émettant
// un update-task par descendant : on ignore ces ré-émissions et on recompose ici, en
// UNE fois, le décalage du même `deltaDays` appliqué au projet (ou à tous les projets
// de l'epic) ET à toutes leurs tâches — y compris celles masquées par un filtre équipe
// (le bloc entier suit). Renvoie avant/après pour persister ET empiler UN seul undo.
// Pas de cascade FS externe : un déplacement de bloc décale le bloc, rien au-delà. Pur.
export function planBlockShift(input: {
  kind: "proj" | "epic";
  /** id de projet (proj, comparé en chaîne) ou trigramme d'epic (epic). */
  ref: string;
  deltaDays: number;
  projects: { id: number; epic_trigramme: string; date_debut: string; date_fin: string }[];
  tasks: { id: number; projet_id: number; date_debut: string; date_fin: string }[];
}): BlockShiftResult {
  const { kind, ref, deltaDays, projects, tasks } = input;
  if (deltaDays === 0) return { projects: [], tasks: [] };

  const affectedProjects =
    kind === "proj"
      ? projects.filter((p) => String(p.id) === ref)
      : projects.filter((p) => p.epic_trigramme === ref);
  const projectIds = new Set(affectedProjects.map((p) => p.id));
  const affectedTasks = tasks.filter((t) => projectIds.has(t.projet_id));

  const shift = (before: TaskDates): BlockDateChange["after"] => ({
    date_debut: shiftIso(before.date_debut, deltaDays),
    date_fin: shiftIso(before.date_fin, deltaDays),
  });

  return {
    projects: affectedProjects.map((p) => {
      const before = { date_debut: p.date_debut, date_fin: p.date_fin };
      return { id: p.id, before, after: shift(before) };
    }),
    tasks: affectedTasks.map((t) => {
      const before = { date_debut: t.date_debut, date_fin: t.date_fin };
      return { id: t.id, before, after: shift(before) };
    }),
  };
}

// Décalage de GROUPE (multi-sélection) : décale chaque tâche sélectionnée (hors la
// tâche déplacée, déjà bougée par SVAR) du même delta. Exclusif de la cascade — le
// geste groupé remplace la propagation FS (parité avec l'ancien Gantt). Pur.
export function planGroupShifts(input: {
  /** Tâche effectivement glissée (exclue du résultat). */
  movedId: number;
  /** Décalage du geste, en jours (delta du DÉBUT de la tâche déplacée). */
  deltaDays: number;
  /** Ids des tâches sélectionnées (inclut movedId). */
  selectedIds: number[];
  /** id → dates courantes de chaque tâche sélectionnée. */
  taskDates: Map<number, TaskDates>;
}): CascadeShift[] {
  const { movedId, deltaDays, selectedIds, taskDates } = input;
  if (deltaDays === 0) return [];
  const shifts: CascadeShift[] = [];
  for (const id of selectedIds) {
    if (id === movedId) continue;
    const t = taskDates.get(id);
    if (!t) continue;
    shifts.push({
      id,
      date_debut: shiftIso(t.date_debut, deltaDays),
      date_fin: shiftIso(t.date_fin, deltaDays),
    });
  }
  return shifts;
}
