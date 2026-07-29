import { jetonAcces, seConnecter } from "../auth/oidc";

export class ApiError extends Error {
  constructor(public status: number, public code: string | null, message: string) {
    super(message);
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers ?? {});
  // FormData (téléversement) : NE PAS fixer Content-Type. Le navigateur doit
  // poser lui-même `multipart/form-data; boundary=…` — l'écrire à la main
  // produit un corps que le serveur ne sait pas découper.
  if (!headers.has("Content-Type") && init.body && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  // Source unique depuis le retrait du jeton maison : la session Keycloak. Le
  // jeton hérité vivait en localStorage sous `gp.token` ; plus personne ne
  // l'écrit ni ne le lit, et l'API ne l'accepterait plus.
  const token = await jetonAcces();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(path, { ...init, headers });

  // 401 : la session Keycloak a expiré (ou le renouvellement silencieux a
  // échoué). On renvoie l'utilisateur s'authentifier plutôt que de lui afficher
  // une erreur qu'il ne peut pas résoudre.
  if (res.status === 401) {
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
