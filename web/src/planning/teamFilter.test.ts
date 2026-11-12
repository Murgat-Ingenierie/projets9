import { describe, it, expect } from "vitest";
import { deriveTeamFilter, responsableParDefaut, restreindreParResponsable } from "./teamFilter";
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

describe("restreindreParResponsable", () => {
  const tasks = [
    { id: 11, projet_id: 1, responsable_id: 7 },
    { id: 12, projet_id: 1, responsable_id: 8 },
    { id: 13, projet_id: 2, responsable_id: null },
  ];
  const sansFiltre = { taskIds: null, projectIds: null };

  it("pas de garde → filtre inchangé (pas de Set vide qui masquerait tout)", () => {
    expect(restreindreParResponsable(sansFiltre, tasks, undefined)).toBe(sansFiltre);
  });

  it("garde seule → tâches du responsable + projets qui les portent", () => {
    const f = restreindreParResponsable(sansFiltre, tasks, (t) => t.responsable_id === 7);
    expect([...f.taskIds!]).toEqual([11]);
    expect([...f.projectIds!]).toEqual([1]);
  });

  it("combinée au filtre équipe → INTERSECTION", () => {
    const equipe = { taskIds: new Set([12, 13]), projectIds: new Set([1, 2]) };
    const f = restreindreParResponsable(equipe, tasks, (t) => t.responsable_id === 7);
    expect(f.taskIds!.size).toBe(0);
    expect(f.projectIds!.size).toBe(0);
  });

  it("aucune tâche du responsable → planning vide, pas un retour à « tous »", () => {
    const f = restreindreParResponsable(sansFiltre, tasks, (t) => t.responsable_id === 99);
    expect(f.taskIds).toEqual(new Set());
  });
});

// Défaut du filtre « Responsable » à l'ouverture du planning (#155).
describe("responsableParDefaut", () => {
  const taches = [{ responsable_id: 7 }, { responsable_id: null }];

  it("l'utilisateur porte des tâches → pré-filtré sur lui", () => {
    expect(responsableParDefaut(7, taches)).toBe("7");
  });

  it("l'utilisateur ne porte rien → « Tous », pas un planning vide", () => {
    expect(responsableParDefaut(8, taches)).toBe("");
  });

  it("utilisateur inconnu → « Tous »", () => {
    expect(responsableParDefaut(undefined, taches)).toBe("");
  });
});
