import { describe, it, expect } from "vitest";
import { deriveTeamFilter } from "./teamFilter";
import type { TacheEquipe, Task } from "../types";

const alloc = (tache_id: number, equipe_id: number): Pick<TacheEquipe, "tache_id" | "equipe_id"> => ({ tache_id, equipe_id });
const task = (id: number, projet_id: number): Pick<Task, "id" | "projet_id"> => ({ id, projet_id });

describe("deriveTeamFilter", () => {
  const allocations = [alloc(11, 1), alloc(12, 1), alloc(13, 2)];
  const tasks = [task(11, 1), task(12, 1), task(13, 2)];

  it("aucune équipe sélectionnée → { null, null } (pas de filtre)", () => {
    expect(deriveTeamFilter({ allocations, tasks, selectedTeamIds: new Set() })).toEqual({ taskIds: null, projectIds: null });
  });

  it("une équipe → tâches allouées + projets qui les portent", () => {
    const f = deriveTeamFilter({ allocations, tasks, selectedTeamIds: new Set([1]) });
    expect([...f.taskIds!].sort()).toEqual([11, 12]);
    expect([...f.projectIds!]).toEqual([1]);
  });

  it("plusieurs équipes → UNION (pas intersection)", () => {
    const f = deriveTeamFilter({ allocations, tasks, selectedTeamIds: new Set([1, 2]) });
    expect([...f.taskIds!].sort()).toEqual([11, 12, 13]);
    expect([...f.projectIds!].sort()).toEqual([1, 2]);
  });

  it("une tâche sans allocation reste hors scope", () => {
    const f = deriveTeamFilter({
      allocations: [alloc(11, 1)],
      tasks: [task(11, 1), task(99, 1)],
      selectedTeamIds: new Set([1]),
    });
    expect(f.taskIds!.has(99)).toBe(false);
    expect([...f.projectIds!]).toEqual([1]); // projet 1 en scope via tâche 11
  });
});
