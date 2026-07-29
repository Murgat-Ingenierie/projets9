import { describe, expect, it } from "vitest";
import { CHEMIN_CALLBACK, defautDeConfiguration, gestionnaire, jetonAcces } from "./oidc";

// Ces tests éprouvaient jusqu'ici la propriété inverse : « sans configuration,
// l'OIDC reste inerte ». C'était juste tant que l'API acceptait de tourner sans
// authentification — la bascule pouvait alors se faire par configuration, sans
// fenêtre d'indisponibilité.
//
// Ce mode a disparu avec le login maison. Sans configuration, l'application ne
// peut plus rien faire d'une API qui exige un jeton : ce qui doit être vérifié,
// c'est qu'elle le DIT, au lieu de se rendre inerte et de laisser l'utilisateur
// devant des erreurs qu'il ne peut pas relier à leur cause.
//
// L'environnement de test ne définit aucun `VITE_OIDC_*` : on y est donc dans
// l'état « mal configuré ».

describe("adossement OIDC — configuration obligatoire", () => {
  it("signale le défaut de configuration au lieu de se taire", () => {
    expect(defautDeConfiguration()).not.toBeNull();
  });

  it("nomme les variables manquantes", () => {
    // Un message qui dit seulement « mal configuré » oblige à ouvrir le code.
    const message = defautDeConfiguration() ?? "";
    expect(message).toContain("VITE_OIDC_AUTHORITY");
    expect(message).toContain("VITE_OIDC_CLIENT_ID");
  });

  it("rappelle qu'il faut RECONSTRUIRE l'image, pas seulement éditer .env", () => {
    // Le piège propre à Vite : ces valeurs sont inscrites dans le bundle au
    // build. Renseigner .env puis redémarrer le conteneur ne change rien, et
    // c'est le genre de détail sur lequel on perd une heure.
    expect(defautDeConfiguration() ?? "").toMatch(/build/i);
  });

  it("construire le gestionnaire échoue explicitement plutôt qu'en silence", () => {
    // Mieux vaut une erreur claire qu'un UserManager à moitié configuré qui
    // enverrait l'utilisateur sur une URL vide.
    expect(() => gestionnaire()).toThrow(/VITE_OIDC_AUTHORITY/);
  });

  it("aucun jeton n'est attaché aux requêtes tant que la configuration manque", async () => {
    // Surtout : pas de jeton fabriqué ni d'en-tête vide, qui donneraient un 401
    // au lieu du message ci-dessus.
    await expect(jetonAcces()).rejects.toThrow();
  });

  it("le chemin de callback est stable — il est déclaré dans Keycloak", () => {
    // Le changer casserait les « Valid redirect URIs » côté realm : ce test
    // existe pour qu'on s'en souvienne avant de le renommer.
    expect(CHEMIN_CALLBACK).toBe("/auth/callback");
  });
});
