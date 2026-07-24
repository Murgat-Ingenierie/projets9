import { describe, it, expect } from "vitest";
import { buildSvarLinks } from "./buildSvarLinks";
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
