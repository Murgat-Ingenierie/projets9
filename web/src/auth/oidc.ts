// Adossement du front à Keycloak (OIDC), pendant de `api/app/auth/oidc.py`.
//
// **Obligatoire**, comme côté API depuis le retrait de l'authentification
// maison. Il n'y a plus de mode « configuration vide = pas de login » : ce mode
// n'existait que pour accompagner la bascule, et un front qui n'obtient aucun
// jeton ne peut de toute façon plus rien faire d'une API qui les exige.
//
// Configuration manquante = **erreur affichée** (cf. auth.tsx), jamais un
// contournement silencieux. Nuance qui compte en production : ces valeurs sont
// inscrites dans le bundle AU BUILD, donc une variable oubliée ne se rattrape
// pas en redémarrant le conteneur — il faut reconstruire l'image. Autant que le
// message le dise.
//
// Flow : authorization code + PKCE (S256). C'est le seul flow acceptable pour un
// SPA — il ne peut garder aucun secret, d'où un client public côté Keycloak.

import { UserManager, WebStorageStateStore, type User as OidcUser } from "oidc-client-ts";

const AUTHORITY = import.meta.env.VITE_OIDC_AUTHORITY ?? "";
const CLIENT_ID = import.meta.env.VITE_OIDC_CLIENT_ID ?? "";
/** Client qui porte les rôles applicatifs ; demandé en `audience` pour que
 *  l'API retrouve `aud` dans le jeton (elle le vérifie, cf. oidc.py). */
const API_CLIENT_ID = import.meta.env.VITE_OIDC_API_CLIENT_ID ?? "projets9-api";

/** Chemin de retour après authentification. Doit figurer dans les
 *  « Valid redirect URIs » du client Keycloak. */
export const CHEMIN_CALLBACK = "/auth/callback";

/** Message d'une configuration incomplète, ou null si tout est là. */
export function defautDeConfiguration(): string | null {
  const manquants = [
    !AUTHORITY && "VITE_OIDC_AUTHORITY",
    !CLIENT_ID && "VITE_OIDC_CLIENT_ID",
  ].filter(Boolean);
  if (manquants.length === 0) return null;
  return (
    `Configuration d'authentification incomplète : ${manquants.join(", ")}. ` +
    `Ces valeurs sont inscrites dans le bundle au moment du build : les renseigner ` +
    `dans .env puis reconstruire l'image web (docker compose up -d --build web).`
  );
}

let manager: UserManager | null = null;

export function gestionnaire(): UserManager {
  const defaut = defautDeConfiguration();
  if (defaut !== null) {
    throw new Error(defaut);
  }
  if (manager === null) {
    manager = new UserManager({
      authority: AUTHORITY,
      client_id: CLIENT_ID,
      redirect_uri: `${window.location.origin}${CHEMIN_CALLBACK}`,
      post_logout_redirect_uri: window.location.origin,
      response_type: "code",
      scope: "openid profile email",
      // `resource` demande que le jeton porte l'audience de l'API. Le mapper
      // d'audience côté Keycloak fait le même travail ; on met les deux, l'un
      // rattrape l'autre selon la configuration du realm.
      resource: API_CLIENT_ID,
      // Le jeton survit à un rechargement de page (sinon on repart en
      // redirection à chaque F5).
      userStore: new WebStorageStateStore({ store: window.localStorage }),
      // Renouvellement silencieux via iframe : évite de renvoyer l'utilisateur
      // sur Keycloak toutes les cinq minutes.
      automaticSilentRenew: true,
      // Nettoie l'URL des paramètres `code`/`state` après le retour.
      loadUserInfo: false,
    });
  }
  return manager;
}

export async function utilisateurCourant(): Promise<OidcUser | null> {
  return gestionnaire().getUser();
}

/** Jeton d'accès courant, ou null. Lu par le client HTTP à chaque requête. */
export async function jetonAcces(): Promise<string | null> {
  const u = await utilisateurCourant();
  if (!u || u.expired) return null;
  return u.access_token ?? null;
}

export async function seConnecter(): Promise<void> {
  await gestionnaire().signinRedirect();
}

export async function seDeconnecter(): Promise<void> {
  await gestionnaire().signoutRedirect();
}

//: Échange en cours, mémoïsé. Un code d'autorisation est à USAGE UNIQUE : le
//: consommer retire du stockage l'état qui lui correspond, si bien qu'une
//: seconde tentative échoue sur un « No matching state ». Or le composant qui
//: pilote le retour est monté deux fois en développement (StrictMode). Sans
//: cette mémoïsation, la seconde tentative afficherait une erreur imméritée.
let echangeEnCours: Promise<OidcUser> | null = null;

/** Traite le retour de Keycloak (`/auth/callback`).
 *
 *  Deux appels concurrents partagent le MÊME échange, et reçoivent donc le même
 *  résultat. En cas d'échec on oublie la promesse, pour qu'une nouvelle tentative
 *  reste possible — un code expiré doit pouvoir être suivi d'une reconnexion.
 */
export function terminerConnexion(): Promise<OidcUser> {
  echangeEnCours ??= gestionnaire()
    .signinRedirectCallback()
    .catch((e) => {
      echangeEnCours = null;
      throw e;
    });
  return echangeEnCours;
}
