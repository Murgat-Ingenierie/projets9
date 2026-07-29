import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError, api } from "./client";
import { jetonAcces, seConnecter } from "../auth/oidc";

// Le jeton vient désormais UNIQUEMENT de la session Keycloak — le jeton maison
// en localStorage (`gp.token`) a disparu avec le login maison. On simule donc la
// couche OIDC plutôt que d'écrire dans le stockage.
vi.mock("../auth/oidc", () => ({
  jetonAcces: vi.fn(async () => null),
  seConnecter: vi.fn(async () => {}),
}));

const jetonMock = vi.mocked(jetonAcces);
const connexionMock = vi.mocked(seConnecter);

function fakeResponse(status: number, body: string, statusText = ""): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    statusText,
    text: async () => body,
  } as Response;
}

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  jetonMock.mockReset().mockResolvedValue(null);
  connexionMock.mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("api() — succès", () => {
  it("retourne le JSON parsé sur 200", async () => {
    fetchMock.mockResolvedValue(fakeResponse(200, JSON.stringify({ id: 1, nom: "X" })));
    expect(await api("/api/epics")).toEqual({ id: 1, nom: "X" });
  });

  it("retourne undefined sur 204", async () => {
    fetchMock.mockResolvedValue(fakeResponse(204, ""));
    expect(await api("/api/epics/ABC", { method: "DELETE" })).toBeUndefined();
  });

  it("pose l'en-tête Authorization avec le jeton Keycloak", async () => {
    jetonMock.mockResolvedValue("jeton42");
    fetchMock.mockResolvedValue(fakeResponse(200, "{}"));
    await api("/api/epics");
    const headers = fetchMock.mock.calls[0][1].headers as Headers;
    expect(headers.get("Authorization")).toBe("Bearer jeton42");
  });

  it("n'invente pas d'en-tête Authorization sans session", async () => {
    fetchMock.mockResolvedValue(fakeResponse(200, "{}"));
    await api("/api/epics");
    const headers = fetchMock.mock.calls[0][1].headers as Headers;
    expect(headers.has("Authorization")).toBe(false);
  });

  it("pose Content-Type JSON quand il y a un body", async () => {
    fetchMock.mockResolvedValue(fakeResponse(201, "{}"));
    await api("/api/epics", { method: "POST", body: JSON.stringify({ x: 1 }) });
    const headers = fetchMock.mock.calls[0][1].headers as Headers;
    expect(headers.get("Content-Type")).toBe("application/json");
  });

  it("laisse le navigateur poser le Content-Type d'un FormData", async () => {
    // Écrire `multipart/form-data` à la main produit un corps sans frontière,
    // que le serveur ne sait pas découper (bug rencontré à l'import du classeur).
    fetchMock.mockResolvedValue(fakeResponse(200, "{}"));
    const fd = new FormData();
    fd.append("fichier", new Blob(["x"]), "source.xlsx");
    await api("/api/import/xlsx", { method: "POST", body: fd });
    const headers = fetchMock.mock.calls[0][1].headers as Headers;
    expect(headers.has("Content-Type")).toBe(false);
  });
});

describe("api() — erreurs", () => {
  it("mappe {detail:{code,message}} vers ApiError avec code", async () => {
    fetchMock.mockResolvedValue(
      fakeResponse(409, JSON.stringify({ detail: { code: "INV-6", message: "Jalon orphelin" } }))
    );
    await expect(api("/api/projects/1", { method: "DELETE" })).rejects.toMatchObject({
      status: 409,
      code: "INV-6",
      message: "Jalon orphelin",
    });
  });

  it("mappe une liste d'erreurs Pydantic vers le code VALIDATION", async () => {
    const body = JSON.stringify({ detail: [{ loc: ["body", "email"], msg: "invalide" }] });
    fetchMock.mockResolvedValue(fakeResponse(422, body));
    const err = (await api("/api/users", { method: "POST", body: "{}" }).catch(
      (e) => e
    )) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe("VALIDATION");
    expect(err.message).toContain("body.email : invalide");
  });

  it("mappe {detail:'texte'} vers le message brut", async () => {
    fetchMock.mockResolvedValue(fakeResponse(404, JSON.stringify({ detail: "Introuvable" })));
    await expect(api("/api/x")).rejects.toMatchObject({
      status: 404,
      code: null,
      message: "Introuvable",
    });
  });

  it("gère un corps non-JSON (HTML 502) et strippe les balises", async () => {
    fetchMock.mockResolvedValue(
      fakeResponse(502, "<html><body>Bad Gateway</body></html>", "Bad Gateway")
    );
    const err = (await api("/api/x").catch((e) => e)) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(502);
    expect(err.message).toContain("Réponse serveur inattendue");
    expect(err.message).not.toContain("<html>");
  });
});

describe("api() — 401", () => {
  it("renvoie l'utilisateur s'authentifier plutôt que de lever", async () => {
    // Session expirée, ou renouvellement silencieux en échec : une ApiError 401
    // ne dirait rien d'actionnable — l'utilisateur ne peut pas la résoudre.
    fetchMock.mockResolvedValue(fakeResponse(401, ""));

    const course = await Promise.race([
      api("/api/epics").then(() => "resolue", () => "rejetee"),
      new Promise((r) => setTimeout(() => r("en-attente"), 20)),
    ]);

    expect(connexionMock).toHaveBeenCalledOnce();
    // La redirection est en cours : la promesse ne doit NI se résoudre NI lever,
    // sous peine d'afficher une erreur par-dessus une page qui s'en va.
    expect(course).toBe("en-attente");
  });
});
