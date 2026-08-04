import { describe, it, expect } from "vitest";
import { calculerDepassement, celluleCouvre, echeanceLaPlusProche } from "./echeances";
import type { Milestone } from "../types";

// « Mon projet ne peut pas finir APRÈS mon jalon. » Cette règle n'est pas un
// invariant — l'API ne l'impose pas, et les données réelles la violent. Le
// planning la SIGNALE. Ces tests portent sur ce qui est signalé, et sur ce qui
// ne doit pas l'être : une barre rouge à tort ferait perdre confiance à l'écran
// tout entier.

const jalon = (id: number, nom: string, date: string, project_ids: number[]): Milestone =>
  ({ id, nom, date, project_ids }) as unknown as Milestone;

describe("echeanceLaPlusProche", () => {
  it("retient la date la plus précoce : c'est elle qui contraint", () => {
    // La respecter satisfait les autres ; afficher les deux n'apprendrait rien.
    const ms = [jalon(1, "Tardif", "2027-01-01", [7]), jalon(2, "Serré", "2026-06-01", [7])];
    expect(echeanceLaPlusProche(7, ms)).toEqual({ date: "2026-06-01", nom: "Serré" });
  });

  it("ignore les jalons d'autres projets", () => {
    expect(echeanceLaPlusProche(7, [jalon(1, "Ailleurs", "2026-01-01", [8])])).toBeNull();
  });

  it("aucun jalon : pas d'échéance", () => {
    expect(echeanceLaPlusProche(7, [])).toBeNull();
  });
});

describe("calculerDepassement", () => {
  it("le cas réel : « Nouveau bassin de boue » dépasse de 18 mois", () => {
    // Relevé en base le 2026-08-03 — le dépassement le plus fort des quatre.
    const d = calculerDepassement("2026-05-01", "2028-12-31",
      { date: "2027-06-01", nom: "Prochain controle des rejets" });
    expect(d).not.toBeNull();
    expect(d!.jours).toBe(579);
    expect(d!.jalon).toBe("Prochain controle des rejets");
    expect(d!.ratio).toBeCloseTo(0.406, 3); // 396 j sur 975 : l’échéance tombe aux 40,6 % de la barre
  });

  it("projet finissant AVANT son échéance : rien à signaler", () => {
    expect(calculerDepassement("2026-01-01", "2026-05-01", { date: "2026-06-01", nom: "J" })).toBeNull();
  });

  it("fin exactement le jour du jalon : conforme, donc rien", () => {
    // Frontière : « ne peut pas finir APRÈS » — le jour même est admis.
    expect(calculerDepassement("2026-01-01", "2026-06-01", { date: "2026-06-01", nom: "J" })).toBeNull();
  });

  it("échéance antérieure au début : toute la barre est en retard", () => {
    const d = calculerDepassement("2026-03-01", "2026-06-01", { date: "2026-01-01", nom: "J" });
    expect(d!.ratio).toBe(0); // borné : pas de valeur négative qui sortirait de la barre
    expect(d!.jours).toBe(151);
  });

  it("projet d'un seul jour : pas de division par zéro", () => {
    const d = calculerDepassement("2026-06-01", "2026-06-01", { date: "2026-05-01", nom: "J" });
    expect(d!.ratio).toBe(0);
    expect(Number.isFinite(d!.jours)).toBe(true);
  });

  it("sans échéance, aucun dépassement possible", () => {
    expect(calculerDepassement("2026-01-01", "2026-12-01", null)).toBeNull();
  });
});

describe("celluleCouvre — repérage sur l'échelle de temps", () => {
  const d = (s: string) => new Date(`${s}T00:00:00`);

  it("vue Jour : la cellule du jour même", () => {
    expect(celluleCouvre(d("2026-09-20"), 1, new Set(["2026-09-20"]))).toBe(true);
    expect(celluleCouvre(d("2026-09-19"), 1, new Set(["2026-09-20"]))).toBe(false);
  });

  it("vue Semaine : la cellule de sept jours qui contient la date", () => {
    expect(celluleCouvre(d("2026-09-14"), 7, new Set(["2026-09-20"]))).toBe(true);
    expect(celluleCouvre(d("2026-09-21"), 7, new Set(["2026-09-20"]))).toBe(false);
  });

  it("vue Mois : le mois calendaire, pas trente jours", () => {
    // Le cas qui invalide un « +30 jours » : février en compte 28.
    expect(celluleCouvre(d("2026-02-01"), null, new Set(["2026-02-28"]))).toBe(true);
    expect(celluleCouvre(d("2026-02-01"), null, new Set(["2026-03-01"]))).toBe(false);
    expect(celluleCouvre(d("2026-09-01"), null, new Set(["2026-09-20"]))).toBe(true);
  });

  it("aucune date : jamais couvert, et on sort tôt", () => {
    expect(celluleCouvre(d("2026-09-20"), 1, new Set())).toBe(false);
  });
});
