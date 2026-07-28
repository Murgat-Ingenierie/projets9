// Adossement du front à Keycloak (OIDC), pendant de `api/app/auth/oidc.py`.
//
// Même règle que côté API : **inactif tant que la configuration est vide**.
// Sans `VITE_OIDC_AUTHORITY`, `estActif()` renvoie false et l'application se
// comporte exactement comme avant (pas de login, l'API tourne en AUTH_DISABLED).
// La bascule se fait donc par configuration, sans fenêtre d'indisponibilité.
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

export function estActif(): boolean {
  return Boolean(AUTHORITY && CLIENT_ID);
}

let manager: UserManager | null = null;

export function gestionnaire(): UserManager {
  if (!estActif()) {
    throw new Error("OIDC non configuré (VITE_OIDC_AUTHORITY / VITE_OIDC_CLIENT_ID)");
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
  if (!estActif()) return null;
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
  if (!estActif()) return;
  await gestionnaire().signoutRedirect();
}

/** Traite le retour de Keycloak (`/auth/callback`). */
export async function terminerConnexion(): Promise<OidcUser> {
  return gestionnaire().signinRedirectCallback();
}
