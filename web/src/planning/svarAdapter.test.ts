import { describe, it, expect } from "vitest";
import { parseSvarId } from "./svarAdapter";

describe("parseSvarId", () => {
  it("reconnaît les 4 types de lignes", () => {
    expect(parseSvarId("epic:O50")).toEqual({ kind: "epic", ref: "O50" });
    expect(parseSvarId("proj:1")).toEqual({ kind: "proj", ref: "1" });
    expect(parseSvarId("task:11")).toEqual({ kind: "task", ref: "11" });
    expect(parseSvarId("ms:21")).toEqual({ kind: "ms", ref: "21" });
  });

  it("null pour un préfixe inconnu, un id sans « : » ou sans référence", () => {
    expect(parseSvarId("temp://1784")).toBeNull(); // id temporaire de lien SVAR
    expect(parseSvarId("42")).toBeNull();
    expect(parseSvarId("task:")).toBeNull();
    expect(parseSvarId("")).toBeNull();
  });
});
