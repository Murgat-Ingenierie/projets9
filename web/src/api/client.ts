import { estActif, jetonAcces, seConnecter } from "../auth/oidc";

const TOKEN_KEY = "gp.token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  constructor(public status: number, public code: string | null, message: string) {
    super(message);
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers ?? {});
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }
  // Deux sources possibles, dans cet ordre : le jeton Keycloak quand l'OIDC est
  // configuré, sinon le jeton hérité en localStorage. Les deux chemins coexistent
  // le temps de la bascule (même principe que côté API).
  const token = estActif() ? await jetonAcces() : getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(path, { ...init, headers });

  // 401 avec OIDC actif : la session Keycloak a expiré (ou le renouvellement
  // silencieux a échoué). On renvoie l'utilisateur s'authentifier plutôt que de
  // lui afficher une erreur qu'il ne peut pas résoudre. Sans OIDC, l'erreur
  // remonte comme n'importe quelle autre — il n'y a pas de page de login.
  if (res.status === 401 && estActif()) {
    await seConnecter();
    // La redirection est en cours ; cette promesse ne se résoudra pas.
    return new Promise<T>(() => {});
  }
  if (res.status === 204) return undefined as T;

  const text = await res.text();
  let data: any = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      // Réponse non-JSON (HTML 502/504, plain-text 500, etc.).
      const snippet = text.replace(/<[^>]+>/g, " ").trim().slice(0, 250);
      throw new ApiError(
        res.status,
        null,
        `Réponse serveur inattendue (HTTP ${res.status}) : ${snippet || res.statusText}`
      );
    }
  }

  if (!res.ok) {
    const detail = data?.detail;
    if (detail && typeof detail === "object" && "code" in detail) {
      throw new ApiError(res.status, detail.code, detail.message);
    }
    if (Array.isArray(detail)) {
      // FastAPI Pydantic validation errors : [{loc, msg, type}, ...]
      const msg = detail
        .map((d: any) => `${(d.loc ?? []).join(".")} : ${d.msg}`)
        .join(" ; ");
      throw new ApiError(res.status, "VALIDATION", msg);
    }
    throw new ApiError(res.status, null, typeof detail === "string" ? detail : res.statusText);
  }
  return data as T;
}
