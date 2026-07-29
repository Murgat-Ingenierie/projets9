// Mock de l'API pour les e2e : intercepte tous les /api/** au niveau navigateur
// (Playwright route), renvoie les fixtures pour les GET et capture les mutations.
// `users.me()` mocké => l'AuthProvider résout l'utilisateur local.
import type { Page, Route } from "@playwright/test";
import { ADMIN, EPICS, PROJECTS, TASKS, MILESTONES, DEPENDENCIES, EQUIPES, TACHE_EQUIPE } from "./fixtures";

export interface ApiCall {
  method: string;
  path: string;
  body: unknown;
  /** En-tête `Authorization` reçu, ou null. Capturé pour pouvoir vérifier que le
   *  jeton de la session parvient réellement jusqu'aux requêtes : sans cela, un
   *  test vert ne dirait pas si l'application est authentifiée ou si l'API
   *  mockée répond simplement à tout le monde. */
  auth: string | null;
}

// Doivent correspondre aux VITE_OIDC_* passés au serveur Vite par
// playwright.config.ts : oidc-client-ts range la session sous une clé dérivée de
// l'autorité et de l'identifiant client.
const AUTORITE = "https://auth.e2e.invalid/realms/e2e";
const CLIENT = "projets9-front";

/** Installe une session Keycloak déjà valide dans le stockage du navigateur.
 *
 *  Les e2e n'ont pas de serveur d'authentification à joindre — et n'ont pas à en
 *  avoir : ce qu'ils éprouvent est le planning. Mais depuis le retrait du mode
 *  sans OIDC, l'application redirige vers Keycloak faute de session. Plutôt que
 *  de rouvrir une porte « pas d'auth » pour les tests (qui existerait alors dans
 *  le bundle de production), on POSE une session : les tests traversent le vrai
 *  chemin, jeton compris.
 */
async function sessionKeycloak(page: Page): Promise<void> {
  await page.addInitScript(
    ([autorite, client]) => {
      const expire = Math.floor(Date.now() / 1000) + 3600;
      window.localStorage.setItem(
        `oidc.user:${autorite}:${client}`,
        JSON.stringify({
          access_token: "jeton-e2e",
          token_type: "Bearer",
          scope: "openid profile email",
          expires_at: expire,
          profile: { sub: "e2e-sub", email: "e2e@test.local", name: "Admin E2E" },
        })
      );
    },
    [AUTORITE, CLIENT]
  );
}

export async function mockApi(page: Page): Promise<ApiCall[]> {
  await sessionKeycloak(page);
  const calls: ApiCall[] = [];
  const json = (data: unknown) =>
    ({ status: 200, contentType: "application/json", body: JSON.stringify(data) });

  // Prédicat d'URL : SEULEMENT les vrais appels API (pathname commençant par
  // /api/), pas les modules Vite servis depuis /src/api/*.ts.
  await page.route((url) => url.pathname.startsWith("/api/"), async (route: Route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    const method = req.method();
    let body: unknown;
    try { body = req.postDataJSON(); } catch { body = undefined; }
    calls.push({ method, path, body, auth: (await req.allHeaders())["authorization"] ?? null });

    if (method === "GET") {
      if (path.endsWith("/api/users/me")) return route.fulfill(json(ADMIN));
      if (path.endsWith("/api/epics")) return route.fulfill(json(EPICS));
      if (path.endsWith("/api/projects")) return route.fulfill(json(PROJECTS));
      if (path.endsWith("/api/tasks")) return route.fulfill(json(TASKS));
      if (path.endsWith("/api/dependencies")) return route.fulfill(json(DEPENDENCIES));
      if (path.endsWith("/api/milestones")) return route.fulfill(json(MILESTONES));
      if (path.endsWith("/api/equipes")) return route.fulfill(json(EQUIPES));
      if (path.endsWith("/api/tache-equipe")) return route.fulfill(json(TACHE_EQUIPE));
      return route.fulfill(json([]));
    }

    // POST/PUT/DELETE : succès, écho du corps (les mutations sont vérifiées via `calls`).
    const echo = body && typeof body === "object" ? body : {};
    return route.fulfill(json({ id: 999, ...echo }));
  });

  return calls;
}
