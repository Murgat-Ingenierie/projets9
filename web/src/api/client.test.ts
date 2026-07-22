import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError, api, getToken, setToken } from "./client";

function fakeResponse(status: number, body: string, statusText = ""): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    statusText,
    text: async () => body,
  } as Response;
}

const fetchMock = vi.fn();

function setLocation(loc: { pathname: string; href: string }): void {
  Object.defineProperty(window, "location", {
    value: loc,
    writable: true,
    configurable: true,
  });
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("token localStorage", () => {
  it("set puis get, et null vide le token", () => {
    setToken("abc");
    expect(getToken()).toBe("abc");
    setToken(null);
    expect(getToken()).toBeNull();
  });
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

  it("pose l'en-tête Authorization quand un token existe", async () => {
    setToken("jeton42");
    fetchMock.mockResolvedValue(fakeResponse(200, "{}"));
    await api("/api/epics");
    const headers = fetchMock.mock.calls[0][1].headers as Headers;
    expect(headers.get("Authorization")).toBe("Bearer jeton42");
  });

  it("pose Content-Type JSON quand il y a un body", async () => {
    fetchMock.mockResolvedValue(fakeResponse(201, "{}"));
    await api("/api/epics", { method: "POST", body: JSON.stringify({ x: 1 }) });
    const headers = fetchMock.mock.calls[0][1].headers as Headers;
    expect(headers.get("Content-Type")).toBe("application/json");
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
  it("vide le token, redirige vers /login et lève une ApiError 401", async () => {
    setToken("expiré");
    const loc = { pathname: "/epics", href: "" };
    setLocation(loc);
    fetchMock.mockResolvedValue(fakeResponse(401, ""));

    await expect(api("/api/epics")).rejects.toMatchObject({ status: 401 });
    expect(getToken()).toBeNull();
    expect(loc.href).toBe("/login");
  });

  it("ne reboucle pas si on est déjà sur /login", async () => {
    const loc = { pathname: "/login", href: "/login" };
    setLocation(loc);
    fetchMock.mockResolvedValue(fakeResponse(401, ""));

    await expect(
      api("/api/auth/login", { method: "POST", body: "{}" })
    ).rejects.toMatchObject({ status: 401 });
    expect(loc.href).toBe("/login");
  });
});
