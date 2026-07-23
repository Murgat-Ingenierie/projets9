// Mock de l'API pour les e2e : intercepte tous les /api/** au niveau navigateur
// (Playwright route), renvoie les fixtures pour les GET et capture les mutations.
// `users.me()` mocké => l'AuthProvider réussit, pas de redirection vers /login.
import type { Page, Route } from "@playwright/test";
import { ADMIN, EPICS, PROJECTS, TASKS, MILESTONES, DEPENDENCIES, EQUIPES, TACHE_EQUIPE } from "./fixtures";

export interface ApiCall {
  method: string;
  path: string;
  body: unknown;
}

export async function mockApi(page: Page): Promise<ApiCall[]> {
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
    calls.push({ method, path, body });

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
