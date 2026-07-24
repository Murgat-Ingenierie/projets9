import { describe, it, expect } from "vitest";
import { adjustBrightness, stylesFor } from "./ganttStyles";

describe("adjustBrightness", () => {
  it("assombrit (factor < 1)", () => {
    expect(adjustBrightness("#808080", 0.5)).toBe("#404040"); // 128 * 0.5 = 64 = 0x40
  });
  it("éclaircit (factor > 1)", () => {
    expect(adjustBrightness("#000000", 2)).toBe("#808080"); // 0 + 255*(1-1/2) = 128 = 0x80
  });
  it("laisse inchangé ce qui n'est pas un hex #RRGGBB", () => {
    expect(adjustBrightness("rgb(0,0,0)", 2)).toBe("rgb(0,0,0)");
    expect(adjustBrightness("#abc", 2)).toBe("#abc");
  });
});

describe("stylesFor", () => {
  it("couleur de base + variante assombrie pour la sélection", () => {
    const s = stylesFor("#808080");
    expect(s.backgroundColor).toBe("#808080");
    expect(s.progressColor).toBe("#808080");
    expect(s.backgroundSelectedColor).toBe(adjustBrightness("#808080", 0.8));
    expect(s.progressSelectedColor).toBe(s.backgroundSelectedColor);
  });
});
