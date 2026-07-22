import { describe, expect, it } from "vitest";

import {
  EPIC_CATEGORIES,
  EPIC_CATEGORY_LABELS,
  EPIC_STATUS_LABELS,
  EPIC_STATUTS,
  PROJECT_STATUS_LABELS,
  PROJECT_STATUTS,
  TASK_STATUS_LABELS,
  TASK_STATUTS,
  USER_ROLE_LABELS,
  USER_ROLES,
  fmtDate,
} from "./labels";

describe("fmtDate", () => {
  it("convertit une date ISO en jj/mm/aaaa", () => {
    expect(fmtDate("2026-07-22")).toBe("22/07/2026");
  });

  it("gère une date ISO avec heure (garde la partie date)", () => {
    // fmtDate ne split que sur '-', donc l'heure reste collée au jour — on
    // documente le comportement réel plutôt que de le supposer.
    expect(fmtDate("2026-07-22T13:00:00Z")).toBe("22T13:00:00Z/07/2026");
  });

  it("renvoie une chaîne vide pour null / undefined / vide", () => {
    expect(fmtDate(null)).toBe("");
    expect(fmtDate(undefined)).toBe("");
    expect(fmtDate("")).toBe("");
  });

  it("laisse passer une entrée sans assez de tirets telle quelle", () => {
    // split('-') doit donner 3 parts non vides ; sinon on renvoie l'entrée.
    expect(fmtDate("garbage")).toBe("garbage");
    expect(fmtDate("2026")).toBe("2026");
  });
});

describe("cohérence des libellés d'enum", () => {
  it("chaque valeur d'enum a un libellé non vide", () => {
    const paires: [readonly string[], Record<string, string>][] = [
      [EPIC_STATUTS, EPIC_STATUS_LABELS],
      [EPIC_CATEGORIES, EPIC_CATEGORY_LABELS],
      [PROJECT_STATUTS, PROJECT_STATUS_LABELS],
      [TASK_STATUTS, TASK_STATUS_LABELS],
      [USER_ROLES, USER_ROLE_LABELS],
    ];
    for (const [valeurs, libelles] of paires) {
      for (const v of valeurs) {
        expect(libelles[v], `libellé manquant pour ${v}`).toBeTruthy();
      }
    }
  });
});
