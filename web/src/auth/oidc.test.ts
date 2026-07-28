import { describe, expect, it } from "vitest";
import { CHEMIN_CALLBACK, estActif, gestionnaire, jetonAcces, utilisateurCourant } from "./oidc";

// Propriété de sûreté : sans configuration, l'adossement OIDC doit rester
// COMPLÈTEMENT inerte. C'est ce qui permet de livrer le code sans rien basculer,
// et de faire la bascule par simple configuration.
//
// L'environnement de test ne définit aucun `VITE_OIDC_*` : on y est donc dans
// l'état « non configuré », exactement comme une installation qui n'a pas encore
// migré.

describe("adossement OIDC — inactif tant qu'il n'est pas configuré", () => {
  it("estActif() est faux sans VITE_OIDC_AUTHORITY/CLIENT_ID", () => {
    expect(estActif()).toBe(false);
  });

  it("aucun utilisateur courant, donc aucun jeton attaché aux requêtes", async () => {
    await expect(utilisateurCourant()).resolves.toBeNull();
    await expect(jetonAcces()).resolves.toBeNull();
  });

  it("construire le gestionnaire échoue explicitement plutôt qu'en silence", () => {
    // Mieux vaut une erreur claire qu'un UserManager à moitié configuré qui
    // enverrait l'utilisateur sur une URL vide.
    expect(() => gestionnaire()).toThrow(/non configuré/i);
  });

  it("le chemin de callback est stable — il est déclaré dans Keycloak", () => {
    // Le changer casserait les « Valid redirect URIs » côté realm : ce test
    // existe pour qu'on s'en souvienne avant de le renommer.
    expect(CHEMIN_CALLBACK).toBe("/auth/callback");
  });
});
