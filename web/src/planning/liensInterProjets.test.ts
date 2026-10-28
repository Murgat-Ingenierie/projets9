import { describe, it, expect } from "vitest";
import { idsInterProjets, liensCoucheInterProjets, styleLiensInterProjets } from "./liensInterProjets";
import type { Dependency } from "../types";

const dep = (id: number, amont: number, aval: number, type: Dependency["type"] = "FS"): Dependency => ({
  id, tache_amont_id: amont, tache_aval_id: aval, type,
});
const depProjet = (id: number, projet: number, aval: number): Dependency => ({
  id, tache_amont_id: null, projet_amont_id: projet, tache_aval_id: aval, type: "FS",
});

// Tâches 11, 12 dans le projet 1 ; 21, 22 dans le projet 2 ; 31 dans le projet 3.
const projetParTacheId = new Map([[11, 1], [12, 1], [21, 2], [22, 2], [31, 3]]);

describe("idsInterProjets", () => {
  it("ne retient que les liens dont les deux bouts sont dans des projets différents", () => {
    expect(idsInterProjets([dep(1, 11, 12), dep(2, 12, 21), dep(3, 21, 22)], projetParTacheId)).toEqual([2]);
  });

  it("une fin de projet (#141) compte pour son propre projet", () => {
    expect(idsInterProjets([depProjet(4, 1, 21), depProjet(5, 1, 11)], projetParTacheId)).toEqual([4]);
  });

  it("ignore un lien dont une tâche est inconnue — on ne classe pas à l'aveugle", () => {
    expect(idsInterProjets([dep(6, 99, 21)], projetParTacheId)).toEqual([]);
  });
});

describe("liensCoucheInterProjets", () => {
  it("reporte le lien sur les barres de projet, quelle que soit la visibilité des tâches", () => {
    expect(liensCoucheInterProjets([dep(2, 12, 21)], projetParTacheId, null)).toEqual([
      { id: "xp:1-2-FS", source: "proj:1", target: "proj:2", type: "e2s" },
    ]);
  });

  it("agrège les dépendances d'une même paire de projets et d'un même type", () => {
    const liens = liensCoucheInterProjets(
      [dep(1, 11, 21), dep(2, 12, 22), depProjet(3, 1, 22), dep(4, 11, 21, "SS")],
      projetParTacheId,
      null,
    );
    // Le SS n'est PAS fondu dans le FS : ce serait affirmer une autre contrainte.
    expect(liens.map((l) => l.id)).toEqual(["xp:1-2-FS", "xp:1-2-SS"]);
    expect(liens[1].type).toBe("s2s");
  });

  it("ignore les dépendances internes à un projet", () => {
    expect(liensCoucheInterProjets([dep(1, 11, 12), depProjet(2, 1, 11)], projetParTacheId, null)).toEqual([]);
  });

  it("sous filtre, ne trace rien vers une ligne de projet absente", () => {
    const deps = [dep(1, 11, 21), dep(2, 21, 31)];
    expect(liensCoucheInterProjets(deps, projetParTacheId, new Set([1, 2])).map((l) => l.id)).toEqual(["xp:1-2-FS"]);
  });
});

describe("styleLiensInterProjets", () => {
  it("cible les data-link-id tels que SVAR les pose (nombre brut, chaîne préfixée de « : »)", () => {
    const css = styleLiensInterProjets([2, "xp:1-2-FS"]);
    expect(css).toContain('[data-link-id="2"] .wx-line-draw');
    expect(css).toContain('[data-link-id=":xp:1-2-FS"] .wx-line-draw');
    expect(css).toContain("stroke-dasharray");
  });

  it("rien à styler → null (pas de <style> vide)", () => {
    expect(styleLiensInterProjets([])).toBeNull();
  });

  it("écarte tout id de forme inattendue du sélecteur", () => {
    expect(styleLiensInterProjets(['"]{}body{display:none'])).toBeNull();
  });
});
