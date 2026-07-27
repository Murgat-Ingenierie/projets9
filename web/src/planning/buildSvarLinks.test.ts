import { describe, it, expect } from "vitest";
import { buildSvarLinks, svarLinkToDependency } from "./buildSvarLinks";
import type { Dependency } from "../types";

const dep = (id: number, amont: number, aval: number, type: Dependency["type"] = "FS"): Dependency => ({
  id, tache_amont_id: amont, tache_aval_id: aval, type,
});

describe("buildSvarLinks", () => {
  it("mappe FS/SS/FF vers e2s/s2s/e2e et les ids task:<n>", () => {
    const links = buildSvarLinks([dep(1, 11, 12, "FS"), dep(2, 12, 13, "SS"), dep(3, 13, 14, "FF")]);
    expect(links).toEqual([
      { id: 1, source: "task:11", target: "task:12", type: "e2s" },
      { id: 2, source: "task:12", target: "task:13", type: "s2s" },
      { id: 3, source: "task:13", target: "task:14", type: "e2e" },
    ]);
  });

  it("liste vide → []", () => {
    expect(buildSvarLinks([])).toEqual([]);
  });
});

describe("svarLinkToDependency", () => {
  it("mappe e2s/s2s/e2e vers FS/SS/FF et extrait les ids de tâche", () => {
    expect(svarLinkToDependency({ source: "task:11", target: "task:12", type: "e2s" })).toEqual({
      tache_amont_id: 11, tache_aval_id: 12, type: "FS",
    });
    expect(svarLinkToDependency({ source: "task:12", target: "task:13", type: "s2s" })).toMatchObject({ type: "SS" });
    expect(svarLinkToDependency({ source: "task:13", target: "task:14", type: "e2e" })).toMatchObject({ type: "FF" });
  });

  it("null pour un type SF (s2e) sans équivalent métier", () => {
    expect(svarLinkToDependency({ source: "task:1", target: "task:2", type: "s2e" })).toBeNull();
  });

  it("null si une extrémité n'est pas une tâche (epic/projet/jalon)", () => {
    expect(svarLinkToDependency({ source: "proj:1", target: "task:2", type: "e2s" })).toBeNull();
    expect(svarLinkToDependency({ source: "task:1", target: "ms:2", type: "e2s" })).toBeNull();
  });

  it("null si un champ manque (lien incomplet)", () => {
    expect(svarLinkToDependency({ source: "task:1", type: "e2s" })).toBeNull();
    expect(svarLinkToDependency({ source: "task:1", target: "task:2" })).toBeNull();
  });

  it("round-trip : buildSvarLinks puis svarLinkToDependency redonne la paire/type", () => {
    const [link] = buildSvarLinks([{ id: 7, tache_amont_id: 3, tache_aval_id: 5, type: "FF" }]);
    expect(svarLinkToDependency(link)).toEqual({ tache_amont_id: 3, tache_aval_id: 5, type: "FF" });
  });
});
