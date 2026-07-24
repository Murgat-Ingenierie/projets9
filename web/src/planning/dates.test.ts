import { describe, it, expect } from "vitest";
import { toDate, isoDate, fmtDate, shiftIso, daysBetweenIso } from "./dates";

describe("dates", () => {
  it("isoDate → YYYY-MM-DD", () => {
    expect(isoDate(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(isoDate(new Date(2026, 11, 31))).toBe("2026-12-31");
  });

  it("fmtDate → DD/MM/YYYY", () => {
    expect(fmtDate(new Date(2026, 0, 5))).toBe("05/01/2026");
  });

  it("toDate → isoDate est un round-trip", () => {
    expect(isoDate(toDate("2026-07-24"))).toBe("2026-07-24");
  });

  it("shiftIso décale et gère les bords de mois / d'année", () => {
    expect(shiftIso("2026-07-24", 1)).toBe("2026-07-25");
    expect(shiftIso("2026-01-31", 1)).toBe("2026-02-01");
    expect(shiftIso("2026-12-31", 1)).toBe("2027-01-01");
    expect(shiftIso("2026-03-01", -1)).toBe("2026-02-28"); // 2026 non bissextile
    expect(shiftIso("2026-07-24", 0)).toBe("2026-07-24");
    expect(shiftIso("2026-07-24", -10)).toBe("2026-07-14");
  });

  it("daysBetweenIso compte les jours calendaires (signé)", () => {
    expect(daysBetweenIso("2026-07-24", "2026-07-24")).toBe(0);
    expect(daysBetweenIso("2026-07-24", "2026-07-25")).toBe(1);
    expect(daysBetweenIso("2026-07-25", "2026-07-24")).toBe(-1);
    expect(daysBetweenIso("2026-01-31", "2026-02-01")).toBe(1);
  });

  it("shiftIso et daysBetweenIso sont réciproques (y compris à travers l'heure d'été)", () => {
    for (const n of [-400, -30, -1, 0, 1, 5, 60, 400]) {
      expect(daysBetweenIso("2026-02-15", shiftIso("2026-02-15", n))).toBe(n);
    }
  });
});
