import { describe, it, expect } from "vitest";
import { buildDependencyMaps, findDependencyId } from "./dependencies";
import type { Dependency } from "../types";

const dep = (id: number, amont: number, aval: number, type: Dependency["type"] = "FS"): Dependency => ({
  id, tache_amont_id: amont, tache_aval_id: aval, type,
});

describe("buildDependencyMaps", () => {
  it("indexe les FS dans les deux sens", () => {
    const { depsByAval, dependentsByAmont } = buildDependencyMaps([dep(1, 10, 20), dep(2, 10, 30)]);
    expect(depsByAval.get(20)).toEqual([10]);
    expect(depsByAval.get(30)).toEqual([10]);
    expect(dependentsByAmont.get(10)).toEqual([20, 30]);
  });

  it("ignore les dépendances non-FS (SS/FF)", () => {
    const { depsByAval, dependentsByAmont } = buildDependencyMaps([dep(1, 10, 20, "SS"), dep(2, 10, 30, "FF")]);
    expect(depsByAval.size).toBe(0);
    expect(dependentsByAmont.size).toBe(0);
  });

  it("agrège plusieurs amonts pour un même aval", () => {
    const { depsByAval } = buildDependencyMaps([dep(1, 10, 20), dep(2, 11, 20)]);
    expect(depsByAval.get(20)).toEqual([10, 11]);
  });

  it("liste vide → maps vides", () => {
    const m = buildDependencyMaps([]);
    expect(m.depsByAval.size).toBe(0);
    expect(m.dependentsByAmont.size).toBe(0);
  });
});

describe("findDependencyId", () => {
  const deps = [dep(1, 10, 20), dep(2, 11, 20, "SS")];
  it("trouve la FS par paire (amont, aval)", () => {
    expect(findDependencyId(deps, 10, 20)).toBe(1);
  });
  it("renvoie null si la paire n'existe pas", () => {
    expect(findDependencyId(deps, 99, 20)).toBeNull();
  });
  it("ignore les non-FS même si la paire correspond", () => {
    expect(findDependencyId(deps, 11, 20)).toBeNull();
  });
});
