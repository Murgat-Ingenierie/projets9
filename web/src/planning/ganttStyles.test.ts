import { describe, it, expect } from "vitest";
import { TEXTE_SUR_FOND_CLAIR, adjustBrightness, couleurTexteSur, luminanceRelative, stylesFor } from "./ganttStyles";

describe("adjustBrightness", () => {
  it("assombrit (factor < 1)", () => {
    expect(adjustBrightness("#808080", 0.5)).toBe("#404040"); // 128 * 0.5 = 64 = 0x40
  });
  it("éclaircit (factor > 1)", () => {
    expect(adjustBrightness("#000000", 2)).toBe("#808080"); // 0 + 255*(1-1/2) = 128 = 0x80
  });
  it("laisse inchangé ce qui n'est pas un hex #RRGGBB", () => {
    expect(adjustBrightness("rgb(0,0,0)", 2)).toBe("rgb(0,0,0)");
    expect(adjustBrightness("#abc", 2)).toBe("#abc");
  });
});

describe("stylesFor", () => {
  it("couleur de base + variante assombrie pour la sélection", () => {
    const s = stylesFor("#808080");
    expect(s.backgroundColor).toBe("#808080");
    expect(s.progressColor).toBe("#808080");
    expect(s.backgroundSelectedColor).toBe(adjustBrightness("#808080", 0.8));
    expect(s.progressSelectedColor).toBe(s.backgroundSelectedColor);
  });
});

// --- Lisibilité des libellés portés par les barres --------------------------
//
// Le défaut signalé par les utilisateurs : « le texte blanc n'est pas lisible
// sans sélection ». La sélection assombrit la barre — le texte n'apparaissait
// donc qu'une fois cliqué. Cause : un libellé blanc fixe sur un fond variable,
// éclairci pour les tâches (facteur 1.6 sur la couleur de l'epic).

describe("couleurTexteSur — contraste du libellé", () => {
  it("texte clair sur fond sombre", () => {
    expect(couleurTexteSur("#000000")).toBe("#ffffff");
    expect(couleurTexteSur("#3f51b5")).toBe("#ffffff"); // couleur d'epic par défaut
  });

  it("texte sombre sur fond clair", () => {
    expect(couleurTexteSur("#ffffff")).toBe(TEXTE_SUR_FOND_CLAIR);
    expect(couleurTexteSur("#ffe0b2")).toBe(TEXTE_SUR_FOND_CLAIR); // orange pâle
  });

  it("le cas RÉEL du signalement : une tâche sur un epic déjà pâle", () => {
    // C'est exactement ce que produit buildSvarTasks pour une tâche.
    const fond = adjustBrightness("#f57c00", 1.6); // orange d'epic, éclairci
    expect(couleurTexteSur(fond)).toBe(TEXTE_SUR_FOND_CLAIR);
  });

  it("le seuil naïf « luminance > 0,5 » aurait laissé le défaut en place", () => {
    // Garde-fou contre un retour en arrière plausible : l'orange éclairci du
    // signalement a une luminance de 0,51, donc « plutôt clair » de justesse. Un
    // seuil à 0,5 le classerait bien, mais un seuil à 0,55 — tout aussi
    // défendable à l'œil — lui redonnerait du blanc. Le rapport de contraste, lui,
    // tranche sans ambiguïté : 8,0 contre 1,9.
    const fond = adjustBrightness("#f57c00", 1.6);
    expect(luminanceRelative(fond)).toBeGreaterThan(0.5);
    expect(luminanceRelative(fond)).toBeLessThan(0.55);
    expect(couleurTexteSur(fond)).toBe(TEXTE_SUR_FOND_CLAIR);
  });

  it("le vert perçu plus clair que le bleu à luminance égale en RGB", () => {
    // La luminance relative PONDÈRE les canaux (0,2126 / 0,7152 / 0,0722) : sans
    // cela, #00ff00 et #0000ff se vaudraient et le vert vif garderait du blanc.
    expect(couleurTexteSur("#00ff00")).toBe(TEXTE_SUR_FOND_CLAIR);
    expect(couleurTexteSur("#0000ff")).toBe("#ffffff");
  });

  it("couleur non hexadécimale : on suppose un fond sombre", () => {
    // Défaut historique. Mieux vaut le blanc, qui était le comportement d'avant,
    // que du sombre sur une barre potentiellement foncée.
    expect(couleurTexteSur("rgb(1,2,3)")).toBe("#ffffff");
    expect(luminanceRelative("pas-une-couleur")).toBe(0);
  });

  it("luminance bornée et ordonnée", () => {
    expect(luminanceRelative("#000000")).toBe(0);
    expect(luminanceRelative("#ffffff")).toBeCloseTo(1, 5);
    expect(luminanceRelative("#808080")).toBeGreaterThan(luminanceRelative("#404040"));
  });
});
