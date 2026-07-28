/// <reference types="vite/client" />

// Variables injectées au BUILD par Vite (cf. web/Dockerfile : elles arrivent en
// `ARG`). Vides = adossement OIDC inactif, l'application reste en mode débrayé.
interface ImportMetaEnv {
  /** Ex. https://<serveur-keycloak>/realms/<realm> — vide = OIDC inactif. */
  readonly VITE_OIDC_AUTHORITY?: string;
  /** Client public du SPA. */
  readonly VITE_OIDC_CLIENT_ID?: string;
  /** Client qui porte les rôles applicatifs, demandé en audience. */
  readonly VITE_OIDC_API_CLIENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
