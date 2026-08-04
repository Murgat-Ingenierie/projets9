import { describe, it, expect } from "vitest";
import { infobulleLiensMasques, liensMasquesParTache } from "./liensMasques";
import type { Dependency } from "../types";

const dep = (id: number, amont: number, aval: number, type = "FS"): Dependency =>
  ({ id, tache_amont_id: amont, tache_aval_id: aval, type }) as Dependency;

const NOMS = new Map([
  [11, "Choix capteurs"],
  [12, "Pose et calibration"],
  [13, "Etude debit"],
]);

describe("liensMasquesParTache", () => {
  // Sans filtre, toutes les flèches sont dessinées : signaler quoi que ce soit
  // ferait douter d'un lien pourtant visible à l'écran.
  it("pas de filtre ⇒ rien de masqué", () => {
    expect(liensMasquesParTache([dep(1, 11, 12)], NOMS, null).size).toBe(0);
  });

  it("les deux extrémités visibles ⇒ rien à signaler (la flèche est là)", () => {
    const m = liensMasquesParTache([dep(1, 11, 12)], NOMS, new Set([11, 12]));
    expect(m.size).toBe(0);
  });

  it("les deux extrémités masquées ⇒ rien (le lien ne touche aucune ligne affichée)", () => {
    const m = liensMasquesParTache([dep(1, 11, 12)], NOMS, new Set([13]));
    expect(m.size).toBe(0);
  });

  it("l'amont est hors filtre ⇒ l'aval visible porte la marque, en sens « amont »", () => {
    const m = liensMasquesParTache([dep(1, 11, 12, "SS")], NOMS, new Set([12]));
    expect(m.get(12)).toEqual([{ sens: "amont", nomAutre: "Choix capteurs", type: "SS" }]);
    expect(m.has(11)).toBe(false); // la tâche masquée n'a pas de ligne
  });

  it("l'aval est hors filtre ⇒ l'amont visible porte la marque, en sens « aval »", () => {
    const m = liensMasquesParTache([dep(1, 11, 12)], NOMS, new Set([11]));
    expect(m.get(11)).toEqual([{ sens: "aval", nomAutre: "Pose et calibration", type: "FS" }]);
  });

  it("une tâche cumule ses liens masqués", () => {
    const m = liensMasquesParTache(
      [dep(1, 11, 12), dep(2, 12, 13, "FF")],
      NOMS,
      new Set([12]),
    );
    expect(m.get(12)).toHaveLength(2);
  });

  // Une dépendance peut viser une tâche absente de la table des noms (données
  // partielles). Mieux vaut un repère brut qu'une infobulle trouée.
  it("une tâche sans nom connu reste désignable", () => {
    const m = liensMasquesParTache([dep(1, 99, 12)], NOMS, new Set([12]));
    expect(m.get(12)![0].nomAutre).toBe("tâche 99");
  });
});

describe("infobulleLiensMasques", () => {
  it("nomme chaque lien : le compte seul n'aiderait pas", () => {
    expect(
      infobulleLiensMasques([
        { sens: "amont", nomAutre: "Choix capteurs", type: "FS" },
        { sens: "aval", nomAutre: "Etude debit", type: "SS" },
      ]),
    ).toBe(
      "2 dépendances masquées par le filtre équipe :\n" +
        "• Dépend de « Choix capteurs » (FS)\n" +
        "• Précède « Etude debit » (SS)",
    );
  });

  it("accorde le singulier", () => {
    expect(infobulleLiensMasques([{ sens: "amont", nomAutre: "X", type: "FS" }]))
      .toContain("1 dépendance masquée");
  });
});
