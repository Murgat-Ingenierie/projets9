import { describe, it, expect } from "vitest";
import { calculerHorsFenetre, infobulleHorsFenetre } from "./horsFenetre";

// Fenêtre du projet : 10 → 20 janvier (10 jours).
const P = ["2026-01-10", "2026-01-20"] as const;

describe("calculerHorsFenetre", () => {
  it("tâche contenue dans la fenêtre ⇒ rien à signaler", () => {
    expect(calculerHorsFenetre("2026-01-12", "2026-01-18", ...P)).toBeNull();
  });

  it("tâche exactement aux bornes ⇒ rien non plus", () => {
    expect(calculerHorsFenetre("2026-01-10", "2026-01-20", ...P)).toBeNull();
  });

  it("commence trop tôt : la portion antérieure est hachurée", () => {
    // 5 → 15 janvier : 5 jours avant sur 10 de durée.
    const h = calculerHorsFenetre("2026-01-05", "2026-01-15", ...P)!;
    expect(h.avant).toBeCloseTo(0.5);
    expect(h.apres).toBe(0);
    expect(h.jours).toBe(5);
  });

  it("finit trop tard : la portion postérieure est hachurée", () => {
    // 15 → 25 janvier : 5 jours après sur 10 de durée.
    const h = calculerHorsFenetre("2026-01-15", "2026-01-25", ...P)!;
    expect(h.avant).toBe(0);
    expect(h.apres).toBeCloseTo(0.5);
    expect(h.jours).toBe(5);
  });

  it("déborde des deux côtés : deux portions, et le milieu reste net", () => {
    // 5 → 25 janvier : 5 jours avant, 5 après, sur 20 de durée.
    const h = calculerHorsFenetre("2026-01-05", "2026-01-25", ...P)!;
    expect(h.avant).toBeCloseTo(0.25);
    expect(h.apres).toBeCloseTo(0.25);
    expect(h.jours).toBe(10);
  });

  // Sans le rognage mutuel, les deux portions couvriraient plus que la barre et
  // se chevaucheraient — la hachure paraîtrait plus dense au milieu.
  it("tâche ENTIÈREMENT hors fenêtre : les deux portions tiennent dans la barre", () => {
    const h = calculerHorsFenetre("2026-01-01", "2026-01-05", ...P)!;
    expect(h.avant + h.apres).toBeLessThanOrEqual(1);
  });

  it("tâche d'un seul jour hors fenêtre : toute la barre, sans division par zéro", () => {
    const h = calculerHorsFenetre("2026-01-25", "2026-01-25", ...P)!;
    expect(h.avant + h.apres).toBe(1);
    expect(Number.isFinite(h.apres)).toBe(true);
  });

  // Un projet sans dates ne définit aucune fenêtre : rien à comparer, donc rien
  // à signaler — plutôt qu'une hachure appuyée sur une borne inexistante.
  it.each([
    [null, "2026-01-20"],
    ["2026-01-10", null],
    [null, null],
  ])("projet sans fenêtre (%s, %s) ⇒ null", (debut, fin) => {
    expect(calculerHorsFenetre("2026-01-01", "2026-01-05", debut, fin)).toBeNull();
  });
});

describe("infobulleHorsFenetre", () => {
  it("dit de quel côté, de combien, et par rapport à quoi", () => {
    const h = calculerHorsFenetre("2026-01-05", "2026-01-25", ...P)!;
    expect(infobulleHorsFenetre(h, "Capteurs O2")).toBe(
      "Sort de la fenêtre du projet « Capteurs O2 » (2026-01-10 → 2026-01-20) : " +
        "commence avant et finit après, 10 jours au total.",
    );
  });

  it("un seul côté ⇒ un seul membre de phrase", () => {
    const h = calculerHorsFenetre("2026-01-15", "2026-01-25", ...P)!;
    expect(infobulleHorsFenetre(h, "P")).toContain("finit après, 5 jours");
    expect(infobulleHorsFenetre(h, "P")).not.toContain("commence avant");
  });

  it("accorde le singulier", () => {
    const h = calculerHorsFenetre("2026-01-15", "2026-01-21", ...P)!;
    expect(infobulleHorsFenetre(h, "P")).toContain("1 jour au total");
  });
});
